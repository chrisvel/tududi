'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
    StreamableHTTPServerTransport,
} = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { registerAllTools } = require('./toolRegistry');

/**
 * Handle MCP HTTP request
 * This creates a stateless MCP server for each request
 */
async function handleMcpHttpRequest(req, res, user) {
    try {
        // Create context for tools
        const context = {
            userId: user.id,
            user: user,
        };

        // Initialize MCP server
        const server = new Server(
            {
                name: process.env.MCP_SERVER_NAME || 'tududi',
                version: process.env.MCP_SERVER_VERSION || '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Store tools registry
        const tools = [];

        // Register list tools handler
        server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: tools,
            };
        });

        // Register call tool handler
        server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const toolName = request.params.name;
            const tool = tools.find((t) => t.name === toolName);

            if (!tool) {
                throw new Error(`Unknown tool: ${toolName}`);
            }

            try {
                const result = await tool.handler(
                    request.params.arguments || {},
                    context
                );
                return result;
            } catch (error) {
                console.error(`Error executing tool ${toolName}:`, error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Error: ${error.message}`,
                        },
                    ],
                    isError: true,
                };
            }
        });

        // Register all tools
        registerAllTools(server, context, tools);

        // Create HTTP transport (stateless mode)
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined, // Stateless mode
        });

        // Connect server to transport
        await server.connect(transport);

        // Handle the HTTP request
        await transport.handleRequest(req, res, req.body);

    } catch (error) {
        console.error('MCP HTTP handler error:', error);

        // Only send response if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Internal server error',
                message: error.message,
            });
        }
    }
}

module.exports = {
    handleMcpHttpRequest,
};
