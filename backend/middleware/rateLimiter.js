const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { getConfig } = require('../config/config');

/**
 * Rate limiting middleware for different endpoint types
 *
 * Rate limits are configured based on authentication state and endpoint sensitivity:
 * - Strict limits for authentication endpoints (login, register)
 * - Moderate limits for general API endpoints
 * - Higher limits for authenticated users with API tokens
 *
 * Configuration is centralized in backend/config/config.js and can be customized via environment variables.
 * Rate limiting is automatically disabled in test environment.
 */

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
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
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
    // Skip rate limiting for authenticated users or if disabled
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
    // Use user ID as the key instead of IP for authenticated requests
    keyGenerator: (req) => {
        // Prefer user ID from session or API token authentication
        const userId =
            req.session?.userId?.toString() || req.user?.id?.toString();
        if (userId) return userId;
        // Use proper IPv6-compatible IP key generator as fallback
        return ipKeyGenerator(req);
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
        return ipKeyGenerator(req);
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
        return ipKeyGenerator(req);
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

module.exports = {
    authLimiter,
    apiLimiter,
    authenticatedApiLimiter,
    createResourceLimiter,
    apiKeyManagementLimiter,
};
