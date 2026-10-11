import { test, expect, Page } from '@playwright/test';
import { login } from '../helpers/testHelpers';

async function forceLanguage(page: Page, language: 'en' | 'fa') {
    await page.evaluate((lng) => {
        const app = window as unknown as {
            forceLanguageReload?: (language: string) => void;
        };
        if (app.forceLanguageReload) app.forceLanguageReload(lng);
        else localStorage.setItem('i18nextLng', lng);
    }, language);
    await page.waitForFunction(
        (lng) => document.documentElement.lang.startsWith(lng),
        language
    );
}
async function createGoal(
    page: Page,
    appUrl: string,
    title: string,
    horizon: string,
    parentTitle?: string
) {
    await page.goto(`${appUrl}/goals`);
    await page.getByTestId('new-goal-button').click();
    await page.getByTestId('goal-title-input').fill(title);
    await page
        .getByRole('combobox', { name: 'Horizon', exact: true })
        .selectOption(horizon);
    if (parentTitle)
        await page
            .getByRole('combobox', { name: 'Parent goal', exact: true })
            .selectOption({ label: parentTitle });
    await page.getByLabel('Period start', { exact: true }).fill('2026-01-01');
    await page.getByLabel('Period end', { exact: true }).fill('2026-12-31');
    await page.getByTestId('goal-save-button').click();
    await expect(page.getByTestId('goal-title')).toHaveText(title);
    return page.url();
}

