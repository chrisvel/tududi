'use strict';

// Life-to-Day (T-701): the AS endpoints and the consent screen. Mounted in
// app.js after the session middleware and only when LTD_OAUTH_ENABLED=true
// (G4 finding 4: an always-mounted router broke upstream fake-timer tests).
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { User } = require('../../models');
const { getProvider } = require('./provider');
const { allowedRedirect } = require('./config');

const router = express.Router();

const handle = async (req, res) => (await getProvider()).callback()(req, res);
const escape = (value) =>
    String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// RFC 8414 metadata is the same document as OIDC Discovery.
router.get('/.well-known/oauth-authorization-server', (req, res) => {
    req.url = '/.well-known/openid-configuration';
    return handle(req, res);
});
router.get('/.well-known/openid-configuration', handle);

// DCR is open by design (Claude and ChatGPT register themselves), so it
// only accepts allow-listed redirect URIs and is rate limited.
router.post(
    '/oauth2/reg',
    rateLimit({
        windowMs: 60 * 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
    }),
    (req, res) => {
        const uris = Array.isArray(req.body?.redirect_uris)
            ? req.body.redirect_uris
            : [];
        const bad = uris.filter((uri) => !allowedRedirect(uri));
        if (!uris.length || bad.length) {
            return res.status(400).json({
                error: 'invalid_redirect_uri',
                error_description: `redirect_uri not allowed: ${bad.join(', ') || '(none)'}`,
            });
        }
        return handle(req, res);
    }
);

const TEXT = {
    en: {
        dir: 'ltr',
        title: 'Allow access',
        heading: (name) => `${name} wants to connect to your Life-to-Day`,
        sentTo: 'After you allow it, you will be sent back to',
        scopes: 'It asks to:',
        scope: {
            'ltd.read': 'Read your goals, plans, tasks and calendar busy time',
            'ltd.write':
                'Add to your Inbox and record metric check-ins (you can undo them)',
            'ltd.propose':
                'Propose changes to your plan and goals; nothing changes until you approve',
        },
        allow: 'Allow',
        deny: 'Deny',
        signIn: 'Sign in to Life-to-Day in this browser, then reload this page.',
        signInLink: 'Sign in',
    },
    fa: {
        dir: 'rtl',
        title: 'اجازهٔ دسترسی',
        heading: (name) => `${name} می‌خواهد به Life-to-Day شما وصل شود`,
        sentTo: 'پس از اجازه، به این نشانی برگردانده می‌شوید:',
        scopes: 'درخواست‌ها:',
        scope: {
            'ltd.read': 'خواندن اهداف، برنامه‌ها، کارها و زمان‌های اشغال تقویم',
            'ltd.write': 'افزودن به صندوق ورودی و ثبت سنجه (قابل برگرداندن)',
            'ltd.propose':
                'پیشنهاد تغییر در برنامه و اهداف؛ تا تأیید شما چیزی عوض نمی‌شود',
        },
        allow: 'اجازه بده',
        deny: 'رد کن',
        signIn: 'در همین مرورگر وارد Life-to-Day شوید و سپس این صفحه را دوباره بارگذاری کنید.',
        signInLink: 'ورود',
    },
};

const page = (text, body, csp) => ({
    csp,
    html: `<!doctype html><html lang="${text === TEXT.fa ? 'fa' : 'en'}" dir="${text.dir}"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(text.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#111827}button{padding:.5rem 1rem;margin-inline-end:.5rem;border-radius:.375rem;border:1px solid #d1d5db;background:#fff;cursor:pointer}button.primary{background:#4f46e5;color:#fff;border-color:#4f46e5}strong{font-size:1.1rem}</style>
${body}</html>`,
});

function send(res, { csp, html }) {
    res.set(
        'Content-Security-Policy',
        `default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action ${csp}`
    );
    res.set('Cache-Control', 'no-store');
    return res.send(html);
}

