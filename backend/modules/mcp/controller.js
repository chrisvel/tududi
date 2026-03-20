'use strict';

const { handleMcpHttpRequest } = require('./httpTransport');

/**
 * Get MCP configuration for Claude Desktop
 * Returns JSON that user can paste into Claude Desktop config
 */
async function getMcpConfig(req, res) {
    try {
        // Get base URL from request
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;

        // Generate HTTP-based config for remote access
        const claudeConfig = {
            mcpServers: {
                tududi: {
                    command: 'npx',
                    args: [
                        '-y',
                        'mcp-remote',
                        `${baseUrl}/api/mcp`,
                        '--header',
                        'Authorization:Bearer ${TUDUDI_API_TOKEN}',
                    ],
                    env: {
                        TUDUDI_API_TOKEN: 'YOUR_API_TOKEN_HERE',
                    },
                },
            },
        };

        res.json(claudeConfig);
    } catch (error) {
        console.error('Error generating MCP config:', error);
        res.status(500).json({
            error: 'Failed to generate MCP configuration',
            message: error.message,
        });
    }
}

/**
 * Handle MCP protocol message
 * This is called by the POST /api/mcp endpoint
 */
async function handleMcpMessage(req, res) {
    try {
        const user = req.mcpUser;
        const apiToken = req.mcpApiToken;

        // Delegate to HTTP transport handler
        await handleMcpHttpRequest(req, res, user, apiToken);
    } catch (error) {
        console.error('Error handling MCP message:', error);

        // Only send response if headers haven't been sent
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to process MCP message',
                message: error.message,
            });
        }
    }
}

/**
 * Get MCP feature flag status
 */
async function getMcpStatus(req, res) {
    const mcpEnabled = process.env.FF_ENABLE_MCP === 'true';
    res.json({ enabled: mcpEnabled });
}

/**
 * List available MCP tools
 */
async function listMcpTools(req, res) {
    const tools = [
        {
            category: 'Tasks',
            count: 8,
            tools: [
                'list_tasks',
                'get_task',
                'create_task',
                'update_task',
                'complete_task',
                'delete_task',
                'add_subtask',
                'get_task_metrics',
            ],
        },
        {
            category: 'Projects',
            count: 3,
            tools: ['list_projects', 'create_project', 'update_project'],
        },
        {
            category: 'Inbox',
            count: 2,
            tools: ['list_inbox', 'add_to_inbox'],
        },
        {
            category: 'Misc',
            count: 3,
            tools: ['list_areas', 'list_tags', 'search'],
        },
    ];

    res.json({ tools });
}

module.exports = {
    getMcpConfig,
    getMcpStatus,
    listMcpTools,
    handleMcpMessage,
};
