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

// Seconds until the caller may try again. resetTime is a Date, so dividing it
// directly gave an epoch timestamp instead of a wait.
const retryAfterSeconds = (req) => {
    const resetTime = req.rateLimit?.resetTime;
    if (!resetTime) return undefined;
    const ms = new Date(resetTime).getTime() - Date.now();
    return Math.max(1, Math.ceil(ms / 1000));
};

// Read-only endpoints the sign-in page calls before anyone is signed in. One
// browser sign-in used to cost about nine anonymous requests, so a team behind
// one NAT address hit the anonymous limit on login (#2015). POST /login keeps
// its own per-IP and per-email limiters.
const API_VERSION = process.env.API_VERSION || 'v1';
const SIGN_IN_PAGE_PATHS = new Set([
    '/current_user',
    '/feature-flags',
    '/registration-status',
    '/oidc/providers',
    '/password-auth-status',
    '/config',
    '/version',
    '/csrf-token',
]);

// The limiter is mounted on /api and on /api/<version>, and a versioned request
// also passes the /api mount, so match on the full path with either prefix cut.
const isSignInPageRequest = (req) => {
    if (req.method !== 'GET') return false;
    let path = `${req.baseUrl || ''}${req.path}`;
    const versioned = `/api/${API_VERSION}/`;
    if (path.startsWith(versioned)) {
        path = path.slice(versioned.length - 1);
    } else if (path.startsWith('/api/')) {
        path = path.slice('/api'.length);
    } else {
        return false;
    }
    if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
    return SIGN_IN_PAGE_PATHS.has(path);
};

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
            retryAfter: retryAfterSeconds(req),
        });
    },
});

// OIDC sign-in (start and callback). Same budget as authLimiter, but only
// failed attempts count, so successful SSO from a shared office IP never
// locks people out (#1716). authLimiter keeps counting every request because
// it also guards registration, where a success is what needs limiting.
const oidcLimiter = rateLimit({
    store: createRateLimitStore('oidc'),
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
            retryAfter: retryAfterSeconds(req),
        });
    },
});

// The two public sign-in link routes (look at a link, use it). Each device
// needs two requests, so a household handing links to several devices would
// use up the strict auth limit at once. The token is 256 random bits, so this
// only has to stop floods, and it counts on its own.
const signInLinkLimiter = rateLimit({
    store: createRateLimitStore('sign-in-link'),
    windowMs: rateLimitConfig.signInLink.windowMs,
    max: rateLimitConfig.signInLink.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many sign-in link requests',
            message:
                'Too many requests from this network. Please try again in a few minutes.',
            retryAfter: retryAfterSeconds(req),
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
                retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
        });
    },
});

const loginEmailLimiter = createAuthEmailLimiter('auth-login-email', {
    skipSuccessfulRequests: true,
});

// New accounts per IP on a hosted instance, on top of authLimiter's attempt
// budget: someone farming trials gets a few accounts a day from one address,
// not one per 15-minute window. Only created accounts count. Self-hosted
// instances skip it, since a household often signs up from one address.
const signupLimiter = rateLimit({
    store: createRateLimitStore('signup'),
    windowMs: rateLimitConfig.signup.windowMs,
    max: rateLimitConfig.signup.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => skipInTest(req) || getConfig().hosted?.enabled !== true,
    skipFailedRequests: true,
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many sign-ups',
            message:
                'Too many accounts were created from this network today. Please try again tomorrow.',
            retryAfter: retryAfterSeconds(req),
        });
    },
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
        // Sign-in page loads are cheap reads and must not use up the budget
        if (isSignInPageRequest(req)) return true;
        // Callers with a session or Bearer credential use the per-identity limiter
        return !!requestIdentity(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of requests. Please try again later.',
            retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
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
            retryAfter: retryAfterSeconds(req),
        });
    },
});

// CalDAV clients authenticate with Basic auth on every request, outside the
// /api limiters. Keyed by IP plus the attempted username so a password
// guess against one account is throttled without blocking a whole office.
// Only failed attempts count so normal sync traffic does not lock users out.
const caldavAuthLimiter = rateLimit({
    store: createRateLimitStore('caldav-auth'),
    windowMs: rateLimitConfig.auth.windowMs,
    max: rateLimitConfig.caldavAuth.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    skipSuccessfulRequests: true,
    // Only failed Basic auth (401) counts. Authenticated DAV sync often
    // returns 404/403/409/412; those must not lock the client out (issue #1716).
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
    keyGenerator: (req) => {
        const username = (req.caldavUsername || '').trim().toLowerCase();
        return `${ipKeyGenerator(req.ip)}|${username}`;
    },
    handler: (req, res) => {
        res.status(429)
            .set('WWW-Authenticate', 'Basic realm="Tududi CalDAV"')
            .json({
                error: 'Too many authentication attempts',
                retryAfter: retryAfterSeconds(req),
            });
    },
});

// Two-factor codes and step-up checks (sign-in code, setup, reverify). Keyed
// by the signed-in or half-signed-in user, else the IP; only failures count.
// The per-user lockout in modules/mfa/service.js holds across sessions too.
const mfaLimiter = rateLimit({
    store: createRateLimitStore('mfa'),
    windowMs: rateLimitConfig.passwordConfirm.windowMs,
    max: rateLimitConfig.passwordConfirm.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const pending = req.session?.pendingMfa?.userId;
        if (pending) return `user:${pending}`;
        return identityOrIpKey(req);
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many attempts. Please try again later.',
            retryAfter: retryAfterSeconds(req),
        });
    },
});

module.exports = {
    caldavAuthLimiter,
    authLimiter,
    oidcLimiter,
    signInLinkLimiter,
    authEmailLimiter,
    loginLimiter,
    loginEmailLimiter,
    signupLimiter,
    bearerFailureLimiter,
    passwordConfirmLimiter,
    mfaLimiter,
    uploadsLimiter,
    requestIdentity,
    authEmailKey,
    isSignInPageRequest,
    retryAfterSeconds,
    apiLimiter,
    authenticatedApiLimiter,
    createResourceLimiter,
    apiKeyManagementLimiter,
};
