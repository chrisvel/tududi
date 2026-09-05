'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authenticateMcpRequest } = require('./middleware');
const { requireFeature } = require('../../middleware/entitlements');

/**
 * Middleware to check if MCP feature is enabled
 */
const checkMcpEnabled = (req, res, next) => {
    const mcpEnabled = process.env.FF_ENABLE_MCP === 'true';
    if (!mcpEnabled) {
        return res.status(403).json({
            error: 'MCP feature is not enabled',
            message:
                'Set FF_ENABLE_MCP=true in your .env file to enable this feature',
        });
    }
    next();
};

// Get MCP feature flag status (no feature flag check needed)
// Note: requireAuth is already applied in app.js for authenticated routes
router.get('/mcp/status', controller.getMcpStatus);

// Get MCP configuration for Claude Desktop (requires feature flag)
router.get(
    '/mcp/config',
    checkMcpEnabled,
    requireFeature('mcp'),
    controller.getMcpConfig
);

// List available MCP tools (requires feature flag)
router.get(
    '/mcp/tools',
    checkMcpEnabled,
    requireFeature('mcp'),
    controller.listMcpTools
);

// MCP protocol endpoint - uses Bearer token auth, not session auth
// This endpoint handles actual MCP protocol messages from remote clients
router.post(
    '/mcp',
    checkMcpEnabled,
    authenticateMcpRequest,
    requireFeature('mcp'),
    controller.handleMcpMessage
);

module.exports = router;
