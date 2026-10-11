import {
    test,
    expect,
    Page,
    request as playwrightRequest,
} from '@playwright/test';
import path from 'path';

// Phase 5: each test gets its own account, so the shared E2E user's day
// plan (used by other specs running in parallel) is never touched.

const adminEmail = process.env.E2E_EMAIL || 'test@tududi.com';
const adminPassword = process.env.E2E_PASSWORD || 'password123';
const PASSWORD = 'password123';

async function createUser(appUrl: string, prefix: string): Promise<string> {
    const admin = await playwrightRequest.newContext({ baseURL: appUrl });
    const login = await admin.post('/api/login', {
        data: { email: adminEmail, password: adminPassword },
    });
    expect(login.ok()).toBeTruthy();
    const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    const created = await admin.post('/api/admin/users', {
        data: { email, password: PASSWORD },
    });
    expect(created.status()).toBe(201);
    await admin.dispose();
    return email;
}

async function signIn(page: Page, appUrl: string, email: string) {
    await page.goto(`${appUrl}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /login/i }).click();
}

// Serious or critical axe findings inside one Phase 5 region.
async function axeSerious(page: Page, selector: string): Promise<string[]> {
    await page.addScriptTag({
        path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js'),
    });
    const violations = await page.evaluate(async (sel) => {
        const axe = (
            window as unknown as {
                axe: {
                    run: (
                        ctx: string,
                        opts: object
                    ) => Promise<{
                        violations: { id: string; impact: string | null }[];
                    }>;
                };
            }
        ).axe;
        return (
            await axe.run(sel, {
                runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
            })
        ).violations;
    }, selector);
    return violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map((v) => `${selector}: ${v.id}`);
}

const addDay = (date: string, days: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
};

test.describe('Phase 5 today', () => {
    test('first run: three steps reach the Now card in under three minutes', async ({
        page,
        baseURL,
    }) => {
        // Must stay below the three-minute budget; no sleeps below.
        test.setTimeout(150_000);
        const appUrl = baseURL ?? 'http://localhost:8080';
        const email = await createUser(appUrl, 'onboarding');
        const started = Date.now();
        await signIn(page, appUrl, email);
        await expect(page).toHaveURL(/\/welcome$/);

        // 1) Persian, Jalali and Persian digits are the defaults.
        await expect(page.getByTestId('welcome-language')).toHaveValue('fa');
        await expect(page.getByTestId('welcome-calendar')).toHaveValue(
            'persian'
        );
        await expect(page.getByTestId('welcome-persian-digits')).toBeChecked();
        await page.getByTestId('welcome-next-1').click();
        await expect(page.getByTestId('welcome-step-2')).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

        // 2) One season goal; Areas are empty so three suggestions show.
        await expect(page.getByTestId('welcome-area-option')).toHaveCount(3);
        await page.getByTestId('welcome-goal').fill('اسپانیایی B1');
        await page.getByTestId('welcome-area-option').first().click();
        await page.getByTestId('welcome-next-2').click();

        // 3) Work hours and one task for today.
        await expect(page.getByTestId('welcome-step-3')).toBeVisible();
        await page.getByTestId('welcome-work-start').fill('09:00');
        await page.getByTestId('welcome-work-end').fill('17:00');
        const taskName = `تمرین لغت ${Date.now()}`;
        await page.getByTestId('welcome-task').fill(taskName);
        await page.getByTestId('welcome-finish').click();

        await expect(page).toHaveURL(/\/today$/);
        await expect(page.getByTestId('now-card')).toContainText(taskName);
        await expect(page.getByTestId('now-card-five-minutes')).toBeVisible();
        expect(Date.now() - started).toBeLessThan(180_000);

        // No PWA install or notification prompt was part of it.
        const goals = await page.context().request.get(`${appUrl}/api/goals`);
        const body = await goals.json();
        const list = Array.isArray(body) ? body : body.goals;
        expect(
            list.some(
                (g: { title: string; horizon: string }) =>
                    g.title === 'اسپانیایی B1' && g.horizon === 'season'
            )
        ).toBe(true);
    });

    test('Lighten my day moves work to tomorrow and Undo restores it', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(90_000);
        const appUrl = baseURL ?? 'http://localhost:8080';
        const email = await createUser(appUrl, 'recovery');
        await signIn(page, appUrl, email);
        await expect(page).toHaveURL(/\/welcome$/);
        await page.getByTestId('welcome-start').click();
        await expect(page).toHaveURL(/\/today$/);

        const api = page.context().request;
        const uids: string[] = [];
        for (const name of ['Report', 'Slides', 'Budget', 'Emails']) {
            const res = await api.post(`${appUrl}/api/task`, {
                data: { name: `${name} ${Date.now()}`, estimated_minutes: 120 },
            });
            expect(res.ok()).toBeTruthy();
            uids.push((await res.json()).uid);
        }
        const planned = await api.put(`${appUrl}/api/daily-plan/today`, {
            data: {
                items: uids.map((uid) => ({
                    task_uid: uid,
                    start_minute: null,
                })),
            },
        });
        expect(planned.ok()).toBeTruthy();
        const today: string = (await planned.json()).date;
        const tomorrow = addDay(today, 1);
        expect(
            (await api.post(`${appUrl}/api/daily-plan/today/start`)).ok()
        ).toBeTruthy();
        const planOf = async (date: string) =>
            (
                (
                    await (
                        await api.get(`${appUrl}/api/daily-plan?date=${date}`)
                    ).json()
                ).plan?.items ?? []
            ).map((i: { task_uid: string }) => i.task_uid);

        await page.goto(`${appUrl}/today`);
        await expect(page.getByTestId('now-card')).toBeVisible();
        // 8h of work in an 8h window x 1.3 is over capacity.
        await expect(page.getByTestId('capacity-unrealistic')).toBeVisible();

        const recovery = page.waitForResponse(
            (r) => r.url().includes('/api/planner/recovery') && r.ok()
        );
        await page.getByTestId('recovery-lighten').click();
        const result = await (await recovery).json();
        expect(result.kept.length).toBeLessThanOrEqual(3);
        expect(result.moved.length).toBeGreaterThan(0);
        await expect(page.getByText(/moved to tomorrow/)).toBeVisible();
        expect(await planOf(tomorrow)).toEqual(result.moved);
        expect(await planOf(today)).toEqual(result.kept);

        const revert = page.waitForResponse(
            (r) => r.url().includes('/revert') && r.ok()
        );
        await page.getByRole('button', { name: 'Undo' }).click();
        await revert;
        await expect.poll(() => planOf(today)).toEqual(uids);
        expect(await planOf(tomorrow)).toEqual([]);
        await expect(page.getByTestId('agenda-list')).toContainText('Emails');
    });

    test('Overwhelmed shows only the Now card until switched off', async ({
        page,
        baseURL,
    }) => {
        const appUrl = baseURL ?? 'http://localhost:8080';
        const email = await createUser(appUrl, 'overwhelmed');
        await signIn(page, appUrl, email);
        await page.getByTestId('welcome-start').click();
        await expect(page).toHaveURL(/\/today$/);
        const api = page.context().request;
        const task = await (
            await api.post(`${appUrl}/api/task`, {
                data: { name: 'Only this', starter_step: 'Open the file' },
            })
        ).json();
        await api.put(`${appUrl}/api/daily-plan/today`, {
            data: { items: [{ task_uid: task.uid, start_minute: null }] },
        });
        await api.post(`${appUrl}/api/daily-plan/today/start`);
        await page.goto(`${appUrl}/today`);
        await expect(page.getByTestId('now-card-starter-step')).toContainText(
            'Open the file'
        );
        await page.getByTestId('overwhelmed-on').click();
        await expect(page.getByTestId('overwhelmed-mode')).toBeVisible();
        await expect(page.getByTestId('agenda-list')).toHaveCount(0);
        await expect(page.getByTestId('now-card')).toContainText('Only this');
        await page.getByTestId('overwhelmed-off').click();
        await expect(page.getByTestId('agenda-list')).toBeVisible();
    });

    test('Focus interrupt keeps a note, Continue reopens it; Focus and Recovery pass axe', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(90_000);
        const appUrl = baseURL ?? 'http://localhost:8080';
        const email = await createUser(appUrl, 'focus');
        await signIn(page, appUrl, email);
        await page.getByTestId('welcome-start').click();
        await expect(page).toHaveURL(/\/today$/);
        const api = page.context().request;
        const task = await (
            await api.post(`${appUrl}/api/task`, {
                data: { name: 'Draft chapter', estimated_minutes: 30 },
            })
        ).json();
        await api.put(`${appUrl}/api/daily-plan/today`, {
            data: { items: [{ task_uid: task.uid, start_minute: null }] },
        });
        await api.post(`${appUrl}/api/daily-plan/today/start`);
        await page.goto(`${appUrl}/today`);
        await expect(page.getByTestId('recovery-controls')).toBeVisible();
        await expect(page.getByTestId('capacity-bar')).toBeVisible();
        const serious = [
            ...(await axeSerious(page, '[data-testid="recovery-controls"]')),
            ...(await axeSerious(page, '[data-testid="capacity-bar"]')),
            ...(await axeSerious(page, '[data-testid="now-card"]')),
        ];

        await page.getByTestId('now-card-focus').click();
        await expect(page.getByTestId('focus-mode')).toBeVisible();
        await expect(page.getByTestId('focus-clock')).toHaveText(
            /^\d{2}:\d{2}$/
        );
        serious.push(...(await axeSerious(page, '[data-testid="focus-mode"]')));
        await page.getByTestId('focus-interrupt').click();
        await page
            .getByTestId('focus-note-input')
            .fill('Halfway through the intro');
        await page.getByTestId('focus-save-interrupt').click();
        await expect(page.getByTestId('focus-mode')).toHaveCount(0);
        await expect(page.getByTestId('now-card-resume-note')).toContainText(
            'Halfway through the intro'
        );

        await page.getByTestId('now-card-resume').click();
        await expect(page.getByTestId('focus-resume-note')).toContainText(
            'Halfway through the intro'
        );
        await expect(page.getByRole('dialog')).toContainText('Draft chapter');
        await page.getByTestId('focus-finish').click();
        await expect(page.getByTestId('focus-mode')).toHaveCount(0);
        expect(serious).toEqual([]);
    });
});
