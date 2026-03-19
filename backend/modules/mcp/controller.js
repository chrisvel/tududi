'use strict';

const path = require('path');
const { getConfig } = require('../../config/config');

/**
 * Get MCP configuration for Claude Desktop
 * Returns JSON that user can paste into Claude Desktop config
 */
async function getMcpConfig(req, res) {
    try {
        const config = getConfig();
        const serverPath = path.resolve(
            __dirname,
            '..',
            '..',
            'modules',
            'mcp',
            'server.js'
        );

        // Generate config for user to copy
        const claudeConfig = {
            mcpServers: {
                tududi: {
                    command: 'node',
                    args: [serverPath],
                    env: {
                        TUDUDI_API_TOKEN: 'YOUR_API_TOKEN_HERE',
                        NODE_ENV: config.environment || 'development',
                    },
                },
            },
        };

        res.json(claudeConfig);
    } catch (error) {
        console.error('Error generating MCP config:', error);
        res.status(500).json({
            error: 'Failed to generate MCP configuration',
        });
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
};
