import {
    test,
    expect,
    Page,
    APIRequestContext,
    request as playwrightRequest,
} from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Phase 10 (T-1002): axe on the eight Life-to-Day surfaces (Today, Plan,
// Goals, Life, Inbox, Focus, Proposals, Settings) in fa and en, on an
// account that has something on every surface, plus the mobile bottom nav.
// Serious and critical findings fail unless they match BASELINE.

const adminEmail = process.env.E2E_EMAIL || 'test@tududi.com';
const adminPassword = process.env.E2E_PASSWORD || 'password123';
const PASSWORD = 'password123';

// Findings that tududi already had on the same page in en, checked against
// the fork base a47c4113 (docs/ltd/phases/PHASE-10.md). Matched on the
// element's markup, so the same rule on a Life-to-Day element still fails.
const BASELINE: [rule: string, markup: string][] = [
    // Sidebar section toggles and add buttons have only an icon.
    ['button-name', 'class="p-2 -m-2 text-gray-400'],
    ['button-name', '<button class="text-gray-400 dark:text-gray-500'],
    // Task status menu and goal row menu buttons have only an icon.
    ['button-name', 'aria-haspopup="menu"'],
    ['button-name', 'opacity-0 group-hover:opacity-100 transition-opacity'],
    // dnd-kit rows are role=button and hold buttons.
    ['nested-interactive', 'data-testid="sortable-agenda-task'],
    ['nested-interactive', 'data-testid="sortable-goal-'],
    ['nested-interactive', 'gap-3 py-3 cursor-pointer" role="button"'],
    // Today's plan progress bar has no name.
    ['aria-progressbar-name', 'h-1 rounded-full bg-gray-200'],
    // The Inbox capture box has a placeholder, not a label.
    ['label', 'data-testid="quick-capture-input"'],
    // The planning tab's inline link is told apart by colour only.
    ['link-in-text-block', 'href="/today/plan"'],
    // Grey secondary text on the grey-100 canvas.
    ['color-contrast', 'tracking-[0.01em] font-semibold uppercase'],
    ['color-contrast', 'font-light italic opacity-60'],
    ['color-contrast', 'text-[12px] text-gray-400'],
    ['color-contrast', 'text-[17px] font-normal text-gray-500'],
    ['color-contrast', 'text-secondary font-normal'],
    ['color-contrast', 'w-12 shrink-0 text-xs font-medium text-secondary'],
    ['color-contrast', '<span class="text-gray-400 dark:text-gray-500">'],
    ['color-contrast', 'absolute -start-14 text-xs text-gray-400'],
    ['color-contrast', 'data-testid="capture-target-'],
    ['color-contrast', 'uppercase tracking-widest text-gray-400'],
];
const inherited = (rule: string, html: string) =>
    BASELINE.some(([id, markup]) => id === rule && html.includes(markup));

type Finding = {
    where: string;
    id: string;
    impact: string;
    help: string;
    nodes: { target: string; html: string; data: unknown }[];
};

async function createUser(appUrl: string): Promise<string> {
    const admin = await playwrightRequest.newContext({ baseURL: appUrl });
    expect(
        (
            await admin.post('/api/login', {
                data: { email: adminEmail, password: adminPassword },
            })
        ).ok()
    ).toBeTruthy();
    const email = `axe-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
    expect(
        (
            await admin.post('/api/admin/users', {
                data: { email, password: PASSWORD },
            })
        ).status()
    ).toBe(201);
    await admin.dispose();
    return email;
}

async function seed(api: APIRequestContext, appUrl: string) {
    const goal = async (data: Record<string, unknown>) => {
        const res = await api.post(`${appUrl}/api/goals`, { data });
        expect(res.status()).toBe(201);
        return (await res.json()).goal;
    };
    const vision = await goal({ title: 'A calm life', horizon: 'vision' });
    const fiveYear = await goal({
        title: 'Work in Spanish',
        horizon: 'five_year',
        parent_goal_uid: vision.uid,
        why: 'Choose where I work',
    });
    const season = await goal({
        title: 'Spanish B1',
        horizon: 'season',
        parent_goal_uid: fiveYear.uid,
    });
    const task = async (data: Record<string, unknown>) =>
        (await (await api.post(`${appUrl}/api/task`, { data })).json()).uid;
    const linked = await task({
        name: 'Spanish practice',
        goal_id: season.id,
        estimated_minutes: 30,
    });
    const later = await task({ name: 'Call the bank', estimated_minutes: 15 });
    await api.put(`${appUrl}/api/daily-plan/today`, {
        data: {
            items: [linked, later].map((uid) => ({
                task_uid: uid,
                start_minute: null,
            })),
        },
    });
    await api.post(`${appUrl}/api/daily-plan/today/start`);
    expect(
        (
            await api.post(`${appUrl}/api/lessons`, {
                data: {
                    title: 'Ask early',
                    if_text: 'I am stuck for ten minutes',
                    then_text: 'I ask for help',
                    links: [{ type: 'goal', uid: season.uid }],
                },
            })
        ).status()
    ).toBe(201);
    expect(
        (
            await api.post(`${appUrl}/api/milestones`, {
                data: { title: 'Moved city', date: '2024-05-01' },
            })
        ).ok()
    ).toBeTruthy();
    await api.post(`${appUrl}/api/inbox`, {
        data: { content: 'Buy a notebook #study' },
    });

    // One pending proposal, made through the MCP endpoint.
    const rpc = await api.post(`${appUrl}/api/mcp`, {
        headers: { Accept: 'application/json, text/event-stream' },
        data: {
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
                name: 'reschedule_tasks',
                arguments: { task_uids: [later], strategy: 'tomorrow' },
            },
        },
    });
    expect(rpc.ok()).toBeTruthy();
    const pending = await (
        await api.get(`${appUrl}/api/proposals?status=pending`)
    ).json();
    expect(pending.proposals.length).toBe(1);
}

async function setLanguage(page: Page, lng: 'fa' | 'en') {
    await page.evaluate((language) => {
        localStorage.setItem('i18nextLng', language);
        const w = window as unknown as {
            forceLanguageReload?: (lng?: string) => void;
        };
        w.forceLanguageReload?.(language);
    }, lng);
    await page.waitForFunction(
        (language) => document.documentElement.lang.startsWith(language),
        lng
    );
}

async function runAxe(page: Page, where: string, context?: string) {
    await page.addScriptTag({
        path: path.join(process.cwd(), 'node_modules/axe-core/axe.min.js'),
    });
    const violations = await page.evaluate(async (ctx) => {
        const axe = (
            window as unknown as {
                axe: {
                    run: (
                        ctx: unknown,
                        opts: object
                    ) => Promise<{
                        violations: {
                            id: string;
                            impact: string | null;
                            help: string;
                            nodes: {
                                target: string[];
                                html: string;
                                any: { data?: unknown }[];
                            }[];
                        }[];
                    }>;
                };
            }
        ).axe;
        const result = await axe.run(ctx ?? document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
        });
        return result.violations
            .filter((v) => v.impact === 'serious' || v.impact === 'critical')
            .map((v) => ({
                id: v.id,
                impact: v.impact as string,
                help: v.help,
                nodes: v.nodes.map((n) => ({
                    target: n.target.join(' '),
                    html: n.html.slice(0, 300),
                    data: n.any[0]?.data ?? null,
                })),
            }));
    }, context);
    return violations.map((v) => ({ where, ...v }));
}

// Every visible button and link in the region is at least 44 x 44 px.
async function smallTargets(page: Page, selector: string) {
    return page.$$eval(`${selector} :is(a, button)`, (buttons) =>
        buttons
            .map((b) => ({ b, r: b.getBoundingClientRect() }))
            .filter(({ r }) => r.width > 0 && r.height > 0)
            .filter(({ r }) => r.width < 44 || r.height < 44)
            .map(
                ({ b, r }) =>
                    `${b.getAttribute('data-testid') || b.textContent?.trim()} ${Math.round(r.width)}x${Math.round(r.height)}`
            )
    );
}

const SURFACES: {
    name: string;
    url: string;
    ready: string;
    open?: (page: Page) => Promise<void>;
    close?: (page: Page) => Promise<void>;
    scope?: string;
}[] = [
    { name: 'today', url: '/today', ready: 'now-card' },
    { name: 'plan', url: '/today/plan', ready: 'ltd-nav-desktop' },
    { name: 'goals', url: '/goals', ready: 'goal-tree' },
    { name: 'life', url: '/life', ready: 'life-timeline' },
    { name: 'inbox', url: '/inbox', ready: 'quick-capture-input' },
    {
        name: 'focus',
        url: '/today',
        ready: 'now-card',
        open: async (page) => {
            await page.getByTestId('now-card-focus').click();
            await expect(page.getByTestId('focus-mode')).toBeVisible();
        },
        close: async (page) => {
            await page.getByTestId('focus-finish').click();
            await expect(page.getByTestId('focus-mode')).toHaveCount(0);
        },
        scope: '[data-testid="focus-mode"]',
    },
    { name: 'proposals', url: '/proposals', ready: 'ltd-nav-desktop' },
    { name: 'settings', url: '/profile', ready: 'ltd-nav-desktop' },
    {
        name: 'settings-mcp',
        url: '/profile?section=mcp',
        ready: 'ltd-nav-desktop',
    },
    {
        name: 'settings-calendars',
        url: '/profile?section=calendars',
        ready: 'ltd-nav-desktop',
    },
    {
        name: 'settings-planning',
        url: '/profile?section=planning',
        ready: 'ltd-nav-desktop',
    },
];

test.describe('Phase 10 axe', () => {
    test('eight surfaces in fa and en have no new serious or critical findings', async ({
        page,
        baseURL,
    }) => {
        test.setTimeout(180_000);
        const appUrl = baseURL ?? 'http://localhost:8080';
        const email = await createUser(appUrl);
        await page.goto(`${appUrl}/login`);
        await page.getByLabel('Email').fill(email);
        await page.getByLabel('Password').fill(PASSWORD);
        await page.getByRole('button', { name: /login/i }).click();
        await page.getByTestId('welcome-start').click();
        await expect(page).toHaveURL(/\/today$/);
        await seed(page.context().request, appUrl);

        const findings: Finding[] = [];
        const small: string[] = [];
        for (const lng of ['en', 'fa'] as const) {
            await setLanguage(page, lng);
            for (const surface of SURFACES) {
                await page.goto(`${appUrl}${surface.url}`);
                await expect(page.getByTestId(surface.ready)).toBeVisible();
                await page.waitForLoadState('networkidle');
                if (surface.open) await surface.open(page);
                findings.push(
                    ...(await runAxe(
                        page,
                        `${lng} ${surface.name}`,
                        surface.scope
                    ))
                );
                if (surface.scope)
                    small.push(...(await smallTargets(page, surface.scope)));
                if (surface.close) await surface.close(page);
            }

            await page.setViewportSize({ width: 390, height: 844 });
            await page.goto(`${appUrl}/today`);
            await expect(page.getByTestId('ltd-nav-mobile')).toBeVisible();
            await page.waitForLoadState('networkidle');
            const nav = '[data-testid="ltd-nav-mobile"]';
            findings.push(...(await runAxe(page, `${lng} bottom-nav`, nav)));
            small.push(...(await smallTargets(page, nav)));
            await page.getByTestId('ltd-nav-more').click();
            const menu = '[data-testid="ltd-nav-more-menu"]';
            await expect(page.locator(menu)).toBeVisible();
            findings.push(...(await runAxe(page, `${lng} more-menu`, menu)));
            await page.setViewportSize({ width: 1280, height: 800 });
        }

        const out = process.env.AXE_REPORT;
        if (out) fs.writeFileSync(out, JSON.stringify(findings, null, 2));
        const fresh = findings.flatMap((f) =>
            f.nodes
                .filter((n) => !inherited(f.id, n.html))
                .map((n) => `[${f.where}] ${f.impact} ${f.id}: ${n.html}`)
        );
        expect(fresh).toEqual([]);
        expect(small).toEqual([]);
    });
});
