'use strict';

const { findValidTokenByValue } = require('../users/apiTokenService');
const { User } = require('../../models');

/**
 * Middleware to authenticate MCP requests using Bearer token
 * Validates the Authorization header and attaches user context to req
 */
async function authenticateMcpRequest(req, res, next) {
    try {
        // Extract Bearer token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: 'Unauthorized',
                message:
                    'Missing Authorization header. Include: Authorization: Bearer YOUR_API_TOKEN',
            });
        }

        // Parse Bearer token
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                error: 'Unauthorized',
                message:
                    'Invalid Authorization header format. Use: Authorization: Bearer YOUR_API_TOKEN',
            });
        }

        const apiToken = parts[1];

        // Validate token
        const tokenRecord = await findValidTokenByValue(apiToken);
        if (!tokenRecord) {
            return res.status(401).json({
                error: 'Unauthorized',
                message:
                    'Invalid or expired API token. Generate a new token in Profile → API Keys.',
            });
        }

        // Get user
        const user = await User.findByPk(tokenRecord.user_id);
        if (!user) {
            return res.status(401).json({
                error: 'Unauthorized',
                message: 'User not found for the provided token.',
            });
        }

        // Attach to request
        req.mcpUser = user;
        req.mcpApiToken = tokenRecord;

        next();
    } catch (error) {
        console.error('MCP authentication error:', error);
        return res.status(500).json({
            error: 'Authentication error',
            message: error.message,
        });
    }
}

module.exports = {
    authenticateMcpRequest,
};
