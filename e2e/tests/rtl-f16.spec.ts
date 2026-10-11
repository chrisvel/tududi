import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/testHelpers';
import path from 'path';
import fs from 'fs';

const PAGES = [
    { id: 'today', url: '/today' },
    { id: 'plan', url: '/today/plan' },
    { id: 'goals', url: '/goals' },
    { id: 'inbox', url: '/inbox' },
    { id: 'settings', url: '/profile' },
] as const;

const VIEWPORTS = {
    desktop: { width: 1440, height: 900 },
    mobile: { width: 390, height: 844 },
} as const;

const SHOT_DIR = path.join(
    process.cwd(),
    'docs/ltd/phases/phase-3-shots'
);

async function switchLanguage(page: Page, lng: 'fa' | 'en') {
    await page.evaluate((language) => {
        const w = window as unknown as {
            forceLanguageReload?: (lng?: string) => void;
        };
        if (typeof w.forceLanguageReload === 'function') {
            w.forceLanguageReload(language);
        } else {
            localStorage.setItem('i18nextLng', language);
            document.documentElement.lang = language;
            document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
        }
    }, lng);
    await page.waitForFunction(
        (language) => document.documentElement.lang.startsWith(language),
        lng,
        { timeout: 5000 }
    );
}

async function noHorizontalOverflow(page: Page) {
    const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflow).toBe(false);
}

test.describe('F16 RTL shell', () => {
    test('five pages keep dir and do not overflow; en returns to ltr', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(120_000);
        fs.mkdirSync(SHOT_DIR, { recursive: true });
        const appUrl = await login(page, baseURL);

        for (const [vpName, size] of Object.entries(VIEWPORTS)) {
            await page.setViewportSize(size);

            for (const lng of ['fa', 'en'] as const) {
                await switchLanguage(page, lng);
                const expectedDir = lng === 'fa' ? 'rtl' : 'ltr';

                for (const dest of PAGES) {
                    await page.goto(`${appUrl}${dest.url}`);
                    await expect(page.locator('html')).toHaveAttribute(
                        'dir',
                        expectedDir
                    );
                    await noHorizontalOverflow(page);
                    await page.screenshot({
                        path: path.join(
                            SHOT_DIR,
                            `${vpName}-${lng}-${dest.id}.png`
                        ),
                        fullPage: false,
                    });
                }
            }

            // Switching back to en after fa must restore ltr without reload
            await switchLanguage(page, 'fa');
            await switchLanguage(page, 'en');
            await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
        }
    });
});
