'use strict';

/**
 * Middleware to attach MCP-specific user context after requireAuth has run.
 * Authentication (API key or OAuth2 JWT) is handled by requireAuth, which
 * populates req.currentUser. This middleware maps that to the MCP-specific
 * fields expected by the MCP controller.
 */
function authenticateMcpRequest(req, res, next) {
    req.mcpUser = req.currentUser;
    next();
}

module.exports = {
    authenticateMcpRequest,
};
