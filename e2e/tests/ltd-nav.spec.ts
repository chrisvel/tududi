import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

test.describe('T-304 six-destination nav', () => {
    test('desktop bar opens Today, Plan, Goals, Inbox and a More page', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);
        await page.setViewportSize({ width: 1440, height: 900 });

        await page.getByTestId('ltd-nav-today').click();
        await expect(page).toHaveURL(/\/today$/);

        await page.getByTestId('ltd-nav-plan').click();
        await expect(page).toHaveURL(/\/today\/plan/);

        await page.getByTestId('ltd-nav-goals').click();
        await expect(page).toHaveURL(/\/goals/);

        await page.getByTestId('ltd-nav-inbox').click();
        await expect(page).toHaveURL(/\/inbox/);

        // Settings remains reachable from the desktop sidebar (and /profile).
        await page.goto(`${appUrl}/profile`);
        await expect(page).toHaveURL(/\/profile/);
        await expect(page.getByTestId('ltd-nav-desktop')).toBeVisible();
    });

    test('mobile More opens Settings', async ({ page, baseURL }) => {
        await login(page, baseURL);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByTestId('ltd-nav-more').click();
        await page.getByTestId('ltd-nav-more-settings').click();
        await expect(page).toHaveURL(/\/profile/);
    });
});
