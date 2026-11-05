const request = require('supertest');
const app = require('../../app');
const { Role, SiteVisit } = require('../../models');
const { getConfig } = require('../../config/config');
const visitService = require('../../services/visitService');
const { createTestUser } = require('../helpers/testUtils');

const HTML = 'text/html,application/xhtml+xml';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Firefox/130.0';
const SAFARI = 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Safari/605.1.15';

// The tracker writes after the response has gone out, so a test has to wait
// for the row it expects rather than read straight away.
async function settle(expected) {
    for (let i = 0; i < 50; i++) {
        if ((await SiteVisit.count()) >= expected) break;
        await new Promise((r) => setTimeout(r, 20));
    }
    // A little longer, so a row that should not exist has time to appear.
    await new Promise((r) => setTimeout(r, 60));
}

describe('Visit tracking', () => {
    const config = getConfig();
    const original = { landing: { ...config.landing } };

    beforeAll(() => {
        config.landing.hosts = ['untangle.test'];
        config.landing.siteUrl = 'https://untangle.test';
        config.landing.appUrl = 'https://app.untangle.test';
    });

    afterAll(() => {
        Object.assign(config.landing, original.landing);
    });

    beforeEach(async () => {
        await SiteVisit.destroy({ where: {} });
    });

    const page = (path, headers = {}) =>
        request(app)
            .get(path)
            .set('Host', 'untangle.test')
            .set('Accept', HTML)
            .set('User-Agent', FIREFOX)
            .set(headers);

    it('counts every page view but each person once a day', async () => {
        await page('/cloud');
        await page('/cloud');
        await page('/cloud', { 'User-Agent': SAFARI });
        await settle(3);

        const rows = await SiteVisit.findAll({ raw: true });
        expect(rows).toHaveLength(3);
        expect(rows.every((r) => r.surface === 'landing')).toBe(true);
        expect(new Set(rows.map((r) => r.visitor_hash)).size).toBe(2);
        expect(rows[0].path).toBe('/cloud');
        expect(rows[0].user_id).toBeNull();
    });

    it('records where a visitor came from, never the page query', async () => {
        await page('/?utm_source=x', {
            Referer: 'https://www.news.example/story?id=1',
        });
        await page('/cloud', { Referer: 'https://untangle.test/' });
        await settle(2);

        const rows = await SiteVisit.findAll({ order: ['id'], raw: true });
        expect(rows.map((r) => r.path)).toEqual(['/', '/cloud']);
        expect(rows.map((r) => r.referrer_host)).toEqual([
            'news.example',
            null,
        ]);
    });

    it('ignores bots, redirects, scripts and non-page requests', async () => {
        await page('/', { 'User-Agent': 'Googlebot/2.1' });
        await page('/', { 'User-Agent': 'curl/8.4.0' });
        await page('/en'); // 301 to '/'
        await page('/no-such-page'); // redirect to the app host
        await page('/robots.txt', { Accept: 'text/plain' });
        await request(app)
            .get('/')
            .set('Host', 'untangle.test')
            .set('User-Agent', FIREFOX); // no Accept: not a navigation
        await page('/', { Purpose: 'prefetch' });
        await settle(1);

        expect(await SiteVisit.count()).toBe(0);
    });

    it('records nothing when tracking is turned off', async () => {
        config.visits.enabled = false;
        try {
            await page('/');
            await settle(1);
            expect(await SiteVisit.count()).toBe(0);
        } finally {
            config.visits.enabled = true;
        }
    });

    it('prunes visits older than the retention window', async () => {
        const old = new Date(Date.now() - 100 * 86400000);
        await SiteVisit.bulkCreate([
            {
                surface: 'landing',
                path: '/',
                visitor_hash: 'a',
                day: old.toISOString().slice(0, 10),
            },
            {
                surface: 'landing',
                path: '/',
                visitor_hash: 'b',
                day: new Date().toISOString().slice(0, 10),
            },
        ]);

        expect(await visitService.prune()).toBe(1);
        expect(await SiteVisit.count()).toBe(1);
    });

    describe('on the admin dashboard', () => {
        const login = async (user) => {
            const agent = request.agent(app);
            await agent
                .post('/api/login')
                .send({ email: user.email, password: 'password123' });
            return agent;
        };

        it('reports views, visitors, pages, referrers and app users', async () => {
            const admin = await createTestUser({
                email: `adm_${Date.now()}@example.com`,
            });
            await Role.update(
                { is_admin: true },
                { where: { user_id: admin.id } }
            );
            const agent = await login(admin);

            await page('/cloud', { Referer: 'https://news.example/' });
            await page('/cloud', { 'User-Agent': SAFARI });
            await page('/');
            // The app, opened signed in, on the app host
            await agent
                .get('/today')
                .set('Accept', HTML)
                .set('User-Agent', FIREFOX);
            await settle(4);

            const res = await agent.get('/api/admin/overview');
            expect(res.status).toBe(200);
            const { visits, tasks } = res.body.trends;

            expect(visits.landing.views.last7d).toBe(3);
            expect(visits.landing.views.today).toBe(3);
            expect(visits.landing.visitors.last7d).toBe(2);
            expect(visits.landing.visitors.today).toBe(2);
            expect(visits.app.views.last7d).toBe(1);
            expect(visits.days).toHaveLength(14);
            expect(visits.days[13].views).toBe(3);
            expect(visits.top_pages[0]).toEqual({
                surface: 'landing',
                path: '/cloud',
                views: 2,
            });
            expect(visits.top_referrers).toEqual([
                { host: 'news.example', views: 1 },
            ]);
            expect(visits.app_users.dau).toBe(1);
            expect(visits.app_users.mau).toBe(1);
            expect(tasks.created).toEqual({ today: 0, last7d: 0, prev7d: 0 });
        });

        it('leaves visits out when tracking is off', async () => {
            const admin = await createTestUser({
                email: `adm2_${Date.now()}@example.com`,
            });
            await Role.update(
                { is_admin: true },
                { where: { user_id: admin.id } }
            );
            const agent = await login(admin);

            config.visits.enabled = false;
            try {
                const res = await agent.get('/api/admin/overview');
                expect(res.body.trends.visits).toBeNull();
            } finally {
                config.visits.enabled = true;
            }
        });
    });
});
