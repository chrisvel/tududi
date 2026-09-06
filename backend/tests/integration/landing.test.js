const request = require('supertest');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const { hostSwitch } = require('../../modules/landing/routes');
const {
    preloadCatalogs,
    createI18n,
    LOCALES,
    LOCALE_CODES,
} = require('../../modules/landing/i18n');

// The marketing page is served only on the hostnames in config.landing,
// which the host switch reads on every request, so the live config object
// is changed here and restored after. The rest of the suite runs with the
// list empty and covers the default: every host gets the app shell.
describe('Landing page', () => {
    const config = getConfig();
    const original = { ...config.landing };

    beforeAll(() => {
        config.landing.hosts = ['tududi.com', 'www.tududi.com'];
        config.landing.siteUrl = 'https://tududi.com';
        config.landing.appUrl = 'https://app.tududi.com';
        config.landing.newsletterAction =
            'https://buttondown.com/api/emails/embed-subscribe/tududi';
    });

    afterAll(() => {
        Object.assign(config.landing, original);
    });

    it('renders the English page on a landing host', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
        expect(res.text).toContain('<html lang="en"');
        expect(res.text).toContain('https://app.tududi.com/register');
        expect(res.text).toContain('https://app.tududi.com/login');
        expect(res.text).toContain(
            'action="https://buttondown.com/api/emails/embed-subscribe/tududi"'
        );
        // Every locale, itself included, plus x-default
        const hreflangs = res.text.match(/hreflang="/g) || [];
        expect(hreflangs.length).toBeGreaterThanOrEqual(LOCALES.length + 1);
        expect(res.text).toContain(
            'rel="canonical" href="https://tududi.com/"'
        );
        expect(res.headers['content-security-policy']).toContain(
            'fonts.googleapis.com'
        );
        expect(res.headers['content-security-policy']).toContain(
            "form-action 'self' https://buttondown.com"
        );
    });

    it('renders other locales at their own path', async () => {
        const res = await request(app).get('/fr').set('Host', 'tududi.com');
        expect(res.status).toBe(200);
        expect(res.text).toContain('<html lang="fr"');
        expect(res.text).toContain(
            'rel="canonical" href="https://tududi.com/fr"'
        );
    });

    it('collapses /fr/ and /en onto the canonical URLs', async () => {
        const slash = await request(app).get('/fr/').set('Host', 'tududi.com');
        expect(slash.status).toBe(301);
        expect(slash.headers.location).toBe('/fr');
        const en = await request(app).get('/en').set('Host', 'www.tududi.com');
        expect(en.status).toBe(301);
        expect(en.headers.location).toBe('/');
    });

    it('remembers the language in a cookie and lets ?hl=en override it', async () => {
        const first = await request(app).get('/de').set('Host', 'tududi.com');
        const cookie = first.headers['set-cookie'].find((c) =>
            c.startsWith('tududi_lang=')
        );
        expect(cookie).toContain('tududi_lang=de');
        const back = await request(app)
            .get('/')
            .set('Host', 'tududi.com')
            .set('Cookie', 'tududi_lang=de');
        expect(back.status).toBe(302);
        expect(back.headers.location).toBe('/de');
        expect(back.headers.vary).toContain('Cookie');
        const forced = await request(app)
            .get('/?hl=en')
            .set('Host', 'tududi.com')
            .set('Cookie', 'tududi_lang=de');
        expect(forced.status).toBe(200);
        expect(forced.text).toContain('<html lang="en"');
    });

    it('sends product paths on a landing host to the app', async () => {
        const res = await request(app)
            .get('/login?next=%2Ftoday')
            .set('Host', 'tududi.com');
        expect(res.status).toBe(301);
        expect(res.headers.location).toBe(
            'https://app.tududi.com/login?next=%2Ftoday'
        );
        const post = await request(app)
            .post('/api-keys')
            .set('Host', 'tududi.com');
        expect(post.status).toBe(404);
    });

    it('keeps the API reachable on a landing host', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('Host', 'tududi.com');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('serves the assets and the favicon on the landing host', async () => {
        const logo = await request(app)
            .get('/landing-assets/wide-logo-dark.png')
            .set('Host', 'tududi.com');
        expect(logo.status).toBe(200);
        expect(logo.headers['content-type']).toMatch(/png/);
        const icon = await request(app)
            .get('/favicon.ico')
            .set('Host', 'tududi.com');
        expect(icon.status).toBe(200);
    });

    it('serves the app on every other host', async () => {
        const res = await request(app).get('/').set('Host', 'app.tududi.com');
        expect(res.status).toBe(200);
        expect(res.text).not.toContain('landing-assets');
        expect(res.text).toContain('<div id="root"');
    });

    it('is a no-op when no landing host is configured', () => {
        const next = jest.fn();
        const middleware = hostSwitch({ hosts: [] });
        middleware({ hostname: 'tududi.com', path: '/' }, {}, next);
        expect(next).toHaveBeenCalled();
    });

    it('loads every catalog and carries the Cloud plan in each language', () => {
        expect(() => preloadCatalogs()).not.toThrow();
        LOCALE_CODES.forEach((code) => {
            const i18n = createI18n(code);
            const catalog = require(
                `../../modules/landing/locales/${code}/landing.json`
            );
            expect(catalog.pricing.plans.cloud).toBeDefined();
            expect(catalog.pricing.plans.managed).toBeUndefined();
            expect(
                i18n.tList('pricing.plans.cloud.features', {
                    freeTasks: 200,
                    freeProjects: 10,
                    freeNotes: 50,
                    freeStorageMb: 50,
                    proStorageGb: 5,
                })
            ).toHaveLength(5);
            expect(i18n.t('faq.items.freePlan.q')).not.toBe(
                'faq.items.freePlan.q'
            );
        });
    });
});
