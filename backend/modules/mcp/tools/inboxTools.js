'use strict';

const { InboxItem } = require('../../../models');

/**
 * Register all inbox-related MCP tools
 */
function registerInboxTools(server, context, tools) {
    // 1. list_inbox - List inbox items
    tools.push({
        name: 'list_inbox',
        description: 'List items from inbox with pagination',
        inputSchema: {
            type: 'object',
            properties: {
                limit: {
                    type: 'number',
                    description: 'Maximum number of items to return',
                    default: 20,
                },
                offset: {
                    type: 'number',
                    description: 'Number of items to skip',
                    default: 0,
                },
            },
        },
        handler: async (params) => {
            const limit = params.limit || 20;
            const offset = params.offset || 0;

            const items = await InboxItem.findAll({
                where: { user_id: context.userId },
                limit: limit,
                offset: offset,
                order: [['created_at', 'DESC']],
            });

            const serialized = items.map((item) => ({
                id: item.id,
                uid: item.uid,
                content: item.content,
                source: item.source,
                processed: item.processed,
                created_at: item.created_at,
                updated_at: item.updated_at,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                count: serialized.length,
                                items: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. add_to_inbox - Add item to inbox
    tools.push({
        name: 'add_to_inbox',
        description: 'Add a new item to the inbox for quick capture',
        inputSchema: {
            type: 'object',
            properties: {
                content: {
                    type: 'string',
                    description: 'Inbox item content (required)',
                },
                source: {
                    type: 'string',
                    description: 'Source of the item (default: mcp)',
                    default: 'mcp',
                },
            },
            required: ['content'],
        },
        handler: async (params) => {
            const inboxData = {
                user_id: context.userId,
                content: params.content,
                source: params.source || 'mcp',
                processed: false,
            };

            const item = await InboxItem.create(inboxData);

            const serialized = {
                id: item.id,
                uid: item.uid,
                content: item.content,
                source: item.source,
                processed: item.processed,
                created_at: item.created_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Item added to inbox successfully',
                                item: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerInboxTools };
