/**
 * MCP (Model Context Protocol) module: Streamable HTTP at /mcp.
 * Exposes Tududi API operations as MCP tools with the same auth (Bearer API key).
 */

const { createMcpHandler } = require('./handler');

module.exports = {
    createMcpHandler,
};
