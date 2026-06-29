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

        // Delegate to HTTP transport handler
        await handleMcpHttpRequest(req, res, user);
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
            count: 5,
            tools: [
                'list_projects',
                'get_project',
                'create_project',
                'update_project',
                'delete_project',
            ],
        },
        {
            category: 'Areas',
            count: 5,
            tools: [
                'list_areas',
                'get_area',
                'create_area',
                'update_area',
                'delete_area',
            ],
        },
        {
            category: 'Habits',
            count: 9,
            tools: [
                'list_habits',
                'get_habit',
                'create_habit',
                'update_habit',
                'delete_habit',
                'log_habit_completion',
                'get_habit_completions',
                'delete_habit_completion',
                'get_habit_stats',
            ],
        },
        {
            category: 'Inbox',
            count: 6,
            tools: [
                'list_inbox',
                'add_to_inbox',
                'get_inbox_item',
                'update_inbox_item',
                'process_inbox_item',
                'delete_inbox_item',
            ],
        },
        {
            category: 'Notes',
            count: 5,
            tools: [
                'list_notes',
                'get_note',
                'create_note',
                'update_note',
                'delete_note',
            ],
        },
        {
            category: 'Tags',
            count: 5,
            tools: [
                'list_tags',
                'get_tag',
                'create_tag',
                'update_tag',
                'delete_tag',
            ],
        },
        {
            category: 'Misc',
            count: 1,
            tools: ['search'],
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
