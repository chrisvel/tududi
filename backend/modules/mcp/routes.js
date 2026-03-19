'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./controller');
const { requireAuth } = require('../../middleware/auth');

// All MCP routes require authentication
router.use(requireAuth);

// Get MCP configuration for Claude Desktop
router.get('/api/v1/mcp/config', controller.getMcpConfig);

// Get MCP feature flag status
router.get('/api/v1/mcp/status', controller.getMcpStatus);

// List available MCP tools
router.get('/api/v1/mcp/tools', controller.listMcpTools);

module.exports = router;
