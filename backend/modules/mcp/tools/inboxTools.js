'use strict';

const { InboxItem } = require('../../../models');
const inboxService = require('../../inbox/service');

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

    // 3. get_inbox_item - Get a single inbox item by UID
    tools.push({
        name: 'get_inbox_item',
        description: 'Get a specific inbox item by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Inbox item UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const item = await inboxService.getByUid(
                context.userId,
                params.uid
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ item }, null, 2),
                    },
                ],
            };
        },
    });

    // 4. update_inbox_item - Update an inbox item
    tools.push({
        name: 'update_inbox_item',
        description: "Update an inbox item's content or status",
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Inbox item UID',
                },
                content: {
                    type: 'string',
                    description: 'New content',
                },
                status: {
                    type: 'string',
                    description: 'New status (e.g. added, processed, deleted)',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const item = await inboxService.update(context.userId, params.uid, {
                content: params.content,
                status: params.status,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Inbox item updated successfully',
                                item,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. process_inbox_item - Mark an inbox item as processed
    tools.push({
        name: 'process_inbox_item',
        description: 'Mark an inbox item as processed',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Inbox item UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const item = await inboxService.process(context.userId, params.uid);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Inbox item marked as processed',
                                item,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 6. delete_inbox_item - Delete an inbox item
    tools.push({
        name: 'delete_inbox_item',
        description: 'Delete an inbox item',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Inbox item UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            await inboxService.delete(context.userId, params.uid);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Inbox item deleted successfully' },
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
