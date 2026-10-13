import {
    test,
    expect,
    Page,
    request as playwrightRequest,
} from '@playwright/test';

// Phase 11 (T-1103): the task effect on Now and the task page, a lesson from
// the day review, and at most one review question a day. Each test has its
// own account.

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

async function start(page: Page, appUrl: string, prefix: string) {
    const email = await createUser(appUrl, prefix);
    await page.goto(`${appUrl}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /login/i }).click();
    await page.getByTestId('welcome-start').click();
    await expect(page).toHaveURL(/\/today$/);
    return page.context().request;
}

test.describe('Phase 11 task effect and lessons', () => {
    test('Now shows the path, the outcome stays after completion, and a day-review lesson reaches only the related task', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(120_000);
        const appUrl = baseURL ?? 'http://localhost:8080';
        const api = await start(page, appUrl, 'effect');
        const goal = async (data: Record<string, unknown>) => {
            const res = await api.post(`${appUrl}/api/goals`, { data });
            expect(res.status()).toBe(201);
            return (await res.json()).goal;
        };
        const vision = await goal({
            title: 'A bilingual life',
            horizon: 'vision',
        });
        const fiveYear = await goal({
            title: 'Work in Spanish',
            horizon: 'five_year',
            parent_goal_uid: vision.uid,
            why: 'Choose where I work',
        });
        const metric = await api.post(
            `${appUrl}/api/goals/${fiveYear.uid}/metrics`,
            { data: { name: 'Score', baseline: 0, target: 100 } }
        );
        expect(metric.status()).toBe(201);
        const checkin = await api.post(
            `${appUrl}/api/metrics/${(await metric.json()).metric.uid}/checkins`,
            { data: { value: 40 } }
        );
        expect(checkin.ok()).toBeTruthy();
        const task = async (data: Record<string, unknown>) =>
            (await (await api.post(`${appUrl}/api/task`, { data })).json()).uid;
        const linked = await task({
            name: 'Spanish practice',
            goal_id: fiveYear.id,
        });
        const other = await task({ name: 'Laundry' });
        await api.put(`${appUrl}/api/daily-plan/today`, {
            data: {
                items: [linked, other].map((uid) => ({
                    task_uid: uid,
                    start_minute: null,
                })),
            },
        });
        await api.post(`${appUrl}/api/daily-plan/today/start`);

        await page.goto(`${appUrl}/today`);
        const now = page.getByTestId('now-card');
        await expect(now.getByTestId('effect-path')).toHaveText(
            'This task is on the path “Work in Spanish”.'
        );
        await expect(now.getByTestId('effect-outcome')).toHaveCount(0);
        await now.getByTestId('effect-more').click();
        await expect(now.getByTestId('effect-outcome')).toContainText('40%');

        await page.goto(`${appUrl}/task/${linked}`);
        await expect(page.getByTestId('task-effect-outcome')).toContainText(
            '40%'
        );
        for (const uid of [linked, other])
            expect(
                (
                    await api.patch(`${appUrl}/api/task/${uid}`, {
                        data: { status: 'done' },
                    })
                ).ok()
            ).toBeTruthy();
        await page.reload();
        await expect(page.getByTestId('task-effect-outcome')).toContainText(
            '40%'
        );

        // Everything is done, so the day review offers a lesson.
        await page.goto(`${appUrl}/today`);
        await page.getByTestId('day-lesson-write').click();
        await page
            .getByTestId('lesson-title-input')
            .fill('Short sessions work');
        await page.getByTestId('lesson-if_text').fill('I sit down to study');
        await page
            .getByTestId('lesson-then_text')
            .fill('I set a 20 minute timer');
        await page
            .getByTestId('lesson-link-select')
            .selectOption(`goal:${fiveYear.uid}`);
        const saved = page.waitForResponse(
            (r) => r.url().endsWith('/api/lessons') && r.status() === 201
        );
        await page.getByTestId('lesson-save-button').click();
        await saved;

        await page.goto(`${appUrl}/task/${linked}`);
        await expect(page.getByTestId('task-effect-lesson')).toContainText(
            'If I sit down to study, then I set a 20 minute timer.'
        );
        await page.goto(`${appUrl}/task/${other}`);
        await expect(page.getByTestId('task-effect-path')).toHaveText(
            'This task is not linked to a goal yet.'
        );
        await expect(page.getByTestId('task-effect-lesson')).toHaveCount(0);
    });

    test('Today asks at most one review question a day', async ({
        page,
        baseURL,
    }) => {
        const appUrl = baseURL ?? 'http://localhost:8080';
        const api = await start(page, appUrl, 'review');
        for (const title of ['First lesson', 'Second lesson'])
            expect(
                (
                    await api.post(`${appUrl}/api/lessons`, {
                        data: {
                            title,
                            learned_on: '2026-01-01',
                            review_on: '2026-01-15',
                        },
                    })
                ).status()
            ).toBe(201);
        await page.goto(`${appUrl}/today`);
        await expect(page.getByTestId('lesson-review')).toHaveCount(1);
        await expect(page.getByTestId('lesson-review')).toContainText(
            'First lesson'
        );
        const answered = page.waitForResponse(
            (r) => r.url().includes('/checks') && r.status() === 201
        );
        await page.getByTestId('lesson-review-holds').click();
        await answered;
        await page.reload();
        await expect(page.getByTestId('today-heading')).toBeVisible();
        await expect(page.getByTestId('lesson-review')).toHaveCount(0);
    });

    test('Life lists lessons under Vision; the axis layer is off by default', async ({
        page,
        baseURL,
    }) => {
        const appUrl = baseURL ?? 'http://localhost:8080';
        const api = await start(page, appUrl, 'life-lessons');
        await api.post(`${appUrl}/api/lessons`, {
            data: { title: 'Ask early', learned_on: '2025-06-01' },
        });
        await page.goto(`${appUrl}/life`);
        await expect(page.getByTestId('lesson-list')).toContainText(
            'Ask early'
        );
        await expect(page.getByTestId('life-layer-lessons')).not.toBeChecked();
    });
});
