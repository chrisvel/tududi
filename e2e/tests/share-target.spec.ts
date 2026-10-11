import { test, expect } from '@playwright/test';
import { login } from '../helpers/testHelpers';

// The OS share sheet hands content to the installed PWA as a plain GET
// navigation to the share_target action declared in public/manifest.json:
//   /inbox?title=...&text=...&url=...
// This reproduces that navigation in a real browser.
test.describe('Web Share Target', () => {
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
