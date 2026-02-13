/**
 * MCP-specific middleware: Bearer-only auth and Origin validation (DNS rebinding protection).
 */

const { getConfig } = require('../../config/config');

/**
 * Require API key (Bearer) for MCP; reject session-only auth.
 * Must run after requireAuth so req.currentUser is set.
 */
function requireMcpBearer(req, res, next) {
    if (req.authToken) return next();
    return res.status(401).json({
        error: 'MCP requires API key',
        message:
            'Use Authorization: Bearer <your_api_key>. Session/cookie auth is not accepted for the MCP endpoint.',
    });
}

/**
 * Validate Origin header for MCP to mitigate DNS rebinding.
 * If Origin is present and not allowed, respond with 403.
 */
function mcpOriginCheck(req, res, next) {
    const origin = req.get('Origin');
    if (!origin) return next();

    const config = getConfig();
    const allowed = config.allowedOrigins || [];
    const normalized = origin.trim().toLowerCase();

    const allowedNormalized = allowed.map((o) => o.trim().toLowerCase());
    if (allowedNormalized.includes(normalized)) return next();

    return res.status(403).json({
        jsonrpc: '2.0',
        error: {
            code: -32000,
            message: 'Origin not allowed. Check TUDUDI_ALLOWED_ORIGINS.',
        },
    });
}

module.exports = {
    requireMcpBearer,
    mcpOriginCheck,
};
