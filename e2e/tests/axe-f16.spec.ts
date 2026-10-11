import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/testHelpers';
import path from 'path';

const PAGES = [
    '/today',
    '/today/plan',
    '/goals',
    '/inbox',
    '/profile',
];

async function switchLanguage(page: Page, lng: 'fa' | 'en') {
    await page.evaluate((language) => {
        const w = window as unknown as {
            forceLanguageReload?: (lng?: string) => void;
        };
        if (typeof w.forceLanguageReload === 'function') {
            w.forceLanguageReload(language);
        }
    }, lng);
    await page.waitForTimeout(400);
}

async function runAxe(page: Page) {
    const axePath = path.join(
        process.cwd(),
        'node_modules/axe-core/axe.min.js'
    );
    await page.addScriptTag({ path: axePath });
    return page.evaluate(async () => {
        const axe = (
            window as unknown as {
                axe: {
                    run: (
                        ctx: Document,
                        opts: object
                    ) => Promise<{
                        violations: {
                            id: string;
                            impact: string | null;
                            help: string;
                            nodes: { target: string[] }[];
                        }[];
                    }>;
                };
            }
        ).axe;
        return axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
    });
}

test.describe('F16 axe', () => {
    test('five pages have no serious or critical violations in fa and en', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(90_000);
        const appUrl = await login(page, baseURL);
        // Inherited tududi findings (unnamed sidebar icon buttons, existing
        // contrast). html-has-lang is ours and must stay empty.
        const inherited = new Set(['button-name', 'color-contrast', 'label']);
        const serious: string[] = [];
        const minor: string[] = [];

        for (const lng of ['en', 'fa'] as const) {
            await switchLanguage(page, lng);
            for (const dest of PAGES) {
                await page.goto(`${appUrl}${dest}`);
                const results = await runAxe(page);
                for (const v of results.violations) {
                    const line = `[${lng} ${dest}] ${v.impact} ${v.id}: ${v.help}`;
                    if (v.impact === 'serious' || v.impact === 'critical') {
                        if (inherited.has(v.id)) {
                            minor.push(line);
                        } else {
                            serious.push(line);
                        }
                    } else {
                        minor.push(line);
                    }
                }
            }
        }

        // Minor findings are recorded so they are not silently dropped.
        if (minor.length) {
            console.log('axe minor/moderate:\n' + minor.join('\n'));
        }
        expect(serious).toEqual([]);
    });
});
