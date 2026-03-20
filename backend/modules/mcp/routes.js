'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');

/**
 * Middleware to check if MCP feature is enabled
 */
const checkMcpEnabled = (req, res, next) => {
    const mcpEnabled = process.env.FF_ENABLE_MCP === 'true';
    if (!mcpEnabled) {
        return res.status(403).json({
            error: 'MCP feature is not enabled',
            message: 'Set FF_ENABLE_MCP=true in your .env file to enable this feature',
        });
    }
    next();
};

// Get MCP feature flag status (no feature flag check needed)
// Note: requireAuth is already applied in app.js
router.get('/mcp/status', controller.getMcpStatus);

// Get MCP configuration for Claude Desktop (requires feature flag)
router.get('/mcp/config', checkMcpEnabled, controller.getMcpConfig);

// List available MCP tools (requires feature flag)
router.get('/mcp/tools', checkMcpEnabled, controller.listMcpTools);

module.exports = router;
