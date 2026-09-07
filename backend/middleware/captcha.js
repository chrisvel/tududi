'use strict';

const { getConfig } = require('../config/config');
const { logError } = require('../services/logService');

// Bot protection for the forms anyone on the internet can submit:
// registration, password reset and verification resend. Cloudflare
// Turnstile is the provider; it is off unless TURNSTILE_SITE_KEY and
// TURNSTILE_SECRET_KEY are set, so a self-hosted instance never sees it.
//
// The page renders the widget and sends the token as captcha_token in the
// JSON body (or an x-captcha-token header); this verifies it with
// Cloudflare and answers 400 CAPTCHA_FAILED when it is missing or invalid.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

function captchaConfig() {
    return getConfig().captcha || {};
}

function isCaptchaEnabled() {
    const c = captchaConfig();
    return !!(c.siteKey && c.secretKey);
}

// What the public config endpoint exposes so the pages know what to render
function publicCaptchaConfig() {
    if (!isCaptchaEnabled()) return null;
    return { provider: 'turnstile', site_key: captchaConfig().siteKey };
}

async function verifyToken(token, remoteIp) {
    const body = new URLSearchParams({
        secret: captchaConfig().secretKey,
        response: token,
    });
    if (remoteIp) body.set('remoteip', remoteIp);
    const response = await fetch(captchaConfig().verifyUrl || VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!response.ok) {
        throw new Error(`Turnstile verification answered ${response.status}`);
    }
    const result = await response.json();
    return result.success === true;
}

function requireCaptcha(req, res, next) {
    if (!isCaptchaEnabled()) return next();
    const token =
        (req.body && typeof req.body.captcha_token === 'string'
            ? req.body.captcha_token
            : null) ||
        (typeof req.headers['x-captcha-token'] === 'string'
            ? req.headers['x-captcha-token']
            : null);
    if (!token) {
        return res.status(400).json({
            error: 'Please complete the verification and try again.',
            code: 'CAPTCHA_FAILED',
        });
    }
    verifyToken(token, req.ip)
        .then((ok) => {
            if (ok) return next();
            res.status(400).json({
                error: 'Please complete the verification and try again.',
                code: 'CAPTCHA_FAILED',
            });
        })
        .catch((error) => {
            // A Cloudflare outage must not lock the door: log and let the
            // rate limiters do their job for the duration.
            logError(
                'Captcha verification unavailable, letting the request through:',
                error
            );
            next();
        });
}

module.exports = {
    requireCaptcha,
    isCaptchaEnabled,
    publicCaptchaConfig,
    verifyToken,
};
