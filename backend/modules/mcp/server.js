'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const {
    StdioServerTransport,
} = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const { findValidTokenByValue } = require('../users/apiTokenService');
const { User } = require('../../models');
const { registerAllTools } = require('./toolRegistry');

/**
 * Start the MCP server
 * Validates authentication token and initializes stdio transport
 */
async function startMcpServer() {
    try {
        // Validate environment
        const apiToken = process.env.TASKNOTETAKER_API_TOKEN;
        if (!apiToken) {
            throw new Error(
                'TASKNOTETAKER_API_TOKEN environment variable is required. ' +
                    'Generate a token in Profile → API Keys and add it to your Claude Desktop config.'
            );
        }

        // Validate token and get user context
        const tokenRecord = await findValidTokenByValue(apiToken);
        if (!tokenRecord) {
            throw new Error(
                'Invalid or expired TASKNOTETAKER_API_TOKEN. ' +
                    'Please generate a new token in Profile → API Keys.'
            );
        }

        const user = await User.findByPk(tokenRecord.user_id);
        if (!user) {
            throw new Error('User not found for the provided token.');
        }

        // Create context for all tools
        const context = {
            userId: user.id,
            user: user,
            apiToken: tokenRecord,
        };

        // Initialize MCP server
        const server = new Server(
            {
                name: process.env.MCP_SERVER_NAME || 'TaskNoteTaker',
                version: process.env.MCP_SERVER_VERSION || '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        // Store tools registry for request handlers
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
                // Call the tool handler with params and context
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

        // Register all tools with context
        registerAllTools(server, context, tools);

        // Start stdio transport
        const transport = new StdioServerTransport();
        await server.connect(transport);

        console.error('TaskNoteTaker MCP server running on stdio');
        console.error(`Authenticated as: ${user.email} (ID: ${user.id})`);
        console.error(`Available tools: ${tools.length}`);

        // Update token last_used_at (fire and forget)
        tokenRecord
            .update({ last_used_at: new Date() })
            .catch((err) =>
                console.error('Failed to update token last_used_at:', err)
            );
    } catch (error) {
        console.error('Fatal MCP server error:', error.message);
        process.exit(1);
    }
}

// Start server if running directly
if (require.main === module) {
    // Load environment variables
    require('dotenv').config();

    // Initialize database connection
    const { sequelize } = require('../../models');
    sequelize
        .authenticate()
        .then(() => {
            console.error('Database connection established');
            return startMcpServer();
        })
        .catch((error) => {
            console.error('Failed to connect to database:', error);
            process.exit(1);
        });
}

module.exports = startMcpServer;
