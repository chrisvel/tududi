/**
 * MCP Streamable HTTP handler: JSON-RPC over POST, GET returns 405.
 * Handles initialize, tools/list, tools/call, notifications/initialized.
 */

const { getRegistry } = require('./registry');
const { executeTool } = require('./executor');

const PROTOCOL_VERSION = '2025-03-26';
const SERVER_NAME = 'Tududi';
const SERVER_VERSION = '1.0.0';

/**
 * Create the MCP Express handler. Requires the Express app for internal tool execution.
 * @param {import('express').Application} app - The Express app (for internal API requests)
 * @returns {import('express').Router|import('express').RequestHandler}
 */
function createMcpHandler(app) {
    const router = require('express').Router();

    router.get('/', (req, res) => {
        res.set('Allow', 'POST');
        res.status(405).json({
            jsonrpc: '2.0',
            error: {
                code: -32601,
                message: 'Method not allowed. Use POST for JSON-RPC messages.',
            },
        });
    });

    router.post('/', async (req, res) => {
        const protocolVersion = req.get('MCP-Protocol-Version');
        const accept = req.get('Accept') || '';

        if (!req.is('json') && !req.body) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Parse error: body must be JSON' },
            });
        }

        const message = req.body;
        if (!message || typeof message !== 'object') {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32700, message: 'Parse error: invalid JSON-RPC' },
            });
        }

        if (message.jsonrpc !== '2.0') {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' },
            });
        }

        const isRequest = typeof message.method === 'string' && 'id' in message;
        const isNotification = typeof message.method === 'string' && !('id' in message);
        const isResponse = 'result' in message || 'error' in message;

        if (isResponse || isNotification) {
            if (isNotification && message.method === 'notifications/initialized') {
                // no-op
            }
            return res.status(202).end();
        }

        if (!isRequest) {
            return res.status(400).json({
                jsonrpc: '2.0',
                error: { code: -32600, message: 'Invalid Request' },
            });
        }

        const { id, method, params } = message;
        const authHeader = req.get('Authorization') || '';
        const serverPort = req.socket?.server?.address?.()?.port;

        let result;
        try {
            if (method === 'initialize') {
                const clientVersion = (params && params.protocolVersion) || PROTOCOL_VERSION;
                result = {
                    protocolVersion: clientVersion,
                    capabilities: {
                        tools: { listChanged: true },
                    },
                    serverInfo: {
                        name: SERVER_NAME,
                        version: SERVER_VERSION,
                        description: 'Tududi task management API exposed as MCP tools',
                    },
                };
            } else if (method === 'tools/list') {
                const { tools } = getRegistry();
                const cursor = params && params.cursor;
                result = { tools };
                if (cursor) result.nextCursor = null;
            } else if (method === 'tools/call') {
                const name = params && params.name;
                const args = params && params.arguments;
                if (!name) {
                    return res.status(200).json({
                        jsonrpc: '2.0',
                        id,
                        error: { code: -32602, message: 'Invalid params: missing tool name' },
                    });
                }
                result = await executeTool(name, args, { app, authHeader, serverPort });
            } else {
                return res.status(200).json({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32601, message: `Method not found: ${method}` },
                });
            }
        } catch (err) {
            console.error('MCP handler error:', err);
            return res.status(200).json({
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32603,
                    message: err.message || 'Internal error',
                },
            });
        }

        const response = { jsonrpc: '2.0', id, result };
        if (protocolVersion) res.set('MCP-Protocol-Version', protocolVersion);
        res.set('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json(response);
    });

    return router;
}

module.exports = {
    createMcpHandler,
    PROTOCOL_VERSION,
    SERVER_NAME,
    SERVER_VERSION,
};
