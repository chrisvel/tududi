const path = require('path');
const express = require('express');
const ejs = require('ejs');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { getPlans } = require('../../config/plans');
const { getConfig } = require('../../config/config');
const { logError } = require('../../services/logService');
const { getStats } = require('./stats');
const waitlist = require('../../services/waitlistService');
const emailService = require('../../services/emailService');
const { createRateLimitStore } = require('../../middleware/rateLimitStore');

// Whether to offer the demo, refreshed in the background so a page render
// never waits on a query. Null until the first check, which reads as "no".
let demoAvailable = null;
let demoCheckedAt = 0;
function demoSnapshot() {
    const demo = require('../demo/service');
    if (!demo.isDemoEnabled()) return null;
    if (Date.now() - demoCheckedAt > 60_000) {
        demoCheckedAt = Date.now();
        demo.demoStatus()
            .then((s) => {
                demoAvailable = s.available;
            })
            .catch(() => {});
    }
    return demoAvailable ? { available: true } : null;
}
const {
    DEFAULT_LOCALE,
    LANG_COOKIE,
    LANG_COOKIE_MAX_AGE,
    LOCALES,
    LOCALE_CODES,
    isSupportedLocale,
    createI18n,
    parseCookies,
    localePath,
    makeLocaleUrl,
    jsonForScript,
} = require('./i18n');

const TEMPLATE = path.join(__dirname, 'views', 'landing.ejs');
const PUBLIC_DIR = path.join(__dirname, 'public');
const RENDER_TTL_MS = 6 * 60 * 60 * 1000;

// Quoted in the proof bar, the AI lede and the meta description. One
// constant so the three can never disagree.
const MCP_TOOL_COUNT = 59;

// The facts the legal pages are written around. Kept here rather than in the
// templates so a change of host, provider or backup schedule is one edit, and
// LEGAL_UPDATED moves with it.
const LEGAL_UPDATED = '3 October 2026';
const LEGAL_OPERATOR = {
    name: 'Chris Veleris',
    location: 'an individual based in Greece',
    country: 'Greece',
    email: 'info@tududi.com',
    host: 'Vultr',
    hostRegion: '',
    aiProvider: 'Our AI model provider',
    backupDays: 30,
    dpaName: 'Hellenic Data Protection Authority',
    dpaUrl: 'https://www.dpa.gr/en',
};
const LEGAL_DOCS = [
    {
        slug: 'terms',
        title: 'Terms of Service',
        description: 'The terms for using tududi Cloud and tududi.com.',
    },
    {
        slug: 'privacy',
        title: 'Privacy Policy',
        description:
            'What personal data tududi Cloud collects, why, and your rights.',
    },
    {
        slug: 'refunds',
        title: 'Refund Policy',
        description: 'Money-back and refund terms for tududi Cloud.',
    },
];

// Google Analytics, loaded only after the visitor consents, and DYNETEQ
// stats need hosts the app's own policy has no reason to allow, so the
// marketing responses carry their own policy in place of helmet's. Every form on the page posts back
// here, hence the bare 'self' form-action.
function buildCsp() {
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://dyneteq.com",
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: https:",
        "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://dyneteq.com",
        "form-action 'self'",
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
    ].join('; ');
}

// Per-IP limit on the waitlist post, backed by the same persistent store the
// rest of the app's rate limiters use so it survives restarts and holds
// across processes. Kept local to this file rather than in
// middleware/rateLimiter.js because its handler needs this route's own
// redirect, not a JSON error body: a request over the limit gets the exact
// same "you're on the list" redirect a real signup gets, just without a row
// to show for it, so a script hammering the form never learns it's being
// throttled (the same rule the capture handler below follows).
function buildWaitlistLimiter() {
    const { rateLimiting } = getConfig();
    return rateLimit({
        store: createRateLimitStore('waitlist'),
        windowMs: rateLimiting.waitlist.windowMs,
        max: rateLimiting.waitlist.max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => !rateLimiting.enabled,
        keyGenerator: (req) => ipKeyGenerator(req.ip),
        handler: (req, res) => {
            const locale = isSupportedLocale(req.body?.locale)
                ? req.body.locale
                : DEFAULT_LOCALE;
            res.redirect(303, `${localePath(locale)}?joined=1#waitlist`);
        },
    });
}

