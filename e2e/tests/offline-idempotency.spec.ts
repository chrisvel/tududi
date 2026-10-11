import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

// T-305 / F17: two creates and one edit, then replay, must yield exactly
// two tasks. Chromium automation often has Background Sync disabled (G5);
// this spec drives the page-side REPLAY_QUEUE path (online / load).

test.describe('T-305 offline task identity', () => {
    test('two creates and one edit replay as exactly two tasks', async ({
        page,
        context,
        baseURL,
    }) => {
        test.setTimeout(60_000);
        // Opt in before the app loads so a late push-only registration cannot
        // replace the full worker while this test waits for page control.
        await context.addInitScript(() =>
            localStorage.setItem('ltd-e2e-full-sw', '1')
        );
        const appUrl = await login(page, baseURL);
        await page.waitForFunction(
            () => {
                const controller = navigator.serviceWorker?.controller;
                return (
                    !!controller && !controller.scriptURL.includes('push-only')
                );
            },
            undefined,
            { timeout: 15000 }
        );
        const stamp = Date.now();
        const nameA = `ltd-off-a-${stamp}`;
        const nameB = `ltd-off-b-${stamp}`;
        const nameBEdited = `ltd-off-b-edited-${stamp}`;

        await context.setOffline(true);

        await page.evaluate(
            async ({ a, b, edited }) => {
                const csrfRes = await fetch('/api/csrf-token', {
                    credentials: 'include',
                }).catch(() => null);
                const csrf = csrfRes
                    ? ((await csrfRes.json()) as { csrfToken?: string })
                          .csrfToken
                    : '';
                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                };
                if (csrf) headers['x-csrf-token'] = csrf;

                const alphabet = '0123456789abcdefghijkmnpqrstuvwxyz';
                const uid = () =>
                    Array.from(
                        { length: 15 },
                        () =>
                            alphabet[
                                Math.floor(Math.random() * alphabet.length)
                            ]
                    ).join('');
                const uidA = uid();
                const uidB = uid();
                const key = (n: string) => `ltd-e2e-${n}-${Date.now()}`;

                const post = (body: object, k: string) =>
                    fetch('/api/task', {
                        method: 'POST',
                        credentials: 'include',
                        headers: { ...headers, 'Idempotency-Key': k },
                        body: JSON.stringify(body),
                    });

                await post({ name: a, uid: uidA }, key('a'));
                await post({ name: b, uid: uidB }, key('b'));
                await fetch(`/api/task/${uidB}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        ...headers,
                        'Idempotency-Key': key('edit'),
                    },
                    body: JSON.stringify({ name: edited }),
                });
            },
            { a: nameA, b: nameB, edited: nameBEdited }
        );

        await context.setOffline(false);
        // G5: Background Sync is disabled in automated Chromium. Drive the
        // page-side replay path that T-305 added for iOS / online / load.
        await page.evaluate(() => {
            const sw = navigator.serviceWorker?.controller;
            sw?.postMessage({ type: 'REPLAY_QUEUE' });
            window.dispatchEvent(new Event('online'));
        });
        // Replay is asynchronous; wait for the persisted result rather than
        // assuming every queued mutation finishes within a fixed delay.
        await expect(async () => {
            const list = await context.request.get(`${appUrl}/api/tasks`);
            expect(list.ok()).toBeTruthy();
            const body = await list.json();
            const tasks = (body.tasks || body) as { name: string }[];
            const ours = tasks.filter((t) =>
                [nameA, nameB, nameBEdited].includes(t.name)
            );
            expect(ours.filter((t) => t.name === nameA).length).toBe(1);
            expect(
                ours.filter((t) => t.name === nameB || t.name === nameBEdited)
                    .length
            ).toBe(1);
            expect(ours).toHaveLength(2);
            expect(ours.some((t) => t.name === nameBEdited)).toBe(true);
        }).toPass({ timeout: 15000 });
    });
});
