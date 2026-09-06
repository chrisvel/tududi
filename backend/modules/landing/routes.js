const path = require('path');
const express = require('express');
const ejs = require('ejs');
const { getPlans } = require('../../config/plans');
const { getStats } = require('./stats');
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

// The template pulls fonts, icons and analytics from a handful of hosts the
// app's own policy has no reason to allow, so the marketing responses carry
// their own policy in place of helmet's.
function buildCsp(newsletterAction) {
    let formAction = "'self'";
    try {
        if (newsletterAction)
            formAction += ` ${new URL(newsletterAction).origin}`;
    } catch {
        // an unparsable action is rendered nowhere, see renderLanding
    }
    return [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
        "img-src 'self' data: https:",
        "connect-src 'self' https://api.github.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
        `form-action ${formAction}`,
        "frame-src 'none'",
        "object-src 'none'",
        "base-uri 'self'",
    ].join('; ');
}

function isValidUrl(value) {
    try {
        return /^https?:$/.test(new URL(value).protocol);
    } catch {
        return false;
    }
}

function createLandingRouter(landing) {
    const router = express.Router();
    const siteOrigin = landing.siteUrl;
    const localeUrl = makeLocaleUrl(siteOrigin);
    const appUrl = landing.appUrl.replace(/\/$/, '');
    const newsletterAction = isValidUrl(landing.newsletterAction)
        ? landing.newsletterAction
        : null;
    const csp = buildCsp(newsletterAction);
    const cacheRenders = process.env.NODE_ENV === 'production';
    const rendered = new Map();
    const secureCookie = /^https:/.test(siteOrigin);

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
        const cacheKey = `${locale}:${stats.dockerPulls}:${stats.discordMembers}`;
        const cached = rendered.get(cacheKey);
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
                plans: {
                    freeTasks: plans.free.limits.max_tasks,
                    freeProjects: plans.free.limits.max_projects,
                    freeNotes: plans.free.limits.max_notes,
                    freeStorageMb: plans.free.limits.storage_mb,
                    proStorageGb: Math.round(
                        plans.pro.limits.storage_mb / 1000
                    ),
                },
                appUrl,
                newsletterAction,
                dockerPulls: stats.dockerPulls,
                discordMembers: stats.discordMembers,
                demo: null,
                mcpToolCount: MCP_TOOL_COUNT,
                canonicalUrl: localeUrl(locale),
                localePath,
                localeUrl,
                jsonForScript,
            },
            { cache: cacheRenders, rmWhitespace: false }
        );
        if (cacheRenders) rendered.set(cacheKey, { html, at: Date.now() });
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

    // The base language lives at the root, so /en is not a real URL.
    router.get('/en', (req, res) => res.redirect(301, '/'));

    router.use(
        '/landing-assets',
        express.static(PUBLIC_DIR, { maxAge: '1d', index: false })
    );
    router.get('/favicon.ico', (req, res) =>
        res.sendFile(path.join(PUBLIC_DIR, 'favicon.ico'), { maxAge: '1d' })
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
        const appUrl = landing.appUrl.replace(/\/$/, '');
        router(req, res, (err) => {
            if (err) return next(err);
            if (req.method !== 'GET' && req.method !== 'HEAD') {
                return res.status(404).end();
            }
            res.redirect(301, `${appUrl}${req.originalUrl}`);
        });
    };
}

module.exports = { createLandingRouter, hostSwitch, MCP_TOOL_COUNT };