test.describe('Phase 4 planning', () => {
    test('year and season hierarchy, invalid reverse, check-in and Undo, fourth week priority, Persian tree', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(120_000);
        const appUrl = await login(page, baseURL);
        const browserErrors: string[] = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('requestfailed', (request) => {
            const error = request.failure()?.errorText || '';
            if (!error.includes('ERR_ABORTED')) browserErrors.push(error);
        });
        page.on('console', (message) => {
            // The rejected reversed hierarchy intentionally responds with HTTP 400.
            // Self-hosted builds also probe the absent cloud-only billing endpoint.
            const billingProbe =
                message.text().includes('status of 404') &&
                new URL(message.location().url || appUrl).pathname ===
                    '/api/billing';
            if (
                message.type() === 'error' &&
                !message.text().includes('status of 400') &&
                !billingProbe
            )
                browserErrors.push(
                    `${message.text()} (${message.location().url})`
                );
        });
        await forceLanguage(page, 'en');
        const suffix = Date.now();
        const yearTitle = `Year ${suffix}`;
        const seasonTitle = `Season ${suffix}`;
        const yearUrl = await createGoal(page, appUrl, yearTitle, 'year');
        // Select by the option text, which includes the parent's horizon.
        await createGoal(
            page,
            appUrl,
            seasonTitle,
            'season',
            `${yearTitle} (Year)`
        );
        await page.goto(`${appUrl}/goals`);
        const yearNode = page
            .getByTestId('goal-tree')
            .getByRole('link', { name: yearTitle, exact: true });
        await expect(yearNode).toBeVisible();
        const tree = page.getByTestId('goal-tree');
        await tree
            .getByRole('combobox', {
                name: `Parent of ${yearTitle}`,
                exact: true,
            })
            .selectOption({ label: `${seasonTitle} (Season)` });
        const yearCard = yearNode.locator('..').locator('..');
        await yearCard
            .getByRole('button', { name: 'Move', exact: true })
            .click();
        await expect(tree.getByRole('alert')).toContainText(
            /shorter|horizon|cycle/i
        );
        await page.setViewportSize({ width: 1280, height: 1400 });
        const seasonLink = tree.getByRole('link', {
            name: seasonTitle,
            exact: true,
        });
        const seasonCard = seasonLink.locator('..').locator('..');
        await seasonCard
            .locator('[data-goal-drag="true"]')
            .dragTo(
                tree.getByText('Drop here to move to the root', { exact: true })
            );
        await expect(
            tree.getByRole('combobox', {
                name: `Parent of ${seasonTitle}`,
                exact: true,
            })
        ).toHaveValue('');
        await seasonCard.locator('[data-goal-drag="true"]').dragTo(yearNode);
        await expect(
            tree.getByRole('combobox', {
                name: `Parent of ${seasonTitle}`,
                exact: true,
            })
        ).not.toHaveValue('');

        await page.goto(yearUrl);
        await expect(page.getByTestId('goal-progress-O')).toHaveText(
            'Outcome not defined'
        );
        const metricName = `Distance ${suffix}`;
        await page
            .getByRole('textbox', { name: 'Metric name', exact: true })
            .fill(metricName);
        await page
            .getByRole('spinbutton', { name: 'Baseline', exact: true })
            .fill('0');
        await page
            .getByRole('spinbutton', { name: 'Target', exact: true })
            .fill('100');
        await page
            .getByRole('button', { name: 'Add metric', exact: true })
            .click();
        await page
            .getByRole('spinbutton', {
                name: `Value for ${metricName}`,
                exact: true,
            })
            .fill('50');
        await page
            .getByRole('button', { name: 'Check in', exact: true })
            .click();
        await expect(page.getByTestId('goal-progress-O')).toHaveText('50%');
        await expect(page.getByTestId('goal-title')).toHaveText(yearTitle);
        const checkinEntry = page
            .getByRole('region', { name: 'Recent activity and Undo' })
            .locator('div')
            .filter({
                has: page.locator('bdi', { hasText: /^Metric check-in$/ }),
            });
        await checkinEntry
            .getByRole('button', { name: 'Undo', exact: true })
            .click();
        await expect(page.getByTestId('goal-progress-O')).toHaveText('0%');

        await page.goto(`${appUrl}/today/plan`);
        await page
            .getByRole('link', { name: 'Weekly plan', exact: true })
            .click();
        await expect(page.getByTestId('ltd-nav-plan')).toHaveAttribute(
            'aria-current',
            'page'
        );
        for (let i = 1; i <= 4; i++) {
            const title = `Week priority ${suffix}-${i}`;
            await page
                .getByRole('textbox', { name: 'Priority title', exact: true })
                .fill(title);
            await page
                .getByRole('button', { name: 'Add priority', exact: true })
                .click();
            await expect(
                page.getByRole('link', { name: title, exact: true })
            ).toBeVisible();
        }
        await expect(page.getByRole('status')).toHaveText(
            'Would three be enough?'
        );
        await expect(
            page.getByRole('button', { name: 'Add priority', exact: true })
        ).toBeEnabled();
        const treeResponse = await page.request.get(`${appUrl}/api/goals/tree`);
        expect(treeResponse.ok()).toBeTruthy();
        const { goals } = await treeResponse.json();
        const flatten = (nodes: any[]): any[] =>
            nodes.flatMap((node) => [node, ...flatten(node.children)]);
        expect(
            flatten(goals).filter((goal) =>
                goal.title.startsWith(`Week priority ${suffix}`)
            )
        ).toHaveLength(4);
        expect(
            flatten(goals)
                .filter((goal) =>
                    goal.title.startsWith(`Week priority ${suffix}`)
                )
                .every((goal) => goal.horizon === 'week')
        ).toBe(true);
        expect(
            flatten(goals).find((goal) => goal.title === yearTitle).status
        ).toBe('active');

        await forceLanguage(page, 'fa');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${appUrl}/goals`);
        await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
        await expect(
            page
                .getByTestId('goal-tree')
                .getByRole('link', { name: seasonTitle, exact: true })
        ).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1
            )
        ).toBe(true);
        await page.screenshot({
            path: '/tmp/ltd-phase4-fa-tree.png',
            fullPage: false,
        });
        await forceLanguage(page, 'en');
        expect(browserErrors).toEqual([]);
    });
});
