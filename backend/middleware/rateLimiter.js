const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { getConfig } = require('../config/config');
const { createRateLimitStore } = require('./rateLimitStore');

const config = getConfig();
const rateLimitConfig = config.rateLimiting;

// Skip rate limiting if disabled in config
const skipInTest = (req) => !rateLimitConfig.enabled;

const getBearerCredential = (req) => {
    const header = req.headers && req.headers.authorization;
    if (typeof header !== 'string') return null;
    const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
    return match ? match[1] : null;
};

// The general limiters are mounted before route-level auth, so
// req.currentUser is not set yet when they run. Identify the caller from what
// is already available: a resolved user (route-level limiters), the session,
// or a hash of the Bearer credential. The credential is not validated here, so
// a made-up token only gets its own bucket; bearerFailureLimiter is what
// throttles invalid tokens.
const requestIdentity = (req) => {
    const userId = req.currentUser?.id || req.session?.userId;
    if (userId) return `user:${userId}`;

    const credential = getBearerCredential(req);
    if (credential) {
        const digest = crypto
            .createHash('sha256')
            .update(credential)
            .digest('hex')
            .slice(0, 32);
        return `token:${digest}`;
    }
    return null;
};

const identityOrIpKey = (req) => requestIdentity(req) || ipKeyGenerator(req.ip);

/**
 * Strict rate limiting for authentication endpoints
 * Prevents brute force attacks on login/register
 */
const authLimiter = rateLimit({
    store: createRateLimitStore('auth'),
    windowMs: rateLimitConfig.auth.windowMs,
    max: rateLimitConfig.auth.max,
    message: {
        error: 'Too many authentication attempts from this IP, please try again after 15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many authentication attempts',
            message:
                'You have exceeded the maximum number of login attempts. Please try again after 15 minutes.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

// Keys login and password-reset attempts by the submitted email address.
// Complements authLimiter (per IP): a distributed attack on one account is
// throttled, and users behind one shared IP do not exhaust each other's
// attempts. Requests without an email fall back to the IP key.
const authEmailKey = (req) => {
    const email = req.body && req.body.email;
    if (typeof email === 'string' && email.trim()) {
        return `email:${email.trim().toLowerCase()}`;
    }
    return ipKeyGenerator(req.ip);
};

const createAuthEmailLimiter = (name, extraOptions = {}) =>
    rateLimit({
        store: createRateLimitStore(name),
        windowMs: rateLimitConfig.authEmail.windowMs,
        max: rateLimitConfig.authEmail.max,
        standardHeaders: true,
        legacyHeaders: false,
        skip: skipInTest,
        keyGenerator: authEmailKey,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too many authentication attempts',
                message:
                    'Too many attempts for this account. Please try again after 15 minutes.',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
            });
        },
        ...extraOptions,
    });

const authEmailLimiter = createAuthEmailLimiter('auth-email');

