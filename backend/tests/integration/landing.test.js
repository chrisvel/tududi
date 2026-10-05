// Counters are never fetched under test; give the stars chip a number so the
// hero renders as it does in production.
jest.mock('../../modules/landing/stats', () => {
    const actual = jest.requireActual('../../modules/landing/stats');
    return { getStats: () => ({ ...actual.getStats(), githubStars: 1234 }) };
});

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
        // The waitlist posts to the site's own endpoint, not a third party
        expect(res.text).toContain('action="/waitlist"');
        // Every locale, itself included, plus x-default
        const hreflangs = res.text.match(/hreflang="/g) || [];
        expect(hreflangs.length).toBeGreaterThanOrEqual(LOCALES.length + 1);
        expect(res.text).toContain(
            'rel="canonical" href="https://tududi.com/"'
        );
        // Fonts, icons and counters are served from here, so nothing but
        // consented analytics leaves the page.
        expect(res.headers['content-security-policy']).not.toMatch(
            /fonts\.googleapis|fonts\.gstatic|cdnjs|api\.github\.com/
        );
        // Every form on the page posts back here, nowhere else.
        expect(res.headers['content-security-policy']).toContain(
            "form-action 'self';"
        );
    });

    it('loads nothing from third parties until analytics is allowed', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.status).toBe(200);

        expect(res.text).not.toMatch(
            /fonts\.googleapis|fonts\.gstatic|cdnjs\.cloudflare|img\.shields\.io|api\.github\.com/
        );
        expect(res.text).toContain('/landing-assets/fonts/fonts.css');
        // gtag.js is only named inside the loader, never as a script tag.
        expect(res.text).not.toMatch(/<script[^>]+googletagmanager/);
        // DYNETEQ stats is cookieless, so it is the one script that loads
        // without asking, and the policy allows it.
        expect(res.text).toContain(
            '<script defer src="https://dyneteq.com/admin/s.js"></script>'
        );
        expect(res.headers['content-security-policy']).toMatch(
            /script-src [^;]*https:\/\/dyneteq\.com/
        );
        expect(res.headers['content-security-policy']).toMatch(
            /connect-src [^;]*https:\/\/dyneteq\.com/
        );
        expect(res.text).toContain(
            "localStorage.getItem('tududi_analytics') === 'granted'"
        );
        // The banner ships hidden and the script reveals it, with refusing
        // as one click like accepting, and a footer link to reopen it.
        expect(res.text).toMatch(
            /<div class="consent" id="consent"[^>]* hidden>/
        );
        expect(res.text).toContain('data-consent="denied"');
        expect(res.text).toContain('data-consent="granted"');
        expect(res.text).toContain('data-consent-open');
    });

    it('serves the self-hosted fonts and icons', async () => {
        for (const asset of [
            '/landing-assets/fonts/fonts.css',
            '/landing-assets/fonts/inter-latin.woff2',
            '/landing-assets/vendor/fontawesome/css/all.min.css',
            '/landing-assets/vendor/fontawesome/webfonts/fa-solid-900.woff2',
        ]) {
            const res = await request(app).get(asset).set('Host', 'tududi.com');
            expect(res.status).toBe(200);
        }
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

    it('gives the landing and cloud pages a link preview card', async () => {
        for (const path of ['/', '/de', '/cloud']) {
            const res = await request(app).get(path).set('Host', 'tududi.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain(
                '<meta name="twitter:card" content="summary_large_image">'
            );
            expect(res.text).toMatch(
                /<meta property="og:title" content="[^"]+">/
            );
            expect(res.text).toMatch(
                /<meta property="og:description" content="[^"]+">/
            );
            // Crawlers need an absolute image URL; a relative one is ignored.
            expect(res.text).toContain(
                '<meta property="og:image" content="https://tududi.com/landing-assets/og-1.png">'
            );
        }
        const image = await request(app)
            .get('/landing-assets/og-1.png')
            .set('Host', 'tududi.com');
        expect(image.status).toBe(200);
        expect(image.headers['content-type']).toBe('image/png');
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

        // Still reachable further down, on the pricing card and in the footer.
        const belowHero = res.text.slice(
            res.text.indexOf('</section>', heroStart)
        );
        expect(belowHero).toContain('https://github.com/chrisvel/tududi');
    });

    it('sends self-hosters to GitHub instead of a section of its own', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.text).not.toContain('id="self-host"');
        expect(res.text).not.toContain('href="#self-host"');
        expect(res.text).not.toContain('docker pull chrisvel/tududi:latest');
        expect(res.text).not.toContain('id="faq-requirements"');
        expect(res.text).not.toContain('Prefer to run it on your own server?');

        const pricing = res.text.slice(res.text.indexOf('id="pricing"'));
        expect(pricing).toMatch(
            /href="https:\/\/github\.com\/chrisvel\/tududi" class="plan-action"/
        );
    });

    it('quotes a 14-day money-back guarantee and no AI credit count', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.text).toContain('14-day money-back guarantee');
        expect(res.text).not.toContain('30-day');
        expect(res.text).not.toMatch(/AI credits/i);
        const pricing = res.text.slice(
            res.text.indexOf('id="pricing"'),
            res.text.indexOf('class="compare')
        );
        expect(pricing).toContain('AI day planning, MCP, calendar feeds');
    });

    it('walks through capture, planning and Today before the feature grid', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const planAt = res.text.indexOf('id="plan"');
        expect(planAt).toBeGreaterThan(-1);
        expect(planAt).toBeLessThan(res.text.indexOf('id="features"'));

        const section = res.text.slice(
            planAt,
            res.text.indexOf('</section>', planAt)
        );
        ['capture-light.png', 'plan-light.png', 'today-light.png'].forEach(
            (img) =>
                expect(section).toContain(`/landing-assets/screenshots/${img}`)
        );
        expect(section).toContain('Plan my day, with AI');

        const nav = res.text.slice(
            res.text.indexOf('<div class="nav-wrap">'),
            res.text.indexOf('<section class="hero"')
        );
        const desktop = nav.slice(0, nav.indexOf('id="nav-mobile"'));
        const mobile = nav.slice(nav.indexOf('id="nav-mobile"'));
        expect(desktop.match(/href="#plan"/g)).toHaveLength(1);
        expect(mobile.match(/href="#plan"/g)).toHaveLength(1);
    });

    it('leads the featured cards with capture and planning', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const grid = res.text.slice(
            res.text.indexOf('<div class="feature-grid">'),
            res.text.indexOf('id="feature-rest"')
        );
        expect(grid.match(/class="feature-card[ "]/g)).toHaveLength(8);
        expect(grid).toContain('One box for everything');
        expect(grid).toContain('Plan my day');
        expect(grid).toContain('Today with your calendar');
    });

    it('plays the hero loop with the still as its poster', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.text).toContain(
            'src="/landing-assets/screenshots/hero.mp4"'
        );
        expect(res.text).toContain(
            'poster="/landing-assets/screenshots/hero-light.png"'
        );
        expect(res.text).toContain('prefers-reduced-motion: reduce');
        const video = await request(app)
            .get('/landing-assets/screenshots/hero.mp4')
            .set('Host', 'tududi.com');
        expect(video.status).toBe(200);
        expect(video.headers['content-type']).toMatch(/video\/mp4/);
    });

    it('leads every card with an icon and puts screenshots behind a preview link', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const grid = res.text.slice(
            res.text.indexOf('<div class="feature-grid">'),
            res.text.indexOf('id="feature-rest"')
        );
        expect(grid.match(/class="feature-icon"/g)).toHaveLength(8);
        expect(grid.match(/class="feature-peek"/g)).toHaveLength(8);
        expect(res.text).not.toContain('class="feature-shot"');
        expect(res.text).toContain('id="feature-preview"');

        const cards = res.text.match(/class="feature-card"/g);
        const icons = res.text.match(/class="feature-icon"/g);
        expect(icons).toHaveLength(cards.length);

        const hrefs = [
            ...res.text.matchAll(
                /href="(\/landing-assets\/screenshots\/features\/[^"]+)"/g
            ),
        ].map((m) => m[1]);
        expect(hrefs.length).toBeGreaterThanOrEqual(18);
        for (const href of new Set(hrefs)) {
            const img = await request(app).get(href).set('Host', 'tududi.com');
            expect(img.status).toBe(200);
        }
    });

    it('has no Resources menu in the nav or the footer', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.text).not.toContain('>Resources<');
        expect(res.text).not.toContain(
            'https://docs.tududi.com" class="nav-link"'
        );
        expect(res.text).not.toContain('github.com/users/chrisvel/projects/2');
    });

    it('serves the new screenshots', async () => {
        for (const img of [
            'capture-light.png',
            'plan-light.png',
            'today-light.png',
        ]) {
            const res = await request(app)
                .get(`/landing-assets/screenshots/${img}`)
                .set('Host', 'tududi.com');
            expect(res.status).toBe(200);
        }
    });

    it('compares Cloud with Todoist, TickTick and Notion, not self-hosting', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const at = res.text.indexOf('class="compare compare-vendors"');
        expect(at).toBeGreaterThan(-1);
        const table = res.text.slice(
            at,
            res.text.indexOf('compare-footnote', at)
        );
        [
            'tududi Cloud',
            'Todoist Pro',
            'TickTick Premium',
            'Notion Plus',
        ].forEach((vendor) => expect(table).toContain(vendor));
        expect(table).not.toContain('Self-host');
        [
            'Eisenhower matrix',
            'Capture from Telegram',
            'CalDAV task sync',
        ].forEach((row) => expect(table).toContain(row));
        expect(res.text).toContain('from their public pricing pages');
    });

    it('shows no MCP config code and no Daily Brief', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        expect(res.text).not.toContain('mcpServers');
        expect(res.text).not.toContain('claude_desktop_config.json');
        expect(res.text).not.toContain('Daily Brief');
    });

    it('keeps the footer brand free of open source wording', async () => {
        const res = await request(app).get('/').set('Host', 'tududi.com');
        const brandStart = res.text.indexOf('<div class="footer-brand">');
        const brand = res.text.slice(
            brandStart,
            res.text.indexOf('</div>', brandStart)
        );
        expect(brand).not.toMatch(/open|github/i);
        expect(res.text).toContain('href="/contact"');
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

    describe('legal pages', () => {
        it.each([
            ['/terms', 'Terms of Service'],
            ['/privacy', 'Privacy Policy'],
            ['/refunds', 'Refund Policy'],
        ])('serves %s on the landing host', async (url, title) => {
            const res = await request(app).get(url).set('Host', 'tududi.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain(`<h1>${title}</h1>`);
            expect(res.text).toContain(
                `rel="canonical" href="https://tududi.com${url}"`
            );
            expect(res.text).toContain('<article lang="en"');
            expect(res.text).toContain('mailto:info@tududi.com');
            expect(res.headers['content-security-policy']).toBeDefined();
        });

        it('keeps the document English but the chrome in the visitor language, without changing it', async () => {
            const res = await request(app)
                .get('/privacy')
                .set('Host', 'tududi.com')
                .set('Cookie', 'tududi_lang=de');
            expect(res.status).toBe(200);
            expect(res.text).toContain('<html lang="de"');
            expect(res.text).toContain('<h1>Privacy Policy</h1>');
            expect(res.headers['set-cookie']).toBeUndefined();
        });

        it('links every legal page from the footer', async () => {
            const res = await request(app).get('/fr').set('Host', 'tududi.com');
            expect(res.text).toContain('href="/terms"');
            expect(res.text).toContain('href="/privacy"');
            expect(res.text).toContain('href="/refunds"');
            expect(res.text).toContain('Confidentialité');
        });

        it('leaves /terms on the app host to the app', async () => {
            const res = await request(app)
                .get('/terms')
                .set('Host', 'app.tududi.com');
            expect(res.text).not.toContain('<h1>Terms of Service</h1>');
        });
    });

    it('sends /cloud on the app host to the app, not the marketing page', async () => {
        const res = await request(app)
            .get('/cloud')
            .set('Host', 'app.tududi.com');
        expect(res.text).toContain('<div id="root"');
    });

    describe('the release-notes signup', () => {
        const { WaitlistSubscriber } = require('../../models');

        it('stores an address and answers the same way twice', async () => {
            const email = `wait_${Date.now()}@tududi-test.dev`;
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
            const email = `MiXeD_${Date.now()}@Tududi-Test.DEV`;
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
                .send({ email: 'x@tududi-test.dev' });
            expect(res.status).not.toBe(303);
        });

        it('trips the honeypot without showing it', async () => {
            const email = `hp_${Date.now()}@tududi-test.dev`;
            const res = await request(app)
                .post('/waitlist')
                .set('Host', 'tududi.com')
                .type('form')
                .send({
                    email,
                    source: 'hero',
                    locale: 'en',
                    company: 'Acme Bots',
                });
            // Looks exactly like a real signup from the outside.
            expect(res.status).toBe(303);
            expect(res.headers.location).toBe('/?joined=1#waitlist');
            expect(await WaitlistSubscriber.count({ where: { email } })).toBe(
                0
            );
        });

        describe('with the mail server check on', () => {
            const dns = require('dns');
            let mx;

            beforeEach(() => {
                config.waitlist.mxCheck = true;
                mx = jest.spyOn(dns.promises.Resolver.prototype, 'resolveMx');
            });

            afterEach(() => {
                config.waitlist.mxCheck = false;
                jest.restoreAllMocks();
            });

            it('stores an address whose domain takes mail', async () => {
                mx.mockResolvedValue([{ exchange: 'mx.tududi-test.dev' }]);
                const email = `mx_${Date.now()}@tududi-test.dev`;
                await request(app)
                    .post('/waitlist')
                    .set('Host', 'tududi.com')
                    .type('form')
                    .send({ email, source: 'footer' });
                expect(
                    await WaitlistSubscriber.count({ where: { email } })
                ).toBe(1);
            });

            it('says the same thing but stores nothing for a domain with no mail', async () => {
                mx.mockResolvedValue([{ exchange: '' }]);
                const email = `nomx_${Date.now()}@tududi-test.dev`;
                const res = await request(app)
                    .post('/waitlist')
                    .set('Host', 'tududi.com')
                    .type('form')
                    .send({ email, source: 'footer' });
                expect(res.status).toBe(303);
                expect(res.headers.location).toBe('/?joined=1#waitlist');
                expect(
                    await WaitlistSubscriber.count({ where: { email } })
                ).toBe(0);
            });
        });

        describe('rate limiting', () => {
            const originalEnabled = config.rateLimiting.enabled;
            beforeAll(() => {
                config.rateLimiting.enabled = true;
            });
            afterAll(() => {
                config.rateLimiting.enabled = originalEnabled;
            });

            it('stops taking new addresses past the per-IP limit, without saying so', async () => {
                const { max } = config.rateLimiting.waitlist;
                for (let i = 0; i < max; i++) {
                    const res = await request(app)
                        .post('/waitlist')
                        .set('Host', 'tududi.com')
                        .type('form')
                        .send({
                            email: `rl_${Date.now()}_${i}@tududi-test.dev`,
                            source: 'hero',
                        });
                    expect(res.status).toBe(303);
                }

                const overflowEmail = `rl_over_${Date.now()}@tududi-test.dev`;
                const res = await request(app)
                    .post('/waitlist')
                    .set('Host', 'tududi.com')
                    .type('form')
                    .send({ email: overflowEmail, source: 'hero' });
                // Same redirect a real signup gets: status alone can't tell
                // "throttled" apart from "accepted", by design.
                expect(res.status).toBe(303);
                expect(res.headers.location).toBe('/?joined=1#waitlist');
                expect(
                    await WaitlistSubscriber.count({
                        where: { email: overflowEmail },
                    })
                ).toBe(0);
            });
        });
    });

    describe('the contact form', () => {
        const emailService = require('../../services/emailService');
        let send;

        beforeEach(() => {
            send = jest
                .spyOn(emailService, 'sendEmail')
                .mockResolvedValue({ success: true });
        });

        afterEach(() => send.mockRestore());

        const post = (body) =>
            request(app)
                .post('/contact')
                .set('Host', 'tududi.com')
                .type('form')
                .send(body);

        it('serves the form on the landing host', async () => {
            const res = await request(app)
                .get('/contact')
                .set('Host', 'tududi.com');
            expect(res.status).toBe(200);
            expect(res.text).toContain('action="/contact"');
            expect(res.text).toContain('name="message"');
            expect(res.text).toContain('class="hp-field"');
        });

        it('mails the operator with the sender as reply-to', async () => {
            const res = await post({
                name: 'Ada\r\nBcc: x@evil.test',
                email: 'Ada@Gmail.com',
                message: 'Hello there',
            });
            expect(res.status).toBe(303);
            expect(res.headers.location).toBe('/contact?sent=1');
            expect(send).toHaveBeenCalledTimes(1);
            const mail = send.mock.calls[0][0];
            expect(mail.to).toBe('info@tududi.com');
            expect(mail.replyTo).toBe('"Ada Bcc: x@evil.test" <ada@gmail.com>');
            expect(mail.subject).not.toMatch(/[\r\n]/);
            expect(mail.text).toContain('Hello there');

            const page = await request(app)
                .get(res.headers.location)
                .set('Host', 'tududi.com');
            expect(page.text).toContain('data-testid="contact-sent"');
        });

        it('rejects a missing message or a bad address without sending', async () => {
            const noMessage = await post({
                name: 'Ada',
                email: 'ada@gmail.com',
                message: '  ',
            });
            const badEmail = await post({
                name: 'Ada',
                email: 'nope',
                message: 'Hi',
            });
            expect(noMessage.headers.location).toBe('/contact?error=invalid');
            expect(badEmail.headers.location).toBe('/contact?error=invalid');
            expect(send).not.toHaveBeenCalled();
        });

        it('says so when the mail cannot go out', async () => {
            send.mockResolvedValue({ success: false, reason: 'down' });
            const res = await post({
                name: 'Ada',
                email: 'ada@gmail.com',
                message: 'Hi',
            });
            expect(res.headers.location).toBe('/contact?error=failed');
            const page = await request(app)
                .get(res.headers.location)
                .set('Host', 'tududi.com');
            expect(page.text).toContain('mailto:info@tududi.com');
        });

        it('trips the honeypot without sending or saying so', async () => {
            const res = await post({
                company: 'Acme',
                name: 'Bot',
                email: 'bot@gmail.com',
                message: 'spam',
            });
            expect(res.headers.location).toBe('/contact?sent=1');
            expect(send).not.toHaveBeenCalled();
        });
    });

    describe('with Cloud open', () => {
        it('announces it in the hero, linking to the Cloud page', async () => {
            const res = await request(app).get('/').set('Host', 'tududi.com');
            expect(res.text).toContain('data-testid="cloud-open-badge"');
            expect(res.text).toContain('tududi Cloud is now open');
            const fr = await request(app).get('/fr').set('Host', 'tududi.com');
            expect(fr.text).toMatch(
                /href="\/fr\/cloud" class="hero-badge hero-badge-launch"/
            );
        });

        it('sends every Cloud call to action to registration', async () => {
            for (const path of ['/', '/cloud', '/de', '/de/cloud']) {
                const res = await request(app)
                    .get(path)
                    .set('Host', 'tududi.com');
                expect(res.text).toContain('https://app.tududi.com/register');
                expect(res.text).not.toContain('href="#waitlist"');
            }
        });

        it('has no waitlist or opening-soon copy left', async () => {
            const res = await request(app).get('/').set('Host', 'tududi.com');
            expect(res.text).not.toMatch(/opening soon|Opening in a few days/i);
            expect(res.text).not.toContain('Notify me');
            expect(res.text).not.toContain('Join the waitlist');
            expect(res.text).not.toContain('when Cloud opens');
            expect(res.text).not.toContain('value="pricing"');
        });

        it('hides the honeypot without pushing a right-to-left page wide', async () => {
            const res = await request(app).get('/ar').set('Host', 'tududi.com');
            expect(res.text).toContain('name="company"');
            expect(res.text).toContain('class="hp-field"');
            expect(res.text).not.toContain('left:-9999px');
        });

        it('offers news and updates in the signup section', async () => {
            const res = await request(app).get('/').set('Host', 'tududi.com');
            const section = res.text.slice(
                res.text.indexOf('<section class="waitlist"')
            );
            expect(section).toContain('News and updates by email');
            expect(section).toContain('only to send news and updates');
        });

        it('confirms a news signup, not a waitlist place', async () => {
            await request(app).get('/').set('Host', 'tududi.com');
            const res = await request(app)
                .get('/?joined=1')
                .set('Host', 'tududi.com');
            expect(res.text).toContain('data-testid="waitlist-joined"');
            expect(res.text).toContain(
                'You are subscribed. News and updates will arrive by email.'
            );
            expect(res.text).not.toContain('when tududi Cloud opens');
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
            ).toHaveLength(6);
            expect(i18n.t('faq.items.freePlan.q')).not.toBe(
                'faq.items.freePlan.q'
            );
            ['capture', 'plan', 'today'].forEach((step) => {
                expect(catalog.plan.steps[step].title).toBeTruthy();
                expect(catalog.plan.steps[step].points).toHaveLength(3);
            });
            expect(catalog.plan.stepLabel).toContain('{{n}}');
            expect(catalog.features.cards.planMyDay.title).toBeTruthy();
            expect(catalog.features.cards.dueDates).toBeUndefined();
        });
    });
});
