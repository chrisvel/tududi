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

// All MCP routes require authentication
router.use(requireAuth);

// Get MCP feature flag status (no feature flag check needed for this one)
router.get('/api/v1/mcp/status', controller.getMcpStatus);

// All other MCP routes require the feature to be enabled
router.use(checkMcpEnabled);

// Get MCP configuration for Claude Desktop
router.get('/api/v1/mcp/config', controller.getMcpConfig);

// List available MCP tools
router.get('/api/v1/mcp/tools', controller.listMcpTools);

module.exports = router;
