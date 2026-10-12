'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { authenticateMcpRequest } = require('./middleware');
const { requireFeature } = require('../../middleware/entitlements');

// Get MCP feature flag status
// Note: requireAuth is already applied in app.js for authenticated routes
router.get('/mcp/status', controller.getMcpStatus);

// Get MCP configuration for Claude Desktop
router.get('/mcp/config', requireFeature('mcp'), controller.getMcpConfig);

// List available MCP tools
router.get('/mcp/tools', requireFeature('mcp'), controller.listMcpTools);

// MCP protocol endpoint - uses Bearer token auth, not session auth
// This endpoint handles actual MCP protocol messages from remote clients
// LTD-PATCH(T-706): resolve the client's scopes and MCP controls first.
router.post(
    '/mcp',
    authenticateMcpRequest,
    require('../ltd-mcp-control/middleware').resolveMcpClient,
    requireFeature('mcp'),
    controller.handleMcpMessage
);

module.exports = router;
