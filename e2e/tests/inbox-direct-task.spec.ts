import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test.describe('Direct Inbox task capture', () => {
    for (const mode of ['desktop Enter', 'desktop button', 'mobile button']) {
        test(`creates a linked task using ${mode}`, async ({
            page,
            baseURL,
        }) => {
            if (mode.startsWith('mobile')) {
                await page.setViewportSize({ width: 390, height: 844 });
            }
            const appUrl = await login(page, baseURL);
            const api = page.context().request;
            const { csrfToken } = await (
                await api.get(`${appUrl}/api/csrf-token`)
            ).json();
            const headers = { 'x-csrf-token': csrfToken };
            const suffix = `${Date.now()}-${test.info().workerIndex}`;
            const name = `My task name ${suffix}`;
            const projectResponse = await api.post(`${appUrl}/api/project`, {
                headers,
                data: { name: `Home Projects ${suffix}` },
            });
            expect(projectResponse.ok()).toBeTruthy();
            const project = await projectResponse.json();
            let taskUid: string | undefined;
            try {
                const before = await (
                    await api.get(`${appUrl}/api/inbox`)
                ).json();
                await page.goto(`${appUrl}/inbox`);
                const input = page.getByTestId('quick-capture-input');
                const content = `${name} +"${project.name}" #errands =Task`;
                await input.fill(content);
                const creation = page.waitForResponse(
                    (response) =>
                        response.url().endsWith('/api/inbox/capture') &&
                        response.request().method() === 'POST'
                );
                if (mode.endsWith('Enter')) await input.press('Enter');
                else await page.getByTestId('capture-add').click();
                const response = await creation;
                expect(response.status()).toBe(201);
                const { kind, task } = await response.json();
                taskUid = task.uid;
                expect(kind).toBe('task');
                expect(task.name).toBe(name);
                expect(task.project_uid).toBe(project.uid);
                expect(task.tags).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'errands' }),
                    ])
                );
                await expect(input).toHaveValue('');
                await expect(page).toHaveURL(`${appUrl}/inbox`);
                const link = page.getByRole('link', { name, exact: true });
                await expect(link).toHaveAttribute('href', `/task/${task.uid}`);
                await page.screenshot({
                    path: test
                        .info()
                        .outputPath(`${mode.replaceAll(' ', '-')}.png`),
                    fullPage: true,
                });

                const replay = await api.post(`${appUrl}/api/inbox/capture`, {
                    headers,
                    data: response.request().postDataJSON(),
                });
                expect((await replay.json()).task.uid).toBe(task.uid);
                const after = await (
                    await api.get(`${appUrl}/api/inbox`)
                ).json();
                expect(after).toHaveLength(before.length);
                const tasks = await (
                    await api.get(`${appUrl}/api/tasks`)
                ).json();
                expect(
                    tasks.tasks.filter((entry) => entry.name === name)
                ).toHaveLength(1);
                await link.click();
                await expect(page).toHaveURL(new RegExp(`/task/${task.uid}`));
            } finally {
                if (taskUid)
                    await api.delete(`${appUrl}/api/task/${taskUid}`, {
                        headers,
                    });
                await api.delete(`${appUrl}/api/project/${project.uid}`, {
                    headers,
                });
            }
        });
    }

    test('keeps rejected input available for correction', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);
        await page.goto(`${appUrl}/inbox`);
        const content = `My task name +Missing-${Date.now()} =Task`;
        const input = page.getByTestId('quick-capture-input');
        await input.fill(content);
        const rejection = page.waitForResponse((response) =>
            response.url().endsWith('/api/inbox/capture')
        );
        await input.press('Enter');
        expect((await rejection).status()).toBe(400);
        await expect(input).toHaveValue(content);
        await expect(
            page.getByText(
                'The referenced project does not exist or you cannot add tasks to it.',
                { exact: true }
            )
        ).toBeVisible();
        await expect(page).toHaveURL(`${appUrl}/inbox`);
    });

    test('queues offline capture and replays it exactly once', async ({
        page,
        baseURL,
        context,
    }) => {
        const appUrl = await login(page, baseURL);
        const api = context.request;
        const { csrfToken } = await (
            await api.get(`${appUrl}/api/csrf-token`)
        ).json();
        const headers = { 'x-csrf-token': csrfToken };
        const name = `Offline capture ${Date.now()}`;
        let taskUid: string | undefined;
        await page.goto(`${appUrl}/inbox`);
        await page.evaluate(async () => {
            await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
            if (!navigator.serviceWorker.controller) {
                await new Promise<void>((resolve) =>
                    navigator.serviceWorker.addEventListener(
                        'controllerchange',
                        () => resolve(),
                        { once: true }
                    )
                );
            }
        });
        try {
            await context.setOffline(true);
            const input = page.getByTestId('quick-capture-input');
            await input.fill(`${name} =Task`);
            const queued = page.waitForResponse((response) =>
                response.url().endsWith('/api/inbox/capture')
            );
            await input.press('Enter');
            expect((await queued).status()).toBe(202);
            await expect(input).toHaveValue('');
            await expect(page.getByText(/Saved offline/)).toBeVisible();
            await expect(
                page.getByRole('link', { name, exact: true })
            ).toHaveCount(0);

            await context.setOffline(false);
            // Exercise the reconnect fallback also when running against the
            // development server, which does not install the PWA automatically.
            await page.evaluate(() =>
                navigator.serviceWorker.controller?.postMessage({
                    type: 'REPLAY_QUEUE',
                })
            );
            await expect
                .poll(async () => {
                    const tasks = await (
                        await api.get(`${appUrl}/api/tasks`)
                    ).json();
                    return tasks.tasks.filter((task) => task.name === name)
                        .length;
                })
                .toBe(1);
            const worker = context
                .serviceWorkers()
                .find((entry) => entry.url().endsWith('/sw.js'))!;
            await worker.evaluate(() =>
                (globalThis as any).replayQueuedRequests()
            );
            const tasks = await (await api.get(`${appUrl}/api/tasks`)).json();
            const matches = tasks.tasks.filter((task) => task.name === name);
            expect(matches).toHaveLength(1);
            taskUid = matches[0].uid;
            const inbox = await (await api.get(`${appUrl}/api/inbox`)).json();
            expect(inbox.some((item) => item.content.includes(name))).toBe(
                false
            );
        } finally {
            await context.setOffline(false);
            if (taskUid)
                await api.delete(`${appUrl}/api/task/${taskUid}`, { headers });
        }
    });
});
