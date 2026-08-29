import { test, expect } from '@playwright/test';

// The OS share sheet hands content to the installed PWA as a plain GET
// navigation to the share_target action declared in public/manifest.json:
//   /inbox?title=...&text=...&url=...
// This reproduces that navigation in a real browser.
test.describe('Web Share Target', () => {
    async function login(page, baseURL) {
        const appUrl =
            baseURL ?? process.env.APP_URL ?? 'http://localhost:8080';
        await page.goto(`${appUrl}/login`);
        await page
            .getByTestId('login-email')
            .fill(process.env.E2E_EMAIL || 'test@tududi.com');
        await page
            .getByTestId('login-password')
            .fill(process.env.E2E_PASSWORD || 'password123');
        await page.getByTestId('login-submit').click();
        await page.waitForURL(/\/(dashboard|today)/, { timeout: 10000 });
        return appUrl;
    }

    test('prefills quick capture from a shared link', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await page.goto(
            `${appUrl}/inbox?title=Great+article&url=https%3A%2F%2Fexample.com%2Fa`
        );

        const composer = page.locator('textarea').first();
        await expect(composer).toHaveValue(
            'Great article https://example.com/a'
        );
    });

    test('prefills quick capture from shared plain text', async ({
        page,
        baseURL,
    }) => {
        const appUrl = await login(page, baseURL);

        await page.goto(`${appUrl}/inbox?text=Buy+milk`);

        const composer = page.locator('textarea').first();
        await expect(composer).toHaveValue('Buy milk');
    });
});