// Same per-IP window as the waitlist, in its own bucket so a visitor who
// just subscribed can still write in. Over the limit, the sender sees the
// same "message sent" page and nothing goes out, the waitlist's rule again.
function buildContactLimiter() {
    const { rateLimiting } = getConfig();
    return rateLimit({
        store: createRateLimitStore('contact'),
        windowMs: rateLimiting.waitlist.windowMs,
        max: rateLimiting.waitlist.max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => !rateLimiting.enabled,
        keyGenerator: (req) => ipKeyGenerator(req.ip),
        handler: (req, res) => res.redirect(303, '/contact?sent=1'),
    });
}

const CONTACT_LIMITS = { name: 100, message: 5000 };

// The chrome follows the remembered language without setting it, the same
// as the legal pages.
function rememberedLocale(req) {
    const remembered = parseCookies(req.headers.cookie)[LANG_COOKIE];
    return isSupportedLocale(remembered) ? remembered : DEFAULT_LOCALE;
}

function createLandingRouter(landing) {
    const router = express.Router();
    const siteOrigin = landing.siteUrl;
    const localeUrl = makeLocaleUrl(siteOrigin);
    const appUrl = landing.appUrl.replace(/\/$/, '');
    const csp = buildCsp();
    const waitlistLimiter = buildWaitlistLimiter();
    const contactLimiter = buildContactLimiter();
    const cacheRenders = process.env.NODE_ENV === 'production';
    const rendered = new Map();
    const secureCookie = /^https:/.test(siteOrigin);

    // Whole-unit price with the right symbol for the configured currency,
    // so changing TUDUDI_PRICING_JSON's currency changes every price on the
    // page rather than leaving a dollar sign in front of euros.
    const money = (amount) =>
        new Intl.NumberFormat('en', {
            style: 'currency',
            currency: landing.pricing.currency || 'USD',
            maximumFractionDigits: 0,
        }).format(amount);

    // Absolute URL of one page in one locale: '/', '/fr', '/cloud',
    // '/fr/cloud'. localeUrl alone cannot build the sub-pages, since it
    // returns a bare origin for English and no trailing slash for the rest.
    const pageUrl = (locale, suffix = '') =>
        `${siteOrigin.replace(/\/$/, '')}${localePath(locale, suffix)}`;

    async function renderPage(req, res, locale, template, extra = {}) {
        res.cookie(LANG_COOKIE, locale, {
            maxAge: LANG_COOKIE_MAX_AGE,
            httpOnly: true,
            sameSite: 'lax',
            secure: secureCookie,
            path: '/',
        });
        res.setHeader('Content-Security-Policy', csp);
        res.setHeader('Cache-Control', 'public, max-age=300');

        const stats = getStats();
        const i18n = createI18n(locale);
        const plans = getPlans();
        const html = await ejs.renderFile(
            path.join(__dirname, 'views', template),
            {
                i18n,
                locales: LOCALES,
                pricing: landing.pricing,
                // Paid plan only. The free limits in config/plans.js are an
                // internal account state, not something Cloud is sold on, and
                // passing them here once led to a homepage advertising a free
                // tier that does not exist.
                plans: {
                    proStorageGb: Math.round(
                        plans.pro.limits.storage_mb / 1000
                    ),
                },
                appUrl,
                siteOrigin: siteOrigin.replace(/\/$/, ''),
                blogUrl: landing.blogUrl,
                githubStars: stats.githubStars,
                dockerPulls: stats.dockerPulls,
                discordMembers: stats.discordMembers,
                demo: demoSnapshot(),
                mcpToolCount: MCP_TOOL_COUNT,
                localePath,
                localeUrl,
                pageUrl,
                money,
                jsonForScript,
                joined: req.query.joined === '1',
                ...extra,
            },
            { cache: cacheRenders, rmWhitespace: false }
        );
        res.type('html').send(html);
    }

    async function renderLanding(req, res, locale) {
        // Remember the choice so a later bare '/' lands where the visitor
        // left off. Set on English too, otherwise switching back never sticks.
        res.cookie(LANG_COOKIE, locale, {
            maxAge: LANG_COOKIE_MAX_AGE,
            httpOnly: true,
            sameSite: 'lax',
            secure: secureCookie,
            path: '/',
        });
        res.setHeader('Content-Security-Policy', csp);
        res.setHeader('Cache-Control', 'public, max-age=300');

        const stats = getStats();
        const cacheKey = `${locale}:${stats.githubStars}:${stats.dockerPulls}:${stats.discordMembers}`;
        // A cached render is the page without the thank-you, so the visitor
        // who just left their address must not be served one.
        const cached = req.query.joined ? null : rendered.get(cacheKey);
        if (cached && Date.now() - cached.at < RENDER_TTL_MS) {
            return res.type('html').send(cached.html);
        }

        const i18n = createI18n(locale);
        const plans = getPlans();
        const html = await ejs.renderFile(
            TEMPLATE,
            {
                i18n,
                locales: LOCALES,
                pricing: landing.pricing,
                // Paid plan only. The free limits in config/plans.js are an
                // internal account state, not something Cloud is sold on, and
                // passing them here once led to a homepage advertising a free
                // tier that does not exist.
                plans: {
                    proStorageGb: Math.round(
                        plans.pro.limits.storage_mb / 1000
                    ),
                },
                appUrl,
                siteOrigin: siteOrigin.replace(/\/$/, ''),
                blogUrl: landing.blogUrl,
                githubStars: stats.githubStars,
                dockerPulls: stats.dockerPulls,
                discordMembers: stats.discordMembers,
                demo: demoSnapshot(),
                mcpToolCount: MCP_TOOL_COUNT,
                canonicalUrl: localeUrl(locale),
                localePath,
                localeUrl,
                pageUrl,
                money,
                jsonForScript,
                joined: req.query.joined === '1',
            },
            { cache: cacheRenders, rmWhitespace: false }
        );
        if (cacheRenders && !req.query.joined)
            rendered.set(cacheKey, { html, at: Date.now() });
        res.type('html').send(html);
    }

    // Literal paths rather than '/:lang', so nothing outside this list is
    // ever answered with the marketing page.
    const landingPaths = [
        '/',
        ...LOCALE_CODES.filter((c) => c !== DEFAULT_LOCALE).map((c) => `/${c}`),
    ];

    router.get(landingPaths, (req, res, next) => {
        const pathLocale = req.path.replace(/^\/|\/$/g, '');

        if (pathLocale === '') {
            // '?hl=' is the escape hatch the switcher's English entry uses:
            // without it a visitor holding a 'de' cookie could never get
            // back to English.
            const override =
                typeof req.query.hl === 'string' ? req.query.hl : null;
            if (override !== null) {
                const forced = isSupportedLocale(override)
                    ? override
                    : DEFAULT_LOCALE;
                if (forced !== DEFAULT_LOCALE)
                    return res.redirect(302, `/${forced}`);
                return renderLanding(req, res, DEFAULT_LOCALE).catch(next);
            }
            // Cookie only, never Accept-Language: '/' is the canonical
            // English URL and shared links must not change language based on
            // who opens them.
            const remembered = parseCookies(req.headers.cookie)[LANG_COOKIE];
            if (
                isSupportedLocale(remembered) &&
                remembered !== DEFAULT_LOCALE
            ) {
                res.set('Vary', 'Cookie');
                return res.redirect(302, `/${remembered}`);
            }
            return renderLanding(req, res, DEFAULT_LOCALE).catch(next);
        }

        if (req.path.endsWith('/')) return res.redirect(301, `/${pathLocale}`);
        return renderLanding(req, res, pathLocale).catch(next);
    });

    // Waitlist capture. A plain form post on the marketing host itself, so
    // it needs no JavaScript, no CORS and no CSRF token: there is no session
    // here to ride on. The answer is always the same page with ?joined=1,
    // whether the address was new, already on the list or refused, so the
    // form cannot be used to find out who has signed up.
    const waitlistBody = express.urlencoded({ extended: false, limit: '4kb' });
    const WAITLIST_SOURCES = new Set([
        'hero',
        'waitlist',
        'footer',
        'cloud',
        'pricing',
    ]);

    router.post(
        '/waitlist',
        waitlistBody,
        waitlistLimiter,
        async (req, res) => {
            const locale = isSupportedLocale(req.body?.locale)
                ? req.body.locale
                : DEFAULT_LOCALE;
            const back = `${localePath(locale)}?joined=1#waitlist`;
            const source = WAITLIST_SOURCES.has(req.body?.source)
                ? req.body.source
                : 'unknown';

            // A bait field no real visitor sees or fills; a script that fills
            // every input in the form trips it. Same "always looks like
            // success" rule as the limiter above: skip the capture, not the
            // redirect.
            const honeypot =
                typeof req.body?.company === 'string'
                    ? req.body.company.trim()
                    : '';

            if (!honeypot) {
                await waitlist.capture({
                    email: req.body?.email,
                    source,
                    locale,
                    referrer: req.get('referer'),
                    ip: req.ip,
                });
            }
            return res.redirect(303, back);
        }
    );

    // The base language lives at the root, so /en is not a real URL.
    router.get('/en', (req, res) => res.redirect(301, '/'));

    // Why the hosted option exists, and what it costs. Literal paths for
    // the same reason the landing ones are literal.
    const cloudPaths = [
        '/cloud',
        ...LOCALE_CODES.filter((c) => c !== DEFAULT_LOCALE).map(
            (c) => `/${c}/cloud`
        ),
    ];
    router.get(cloudPaths, (req, res, next) => {
        const segments = req.path.split('/').filter(Boolean);
        const locale = segments.length > 1 ? segments[0] : DEFAULT_LOCALE;
        renderPage(req, res, locale, 'cloud.ejs', {
            canonicalUrl: pageUrl(locale, '/cloud'),
        }).catch(next);
    });
    router.get('/en/cloud', (req, res) => res.redirect(301, '/cloud'));

    // Terms, privacy and refunds. English only and one URL each, so there is
    // never a question of which language version is binding. The chrome
    // follows the visitor's remembered language, but the cookie is only
    // read here, never set: opening the terms must not switch the site to
    // English.
    LEGAL_DOCS.forEach((doc) => {
        router.get(`/${doc.slug}`, (req, res, next) => {
            const remembered = parseCookies(req.headers.cookie)[LANG_COOKIE];
            const locale = isSupportedLocale(remembered)
                ? remembered
                : DEFAULT_LOCALE;
            res.setHeader('Content-Security-Policy', csp);
            res.setHeader('Cache-Control', 'public, max-age=300');
            res.set('Vary', 'Cookie');
            ejs.renderFile(
                path.join(__dirname, 'views', 'legal.ejs'),
                {
                    i18n: createI18n(locale),
                    locales: LOCALES,
                    appUrl,
                    blogUrl: landing.blogUrl,
                    demo: demoSnapshot(),
                    localePath,
                    doc,
                    legalDocs: LEGAL_DOCS,
                    legalUpdated: LEGAL_UPDATED,
                    operator: LEGAL_OPERATOR,
                    canonicalUrl: `${siteOrigin.replace(/\/$/, '')}/${doc.slug}`,
                },
                { cache: cacheRenders, rmWhitespace: false }
            )
                .then((html) => res.type('html').send(html))
                .catch(next);
        });
    });

    // Contact form. A plain post like the waitlist, mailed to the operator
    // with the sender as Reply-To so answering is one click. Nothing is
    // stored: if the mail cannot go out, the sender is told so and given the
    // address to write to instead, rather than a success that went nowhere.
    router.get('/contact', (req, res, next) => {
        const locale = rememberedLocale(req);
        res.setHeader('Content-Security-Policy', csp);
        res.setHeader('Cache-Control', 'no-store');
        res.set('Vary', 'Cookie');
        const status = req.query.sent === '1' ? 'sent' : req.query.error;
        ejs.renderFile(
            path.join(__dirname, 'views', 'contact.ejs'),
            {
                i18n: createI18n(locale),
                locales: LOCALES,
                appUrl,
                blogUrl: landing.blogUrl,
                demo: demoSnapshot(),
                localePath,
                operator: LEGAL_OPERATOR,
                limits: CONTACT_LIMITS,
                status: ['sent', 'invalid', 'failed'].includes(status)
                    ? status
                    : null,
                canonicalUrl: `${siteOrigin.replace(/\/$/, '')}/contact`,
            },
            { cache: cacheRenders, rmWhitespace: false }
        )
            .then((html) => res.type('html').send(html))
            .catch(next);
    });

    router.post(
        '/contact',
        express.urlencoded({ extended: false, limit: '16kb' }),
        contactLimiter,
        async (req, res) => {
            const field = (key) =>
                typeof req.body?.[key] === 'string' ? req.body[key].trim() : '';
            if (field('company')) return res.redirect(303, '/contact?sent=1');

            const name = field('name');
            const email = waitlist.normalizeEmail(field('email'));
            const message = field('message');
            if (
                !name ||
                name.length > CONTACT_LIMITS.name ||
                !waitlist.isValidEmail(email) ||
                !message ||
                message.length > CONTACT_LIMITS.message
            ) {
                return res.redirect(303, '/contact?error=invalid');
            }

            // The name goes into a header, so no line breaks survive.
            const safeName = name.replace(/[\r\n]+/g, ' ');
            const result = await emailService.sendEmail({
                to: LEGAL_OPERATOR.email,
                replyTo: `"${safeName.replace(/"/g, "'")}" <${email}>`,
                subject: `[tududi contact] ${safeName}`,
                text: `From: ${safeName} <${email}>\nIP: ${req.ip}\n\n${message}`,
            });
            if (!result.success) {
                logError(
                    new Error(result.reason || 'send failed'),
                    'Contact form message was not sent'
                );
                return res.redirect(303, '/contact?error=failed');
            }
            return res.redirect(303, '/contact?sent=1');
        }
    );

    router.use(
        '/landing-assets',
        express.static(PUBLIC_DIR, { maxAge: '1d', index: false })
    );
    return router;
}