// Login has its own buckets, separate from register, verify and reset, and
// only failed attempts count: a user who signs in successfully does not use
// up the attempts of everyone behind the same IP, and a legitimate user is
// not locked out by their own successful logins.
const loginLimiter = rateLimit({
    store: createRateLimitStore('auth-login'),
    windowMs: rateLimitConfig.auth.windowMs,
    max: rateLimitConfig.auth.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    skipSuccessfulRequests: true,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many authentication attempts',
            message:
                'You have exceeded the maximum number of login attempts. Please try again after 15 minutes.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

const loginEmailLimiter = createAuthEmailLimiter('auth-login-email', {
    skipSuccessfulRequests: true,
});

/**
 * General API rate limiting for unauthenticated requests
 */
const apiLimiter = rateLimit({
    store: createRateLimitStore('api'),
    windowMs: rateLimitConfig.api.windowMs,
    max: rateLimitConfig.api.max,
    message: {
        error: 'Too many requests from this IP, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip if rate limiting is disabled
        if (!rateLimitConfig.enabled) return true;
        // Callers with a session or Bearer credential use the per-identity limiter
        return !!requestIdentity(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of requests. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

/**
 * Rate limiting for authenticated API requests
 * More lenient limits for authenticated users
 */
const authenticatedApiLimiter = rateLimit({
    store: createRateLimitStore('api-auth'),
    windowMs: rateLimitConfig.authenticatedApi.windowMs,
    max: rateLimitConfig.authenticatedApi.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: identityOrIpKey,
    // Only apply to authenticated requests or if disabled
    skip: (req) => {
        // Skip if rate limiting is disabled
        if (!rateLimitConfig.enabled) return true;
        // Skip if not authenticated
        return !requestIdentity(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of requests. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

/**
 * Stricter rate limiting for resource creation endpoints
 * Prevents spam and abuse
 */
const createResourceLimiter = rateLimit({
    store: createRateLimitStore('create'),
    windowMs: rateLimitConfig.createResource.windowMs,
    max: rateLimitConfig.createResource.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    keyGenerator: identityOrIpKey,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of resource creation requests. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

/**
 * Rate limiting for API key management endpoints
 * Very strict to prevent abuse
 */
const apiKeyManagementLimiter = rateLimit({
    store: createRateLimitStore('api-keys'),
    windowMs: rateLimitConfig.apiKeyManagement.windowMs,
    max: rateLimitConfig.apiKeyManagement.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    keyGenerator: identityOrIpKey,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of API key management requests. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

// Invalid Bearer credentials are counted per IP so a script cannot hammer the
// API with guessed tokens (each attempt costs a bcrypt comparison). Only 401
// responses count, so a valid token is never throttled by this limiter and
// browser sessions are skipped entirely.
const bearerFailureLimiter = rateLimit({
    store: createRateLimitStore('bearer-failures'),
    windowMs: rateLimitConfig.auth.windowMs,
    max: rateLimitConfig.bearerFailure.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) =>
        !rateLimitConfig.enabled ||
        !!req.session?.userId ||
        !getBearerCredential(req),
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many failed authentication attempts',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

// Endpoints that confirm or change credentials (change password, update or
// delete the profile) verify the current password, so a stolen session or API
// token could otherwise be used to guess it without limit.
const passwordConfirmLimiter = rateLimit({
    store: createRateLimitStore('password-confirm'),
    windowMs: rateLimitConfig.passwordConfirm.windowMs,
    max: rateLimitConfig.passwordConfirm.max,
    standardHeaders: true,
    legacyHeaders: false,
    // PATCH /profile also carries ordinary settings, so only requests that
    // submit a password are counted.
    skip: (req) =>
        !rateLimitConfig.enabled ||
        !(
            req.body &&
            (req.body.currentPassword ||
                req.body.newPassword ||
                req.body.password)
        ),
    keyGenerator: identityOrIpKey,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'Too many attempts to change account credentials. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

// Uploaded files are gated per file, so this only bounds how fast one user
// can probe filenames. The ceiling is generous because a page of avatars and
// project images issues one request each.
const uploadsLimiter = rateLimit({
    store: createRateLimitStore('uploads'),
    windowMs: rateLimitConfig.uploads.windowMs,
    max: rateLimitConfig.uploads.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    keyGenerator: identityOrIpKey,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of file requests. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

// CalDAV clients authenticate with Basic auth on every request, outside the
// /api limiters. Keyed by IP plus the attempted username so a password
// guess against one account is throttled without blocking a whole office.
const caldavAuthLimiter = rateLimit({
    store: createRateLimitStore('caldav-auth'),
    windowMs: rateLimitConfig.auth.windowMs,
    max: rateLimitConfig.caldavAuth.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    keyGenerator: (req) => {
        const username = (req.caldavUsername || '').trim().toLowerCase();
        return `${ipKeyGenerator(req.ip)}|${username}`;
    },
    handler: (req, res) => {
        res.status(429)
            .set('WWW-Authenticate', 'Basic realm="Tududi CalDAV"')
            .json({
                error: 'Too many authentication attempts',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
            });
    },
});

module.exports = {
    caldavAuthLimiter,
    authLimiter,
    authEmailLimiter,
    loginLimiter,
    loginEmailLimiter,
    bearerFailureLimiter,
    passwordConfirmLimiter,
    uploadsLimiter,
    requestIdentity,
    authEmailKey,
    apiLimiter,
    authenticatedApiLimiter,
    createResourceLimiter,
    apiKeyManagementLimiter,
};
