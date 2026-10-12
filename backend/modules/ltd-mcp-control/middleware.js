'use strict';

// Life-to-Day (T-706): resolves the MCP client (token, OAuth client or
// session) with its scopes and the user's MCP controls; the kill switch
// ends a revoked client's request here.
const control = require('./service');
const { unauthorized } = require('../../middleware/auth');

async function resolveMcpClient(req, res, next) {
    try {
        if (!req.currentUser) return next();
        req.mcpClient = await control.resolveClient(req);
        if (req.mcpClient.revoked)
            return unauthorized(
                req,
                res,
                'MCP access was revoked in Settings; reconnect the client'
            );
        return next();
    } catch (error) {
        return next(error);
    }
}

module.exports = { resolveMcpClient };
