const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { getConfig } = require('../config/config');

const config = getConfig();
const rateLimitConfig = config.rateLimiting;

// Skip rate limiting if disabled in config
const skipInTest = (req) => !rateLimitConfig.enabled;

/**
 * Strict rate limiting for authentication endpoints
 * Prevents brute force attacks on login/register
 */
const authLimiter = rateLimit({
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

const authEmailLimiter = rateLimit({
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
});

/**
 * General API rate limiting for unauthenticated requests
 */
const apiLimiter = rateLimit({
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
        // If user is authenticated via session or API token, skip this limiter
        return !!(req.session?.userId || req.user);
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
    windowMs: rateLimitConfig.authenticatedApi.windowMs,
    max: rateLimitConfig.authenticatedApi.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Prefer user ID from session or API token authentication
        const userId =
            req.session?.userId?.toString() || req.user?.id?.toString();
        if (userId) return userId;
        // Use proper IPv6-compatible IP key generator as fallback
        return ipKeyGenerator(req.ip);
    },
    // Only apply to authenticated requests or if disabled
    skip: (req) => {
        // Skip if rate limiting is disabled
        if (!rateLimitConfig.enabled) return true;
        // Skip if not authenticated
        return !(req.session?.userId || req.user);
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
    windowMs: rateLimitConfig.createResource.windowMs,
    max: rateLimitConfig.createResource.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    keyGenerator: (req) => {
        const userId =
            req.session?.userId?.toString() || req.user?.id?.toString();
        if (userId) return userId;
        // Use proper IPv6-compatible IP key generator as fallback
        return ipKeyGenerator(req.ip);
    },
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
    windowMs: rateLimitConfig.apiKeyManagement.windowMs,
    max: rateLimitConfig.apiKeyManagement.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInTest,
    keyGenerator: (req) => {
        const userId =
            req.session?.userId?.toString() || req.user?.id?.toString();
        if (userId) return userId;
        // Use proper IPv6-compatible IP key generator as fallback
        return ipKeyGenerator(req.ip);
    },
    handler: (req, res) => {
        res.status(429).json({
            error: 'Rate limit exceeded',
            message:
                'You have exceeded the maximum number of API key management requests. Please try again later.',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
        });
    },
});

// CalDAV clients authenticate with Basic auth on every request, outside the
// /api limiters. Keyed by IP plus the attempted username so a password
// guess against one account is throttled without blocking a whole office.
const caldavAuthLimiter = rateLimit({
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
    authEmailKey,
    apiLimiter,
    authenticatedApiLimiter,
    createResourceLimiter,
    apiKeyManagementLimiter,
};
