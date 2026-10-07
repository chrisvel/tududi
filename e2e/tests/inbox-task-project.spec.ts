import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test.describe('Inbox Task project assignment', () => {
    for (const projectName of ['Personal', 'Home Projects', null]) {
        test(`Add to Task preserves ${projectName || 'no project'}`, async ({
            page,
            baseURL,
        }) => {
            const appUrl = await login(page, baseURL);
            const api = page.context().request;
            const csrfResponse = await api.get(`${appUrl}/api/csrf-token`);
            expect(csrfResponse.ok()).toBeTruthy();
            const { csrfToken } = await csrfResponse.json();
            const headers = { 'x-csrf-token': csrfToken };
            const suffix = `${Date.now()}-${test.info().workerIndex}`;
            const name = `Inbox task ${suffix}`;
            const tagName = `inbox-tag-${suffix}`;
            let project: { uid: string; name: string } | undefined;

            try {
                if (projectName) {
                    const response = await api.post(`${appUrl}/api/project`, {
                        headers,
                        data: { name: `${projectName}${suffix}` },
                    });
                    expect(response.ok()).toBeTruthy();
                    project = await response.json();
                }
                await page.goto(`${appUrl}/inbox`);
                const input = page.getByTestId('quick-capture-input');
                const projectRef = project
                    ? project.name.includes(' ')
                        ? ` +"${project.name}"`
                        : ` +${project.name}`
                    : '';
                const content = `${name}${projectRef} #${tagName}`;
                const analysis = page.waitForResponse(
                    (response) =>
                        response.url().endsWith('/api/inbox/analyze-text') &&
                        response.request().postDataJSON().content === content
                );
                await input.fill(content);
                expect((await analysis).ok()).toBeTruthy();

                const creation = page.waitForResponse(
                    (response) =>
                        response.url().endsWith('/api/task') &&
                        response.request().method() === 'POST'
                );
                await page.getByRole('radio', { name: 'Task' }).click();
                await page.getByTestId('capture-add').click();
                expect((await creation).status()).toBe(201);
                await expect(input).toHaveValue('');

                const tasksResponse = await api.get(`${appUrl}/api/tasks`);
                expect(tasksResponse.ok()).toBeTruthy();
                const { tasks } = await tasksResponse.json();
                const matches = tasks.filter((task) =>
                    task.name.includes(suffix)
                );
                expect(matches).toHaveLength(1);
                expect(matches[0].name).toBe(name);
                expect(matches[0].Project?.uid ?? null).toBe(
                    project?.uid ?? null
                );
                expect(matches[0].tags).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ name: tagName }),
                    ])
                );
            } finally {
                const tasksResponse = await api.get(`${appUrl}/api/tasks`);
                if (tasksResponse.ok()) {
                    const { tasks } = await tasksResponse.json();
                    for (const task of tasks.filter((task) =>
                        task.name.includes(suffix)
                    )) {
                        await api.delete(`${appUrl}/api/task/${task.uid}`, {
                            headers,
                        });
                    }
                }
                if (project) {
                    await api.delete(`${appUrl}/api/project/${project.uid}`, {
                        headers,
                    });
                }
                const tagsResponse = await api.get(`${appUrl}/api/tags`);
                if (tagsResponse.ok()) {
                    for (const tag of await tagsResponse.json()) {
                        if (tag.name === tagName) {
                            await api.delete(`${appUrl}/api/tag/${tag.uid}`, {
                                headers,
                            });
                        }
                    }
                }
            }
        });
    }
});