// Splits traffic by hostname. On a marketing host the landing router
// answers; anything it does not know is sent to the same path on the app
// host, so product pages exist on exactly one hostname. API paths pass
// through untouched so health checks work on either name. On every other
// host, or when no marketing host is configured, this is a no-op.
//
// The host list is read on every request rather than at boot so the live
// config object can be changed under test, the way hosted mode is.
function hostSwitch(landing) {
    let router = null;

    return (req, res, next) => {
        const hosts = (landing && landing.hosts) || [];
        if (hosts.length === 0 || !hosts.includes(req.hostname)) return next();
        if (req.path.startsWith('/api/')) return next();

        if (!router) router = createLandingRouter(landing);
        router(req, res, (err) => {
            if (err) return next(err);
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                return res.status(404).end();
            }
            // Same path on the app host. Resolved against the app origin and
            // checked, so a request line like "GET //evil.example" can never
            // turn this into a redirect off-site.
            const appOrigin = new URL(landing.appUrl).origin;
            let target;
            try {
                target = new URL(req.originalUrl, appOrigin);
            } catch {
                return res.status(404).end();
            }
            if (target.origin !== appOrigin) return res.status(404).end();
            res.redirect(301, target.toString());
        });
    };
}

module.exports = { createLandingRouter, hostSwitch, MCP_TOOL_COUNT };
