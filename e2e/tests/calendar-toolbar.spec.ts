import { test, expect } from '@playwright/test';

// The calendar header must fit a phone in French, where the labels are longer
// than in English. The Today button and the next arrow used to run off the right edge.
test.describe('Calendar toolbar on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('keeps Today and the next arrow on screen in French', async ({
        page,
        baseURL,
    }) => {
        await page.goto(`${baseURL}/login`);
        await page
            .getByTestId('login-email')
            .fill(process.env.E2E_EMAIL || 'test@tududi.com');
        await page
            .getByTestId('login-password')
            .fill(process.env.E2E_PASSWORD || 'password123');
        await page.getByTestId('login-submit').click();
        await page.waitForURL(/\/(dashboard|today|welcome)/, {
            timeout: 15000,
        });

        // A new account lands on the welcome page first; finish it so the calendar opens.
        await page.goto(`${baseURL}/welcome`);
        const welcomeStart = page.getByTestId('welcome-start');
        if (await welcomeStart.isVisible().catch(() => false)) {
            await welcomeStart.click();
            await page.waitForURL(/\/today/, { timeout: 15000 });
        }

        await page.goto(`${baseURL}/calendar?lng=fr`);
        const today = page.getByRole('button', { name: /Aujourd/ });
        await expect(today).toBeVisible();
        const next = today.locator('xpath=following-sibling::button[1]');

        const viewportWidth = page.viewportSize()!.width;
        for (const control of [today, next]) {
            const box = await control.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth);
        }
    });
});
