import {
    test,
    expect,
    Page,
    request as playwrightRequest,
} from '@playwright/test';

// Phase 6: the Life tab timeline. Each test gets its own account.

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
    await expect(page).toHaveURL(/\/welcome$/);
    await page.getByTestId('welcome-start').click();
    await expect(page).toHaveURL(/\/today$/);
}

const isoInDays = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const pageScrollsSideways = (page: Page) =>
    page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
    );

test.describe('Phase 6 Life timeline', () => {
    test('milestone and dated goal on the Life tab; goal opens its detail', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(90_000);
        const appUrl = baseURL ?? 'http://localhost:8080';
        await signIn(page, appUrl, await createUser(appUrl, 'life'));
        const api = page.context().request;

        const goalTitle = `Marathon ${Date.now()}`;
        const goal = await api.post(`${appUrl}/api/goals`, {
            data: {
                title: goalTitle,
                horizon: 'year',
                target_date: isoInDays(120),
            },
        });
        expect(goal.ok()).toBeTruthy();

        await page.goto(`${appUrl}/life`);
        await expect(page.getByTestId('life-timeline')).toBeVisible();

        // One milestone through the editor (today's date is the default).
        const title = `Moved city ${Date.now()}`;
        await page.getByTestId('life-add-milestone').click();
        await page.getByTestId('milestone-title-input').fill(title);
        await page.getByTestId('milestone-save-button').click();
        const milestone = page
            .getByTestId('life-timeline')
            .getByRole('button', { name: new RegExp(title) });
        await expect(milestone).toBeVisible();
        const saved = await (await api.get(`${appUrl}/api/milestones`)).json();
        expect(saved.milestones).toEqual([
            expect.objectContaining({
                title,
                date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
                goal_uid: null,
            }),
        ]);

        // A milestone without a goal opens its editor, never a goal page.
        await milestone.click();
        await expect(page.getByTestId('milestone-panel')).toBeVisible();
        await expect(page.getByTestId('milestone-open-goal')).toHaveCount(0);
        await expect(page).toHaveURL(/\/life$/);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('milestone-panel')).toHaveCount(0);

        // Page chrome does not scroll sideways (desktop and phone); the
        // track pans inside its own box.
        expect(await pageScrollsSideways(page)).toBe(false);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(page.getByTestId('life-timeline')).toBeVisible();
        expect(await pageScrollsSideways(page)).toBe(false);
        await page.setViewportSize({ width: 1280, height: 800 });

        // Layer 2: the dated goal opens the existing Goal detail.
        const goalCard = page
            .getByTestId('life-timeline')
            .getByRole('button', { name: new RegExp(goalTitle) });
        await expect(goalCard).toBeVisible();
        await goalCard.click();
        await expect(page).toHaveURL(/\/goal\//);
        await expect(page.getByTestId('goal-title')).toHaveText(goalTitle);
    });

    test.describe('performance', () => {
        // A production build's service worker would answer the request
        // before page.route sees it.
        test.use({ serviceWorkers: 'block' });
        test('zoom with 1000 milestones (desktop frame rate)', async ({
            page,
            baseURL,
        }) => {
            test.setTimeout(90_000);
            const appUrl = baseURL ?? 'http://localhost:8080';
            await signIn(page, appUrl, await createUser(appUrl, 'life-perf'));

            // 1000 milestones over 60 years, served to this page only.
            const start = Date.UTC(1975, 0, 1);
            const step = (60 * 365.25 * 86400000) / 1000;
            const milestones = Array.from({ length: 1000 }, (_, i) => ({
                uid: `perf${i}`,
                title: `Milestone ${i}`,
                date: new Date(start + i * step).toISOString().slice(0, 10),
                date_precision: 'day',
                kind: 'life_event',
                goal_uid: null,
                note: null,
                color: null,
            }));
            await page.route('**/api/milestones', (route) =>
                route.fulfill({ json: { milestones } })
            );
            await page.goto(`${appUrl}/life`);
            await page.getByTestId('life-zoom-decades').click();
            await expect(
                page.getByTestId('life-timeline').getByRole('button').first()
            ).toBeVisible();

            // Zoom in from decades to weeks and back with one wheel event per
            // frame for three seconds, counting rendered frames.
            const result = await page.evaluate(
                () =>
                    new Promise<{ fps: number; p95: number }>((resolve) => {
                        const el = document.querySelector(
                            '[data-testid="life-timeline"]'
                        )!;
                        const rect = el.getBoundingClientRect();
                        const frames: number[] = [];
                        const t0 = performance.now();
                        const tick = (now: number) => {
                            frames.push(now);
                            const elapsed = now - t0;
                            el.dispatchEvent(
                                new WheelEvent('wheel', {
                                    deltaY: elapsed < 1500 ? -60 : 60,
                                    clientX: rect.left + rect.width / 2,
                                    clientY: rect.top + rect.height / 2,
                                    bubbles: true,
                                    cancelable: true,
                                })
                            );
                            if (elapsed < 3000) requestAnimationFrame(tick);
                            else {
                                const gaps = frames
                                    .slice(1)
                                    .map((t, i) => t - frames[i])
                                    .sort((a, b) => a - b);
                                resolve({
                                    fps: (frames.length - 1) / (elapsed / 1000),
                                    p95: gaps[Math.floor(gaps.length * 0.95)],
                                });
                            }
                        };
                        requestAnimationFrame(tick);
                    })
            );
            test.info().annotations.push({
                type: 'zoom-fps',
                description: `${result.fps.toFixed(1)} fps, p95 frame ${result.p95.toFixed(1)} ms`,
            });
            console.log(
                `Life timeline zoom, 1000 milestones: ${result.fps.toFixed(1)} fps, p95 frame ${result.p95.toFixed(1)} ms`
            );
            // A floor, not the 60 fps target: shared CI runners are slow.
            expect(result.fps).toBeGreaterThan(10);
            expect(await pageScrollsSideways(page)).toBe(false);
        });
    });
});
