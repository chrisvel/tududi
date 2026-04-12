'use strict';

const { registerTaskTools } = require('./tools/taskTools');
const { registerProjectTools } = require('./tools/projectTools');
const { registerInboxTools } = require('./tools/inboxTools');
const { registerMiscTools } = require('./tools/miscTools');

/**
 * Register all MCP tools with the server
 * @param {Object} server - MCP server instance
 * @param {Object} context - User context {userId, user, apiToken}
 * @param {Array} tools - Tools registry array
 */
function registerAllTools(server, context, tools) {
    registerTaskTools(server, context, tools);
    registerProjectTools(server, context, tools);
    registerInboxTools(server, context, tools);
    registerMiscTools(server, context, tools);
}

module.exports = { registerAllTools };