router.get('/oauth2/interaction/:uid', async (req, res, next) => {
    try {
        const provider = await getProvider();
        const details = await provider.interactionDetails(req, res);
        const user = req.session?.userId
            ? await User.findByPk(req.session.userId)
            : null;
        const text = String(user?.language || '').startsWith('fa')
            ? TEXT.fa
            : TEXT.en;
        if (!user) {
            return send(
                res.status(401),
                page(
                    text,
                    `<p>${escape(text.signIn)}</p><p><a href="/login" target="_blank" rel="noopener">${escape(text.signInLink)}</a></p>`,
                    "'none'"
                )
            );
        }
        // Login is the app's own session: finish that prompt silently so the
        // user sees a single consent screen (G4 finding 1).
        if (details.prompt.name === 'login') {
            return provider.interactionFinished(
                req,
                res,
                { login: { accountId: String(user.id) } },
                { mergeWithLastSubmission: false }
            );
        }
        const client = await provider.Client.find(details.params.client_id);
        const redirect = new URL(details.params.redirect_uri);
        const csrf = crypto.randomBytes(24).toString('base64url');
        req.session.ltdOauthConsent = { uid: details.uid, csrf };
        const requested = String(details.params.scope || '')
            .split(' ')
            .filter((scope) => text.scope[scope]);
        const scopes = requested.length ? requested : ['ltd.read'];
        const form = (action, label, primary) =>
            `<form method="post" action="/oauth2/interaction/${escape(details.uid)}/${action}" style="display:inline"><input type="hidden" name="csrf" value="${csrf}"><button${primary ? ' class="primary"' : ''}>${escape(label)}</button></form>`;
        // The redirect leaves this origin after the form post; CSP
        // form-action must allow it (G4 finding 3).
        return send(
            res,
            page(
                text,
                `<h1>${escape(text.heading(client?.clientName || details.params.client_id))}</h1>
<p>${escape(text.sentTo)} <strong dir="ltr">${escape(redirect.host)}</strong></p>
<p>${escape(text.scopes)}</p><ul>${scopes.map((scope) => `<li>${escape(text.scope[scope])}</li>`).join('')}</ul>
${form('confirm', text.allow, true)}${form('abort', text.deny)}`,
                `'self' ${redirect.origin}`
            )
        );
    } catch (err) {
        return next(err);
    }
});

// The consent form carries a one-time token bound to this session and
// interaction, so another site cannot submit it for the user.
function checkConsent(req) {
    const expected = req.session?.ltdOauthConsent;
    const given = String(req.body?.csrf || '');
    if (
        !req.session?.userId ||
        !expected ||
        expected.uid !== req.params.uid ||
        given.length !== expected.csrf.length ||
        !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected.csrf))
    )
        return false;
    delete req.session.ltdOauthConsent;
    return true;
}

router.post('/oauth2/interaction/:uid/confirm', async (req, res, next) => {
    try {
        if (!checkConsent(req)) return res.status(403).send('Forbidden');
        const provider = await getProvider();
        const details = await provider.interactionDetails(req, res);
        const accountId = String(req.session.userId);
        const grant = details.grantId
            ? await provider.Grant.find(details.grantId)
            : new provider.Grant({
                  accountId,
                  clientId: details.params.client_id,
              });
        // Grant exactly what the provider reports missing (oidc-provider's
        // documented pattern); resource scopes stay inside ltd.*.
        const missing = details.prompt.details || {};
        if (missing.missingOIDCScope)
            grant.addOIDCScope(missing.missingOIDCScope.join(' '));
        if (missing.missingOIDCClaims)
            grant.addOIDCClaims(missing.missingOIDCClaims);
        for (const [indicator, scopes] of Object.entries(
            missing.missingResourceScopes || {}
        )) {
            grant.addResourceScope(indicator, scopes.join(' '));
        }
        const grantId = await grant.save();
        return provider.interactionFinished(
            req,
            res,
            { login: { accountId }, consent: { grantId } },
            { mergeWithLastSubmission: false }
        );
    } catch (err) {
        return next(err);
    }
});

router.post('/oauth2/interaction/:uid/abort', async (req, res, next) => {
    try {
        if (!checkConsent(req)) return res.status(403).send('Forbidden');
        const provider = await getProvider();
        return provider.interactionFinished(req, res, {
            error: 'access_denied',
            error_description: 'The user denied access',
        });
    } catch (err) {
        return next(err);
    }
});

// No mount path: oidc-provider derives its resume URLs from req.baseUrl.
router.use((req, res, next) =>
    req.path.startsWith('/oauth2/') ? handle(req, res) : next()
);

module.exports = router;
