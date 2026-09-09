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
    // pricing is a nested object, so the spread above holds the same
    // reference: cloudOpen has to be restored on its own.
    const originalCloudOpen = config.landing.pricing.cloudOpen;

    beforeAll(() => {
        config.landing.hosts = ['tududi.com', 'www.tududi.com'];
        config.landing.siteUrl = 'https://tududi.com';
        config.landing.appUrl = 'https://app.tududi.com';
        // Most of what follows describes the page as it looks once Cloud is
        // selling; the shut state has its own block at the end.
        config.landing.pricing.cloudOpen = true;
    });

    afterAll(() => {
        Object.assign(config.landing, original);
        config.landing.pricing.cloudOpen = originalCloudOpen;
    });

    it('renders the English page on a landing host', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/html/);
        expect(res.text).toContain('<html lang="en"');
        expect(res.text).toContain('https://app.tududi.com/register');
        expect(res.text).toContain('https://app.tududi.com/login');
        // The waitlist posts to the site's own endpoint, not a third party
        expect(res.text).toContain('action="/waitlist"');
        // Every locale, itself included, plus x-default
        const hreflangs = res.text.match(/hreflang="/g) || [];
        expect(hreflangs.length).toBeGreaterThanOrEqual(LOCALES.length + 1);
        expect(res.text).toContain(
            'rel="canonical" href="https://tududi.com/"'
        );
        expect(res.headers['content-security-policy']).toContain(
            'fonts.googleapis.com'
        );
        // Every form on the page posts back here, nowhere else.
        expect(res.headers['content-security-policy']).toContain(
            "form-action 'self';"
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
        // A protocol-relative request line must not become an off-site redirect
        const offsite = await request(app)
            .get('//evil.example/x')
            .set('Host', 'tududi.com');
        expect(offsite.status).toBe(404);
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
            .get('/landing-assets/favicon.ico')
            .set('Host', 'tududi.com');
        expect(icon.status).toBe(200);
    });

    it('serves the cloud page, in English and in other locales', async () => {
        const en = await request(app).get('/cloud').set('Host', 'tududi.com');
        expect(en.status).toBe(200);
        expect(en.text).toContain('https://app.tududi.com/register');
        expect(en.text).toContain(
            'rel="canonical" href="https://tududi.com/cloud"'
        );
        expect(en.text).toContain(
            'hreflang="fr" href="https://tududi.com/fr/cloud"'
        );

        const fr = await request(app)
            .get('/fr/cloud')
            .set('Host', 'tududi.com');
        expect(fr.status).toBe(200);
        expect(fr.text).toContain('<html lang="fr"');

        const alias = await request(app)
            .get('/en/cloud')
            .set('Host', 'tududi.com');
        expect(alias.status).toBe(301);
        expect(alias.headers.location).toBe('/cloud');
    });

    it('makes Cloud signup the only offer in the hero', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const heroStart = res.text.indexOf('<section class="hero"');
        const hero = res.text.slice(
            heroStart,
            res.text.indexOf('</section>', heroStart)
        );

        // The filled button registers, and nothing in the hero links away.
        expect(hero).toContain('https://app.tududi.com/register');

        // Self-hosting and the repository are both near the foot of the page,
        // not peer buttons up here, and the first viewport does not sell the
        // licence. The stars chip stays: it is proof, and it is not a link.
        expect(hero).not.toContain('#self-host');
        expect(hero).not.toContain('github.com/chrisvel');
        expect(hero).not.toMatch(/MIT|open source/i);
        expect(hero).toContain('stars on GitHub');

        // Still reachable further down, in the self-host section and footer.
        const belowHero = res.text.slice(
            res.text.indexOf('</section>', heroStart)
        );
        expect(belowHero).toContain('https://github.com/chrisvel/tududi');
    });

    it('keeps self-hosting reachable, one click in', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');

        // Out of the top row of the navbar, into Resources - in both the
        // desktop dropdown and the mobile sheet - and still in the footer.
        const nav = res.text.slice(
            res.text.indexOf('<div class="nav-wrap">'),
            res.text.indexOf('<section class="hero"')
        );
        expect(nav.match(/href="#self-host"/g)).toHaveLength(2);
        expect(res.text).toContain('id="self-host"');
        expect(res.text).toContain('docker pull chrisvel/tududi:latest');
        expect(res.text).toContain(
            'https://github.com/chrisvel/tududi/blob/main/LICENSE'
        );
    });

    it('flags the Cloud card rather than the self-host one', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const pricing = res.text.slice(
            res.text.indexOf('<section id="pricing"'),
            res.text.indexOf('<section id="faq"')
        );

        // The flag sits inside the card that owns the register link, and the
        // self-host card - which is still $0 - no longer carries it.
        const flagged = pricing.slice(pricing.indexOf('plan-flag'));
        expect(flagged).toContain('https://app.tududi.com/register');
        expect(pricing.match(/plan-flag/g)).toHaveLength(1);

        // Two cards, Cloud first.
        expect(pricing.match(/class="plan /g)).toHaveLength(2);
        expect(pricing.indexOf('plan-featured')).toBeLessThan(
            pricing.indexOf('plan-utility')
        );
    });

    it('never implies Cloud is free or has a trial', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');

        // Scoped to where the offer is actually made. The FAQ says the words
        // "free plan" and "no card" while denying both, so asserting over the
        // whole document would fail on the honest answer.
        // End the hero at its own closing tag: slicing to the proof bar runs
        // through the comment above it, whose "no cards" is about visual style.
        const heroOpen = res.text.indexOf('<section class="hero"');
        const hero = res.text.slice(
            heroOpen,
            res.text.indexOf('</section>', heroOpen)
        );
        const pricingOpen = res.text.indexOf('<section id="pricing"');
        const cloudCard = res.text.slice(
            pricingOpen,
            res.text.indexOf('plan-utility', pricingOpen)
        );
        [hero, cloudCard].forEach((region) => {
            expect(region).not.toMatch(/free (account|plan|tier|trial)/i);
            expect(region).not.toMatch(/start free|\bno card\b/i);
        });

        // The price is on the card, and the FAQ answers the question head on.
        expect(cloudCard).toMatch(/€5/);
        expect(cloudCard).toMatch(/€50/);
        expect(res.text).toContain('Is there a free plan or a trial');

        // Self-hosting is still free, and the page still says so.
        expect(res.text).toMatch(/free, if you run the server yourself/i);
    });

    it('sells no Business Licence anywhere on the page', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');

        // The card, the comparison footnote and the footer link all went
        // together: a lone "Business licence" link under a page that no longer
        // offers one reads as something half-deleted.
        expect(res.text).not.toMatch(/business licence/i);
        expect(res.text).not.toContain('licensing@tududi.com');

        // The question it existed to answer is still answered, in the FAQ.
        expect(res.text).toContain('Can I use tududi at work');
        expect(res.text).toMatch(/MIT licence permits commercial use/);
    });

    it('sends /cloud on the app host to the app, not the marketing page', async () => {
        const res = await request(app)
            .get('/cloud')
            .set('Host', 'app.tududi.com');
        expect(res.text).toContain('<div id="root"');
    });

    describe('the Cloud waitlist', () => {
        const { WaitlistSubscriber } = require('../../models');

        it('stores an address and answers the same way twice', async () => {
            const email = `wait_${Date.now()}@example.com`;
            const first = await request(app)
                .post('/waitlist')
                .set('Host', 'tududi.com')
                .type('form')
                .send({ email, source: 'hero', locale: 'en' });
            expect(first.status).toBe(303);
            expect(first.headers.location).toBe('/?joined=1#waitlist');

            const row = await WaitlistSubscriber.findOne({ where: { email } });
            expect(row.source).toBe('hero');
            expect(row.submission_count).toBe(1);

            // A second go looks identical from outside, so the form cannot
            // be used to test whether an address is already on the list.
            const again = await request(app)
                .post('/waitlist')
                .set('Host', 'tududi.com')
                .type('form')
                .send({ email, source: 'footer', locale: 'en' });
            expect(again.status).toBe(303);
            expect(again.headers.location).toBe(first.headers.location);
            await row.reload();
            expect(row.submission_count).toBe(2);
            expect(await WaitlistSubscriber.count({ where: { email } })).toBe(
                1
            );
        });

        it('lower-cases the address and comes back in the visitor locale', async () => {
            const email = `MiXeD_${Date.now()}@Example.COM`;
            const res = await request(app)
                .post('/waitlist')
                .set('Host', 'tududi.com')
                .type('form')
                .send({ email, source: 'waitlist', locale: 'fr' });
            expect(res.headers.location).toBe('/fr?joined=1#waitlist');
            expect(
                await WaitlistSubscriber.findOne({
                    where: { email: email.toLowerCase() },
                })
            ).not.toBeNull();
        });

        it('says the same thing for a malformed address and stores nothing', async () => {
            const before = await WaitlistSubscriber.count();
            const res = await request(app)
                .post('/waitlist')
                .set('Host', 'tududi.com')
                .type('form')
                .send({ email: 'not-an-email', source: 'hero' });
            expect(res.status).toBe(303);
            expect(res.headers.location).toBe('/?joined=1#waitlist');
            expect(await WaitlistSubscriber.count()).toBe(before);
        });

        it('shows the confirmation instead of the form after joining', async () => {
            const res = await request(app)
                .get('/?joined=1')
                .set('Host', 'tududi.com');
            expect(res.text).toContain('data-testid="waitlist-joined"');
            // The section's own form is replaced by the confirmation; the
            // footer signup stays, so look for that form specifically.
            expect(res.text).not.toContain('value="waitlist"');
        });

        it('is not reachable on the app host', async () => {
            const res = await request(app)
                .post('/waitlist')
                .set('Host', 'app.tududi.com')
                .type('form')
                .send({ email: 'x@example.com' });
            expect(res.status).not.toBe(303);
        });
    });

    describe('while Cloud is shut', () => {
        beforeAll(() => {
            config.landing.pricing.cloudOpen = false;
        });
        afterAll(() => {
            config.landing.pricing.cloudOpen = true;
        });

        it('sends the hero to the waitlist instead of registration', async () => {
            const res = await request(app).get('/').set('Host', 'tududi.com');
            expect(res.text).toContain('href="#waitlist"');
            expect(res.text).toContain('action="/waitlist"');
            expect(res.text).toContain('Join the waitlist');
            expect(res.text).not.toContain('https://app.tududi.com/register');
        });

        it('captures the pricing card address on the site itself', async () => {
            const res = await request(app).get('/').set('Host', 'tududi.com');
            const pricing = res.text.slice(
                res.text.indexOf('<section id="pricing"'),
                res.text.indexOf('<section id="faq"')
            );
            // Its own source, so the two forms can be told apart in the
            // admin list, and it posts here rather than to a mail provider.
            expect(pricing).toContain('action="/waitlist"');
            expect(pricing).toContain('value="pricing"');
            expect(pricing).not.toMatch(/action="https?:/);
        });

        it('stores an address from the pricing card', async () => {
            const email = `pricing_${Date.now()}@example.com`;
            const res = await request(app)
                .post('/waitlist')
                .set('Host', 'tududi.com')
                .type('form')
                .send({ email, source: 'pricing', locale: 'fr' });
            expect(res.status).toBe(303);

            const { WaitlistSubscriber } = require('../../models');
            const row = await WaitlistSubscriber.findOne({ where: { email } });
            expect(row).not.toBeNull();
            expect(row.source).toBe('pricing');
            expect(row.locale).toBe('fr');
        });

        it('answers the joined redirect with the confirmation, not a cached page', async () => {
            await request(app).get('/').set('Host', 'tududi.com');
            const res = await request(app)
                .get('/?joined=1')
                .set('Host', 'tududi.com');
            expect(res.text).toContain('data-testid="waitlist-joined"');
        });
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
                    proStorageGb: 5,
                })
            ).toHaveLength(5);
            expect(i18n.t('faq.items.freePlan.q')).not.toBe(
                'faq.items.freePlan.q'
            );
        });
    });
});
