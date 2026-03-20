'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { requireAuth } = require('../../middleware/auth');

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

// Get MCP feature flag status (no feature flag check needed for this one)
// Note: requireAuth is already applied in app.js before these routes
router.get('/mcp/status', controller.getMcpStatus);

// All other MCP routes require the feature to be enabled
router.use('/mcp', checkMcpEnabled);

// Get MCP configuration for Claude Desktop
router.get('/mcp/config', controller.getMcpConfig);

// List available MCP tools
router.get('/mcp/tools', controller.listMcpTools);

module.exports = router;
