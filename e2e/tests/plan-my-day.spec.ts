import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test.describe('Plan my day', () => {
    test('plans a task, starts the day and marks it done', async ({
        page,
        context,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);
        const name = `Plan me ${Date.now()}`;

        // Start from an empty day: other tests share this user.
        await context.request.delete(`${appUrl}/api/daily-plan/today`);

        const today = await page.evaluate(() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
        const created = await context.request.post(`${appUrl}/api/task`, {
            data: { name, due_date: today, estimated_minutes: 60 },
        });
        expect(created.ok()).toBeTruthy();
        const task = await created.json();

        await page.goto(`${appUrl}/today`);
        await expect(page.getByTestId('today-unplanned')).toBeVisible();

        await page.getByTestId('plan-your-day').click();
        await expect(page).toHaveURL(/\/today\/plan$/);

        const card = page.getByTestId(`candidate-${task.uid}`);
        await expect(card).toBeVisible({ timeout: 10000 });
        await page.getByTestId(`add-${task.uid}`).click();

        // It takes the next free slot, or the untimed tray late in the day,
        // with the task's 1h estimate either way.
        await expect(card).toContainText('Planned');
        await expect(page.getByTestId('capacity')).toContainText('1h planned');

        await page.getByTestId('start-my-day').click();
        await expect(page).toHaveURL(/\/today$/);

        const agenda = page.getByTestId('agenda-list');
        await expect(agenda).toContainText(name);
        await expect(page.getByTestId('now-card')).toContainText(name);

        await page.getByTestId('now-card-done').click();
        await expect(
            page.getByText('Everything you planned is done')
        ).toBeVisible();

        // The classic page is still one click away.
        await page.goto(`${appUrl}/today_legacy`);
        await expect(page.getByRole('heading', { name: 'Today,' })).toBeVisible(
            {
                timeout: 10000,
            }
        );

        await context.request.delete(`${appUrl}/api/daily-plan/today`);
    });
});
