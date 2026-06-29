'use strict';

const tagsService = require('../../tags/service');

/**
 * Register all tag-related MCP tools
 */
function registerTagTools(server, context, tools) {
    // 1. list_tags - List all tags
    tools.push({
        name: 'list_tags',
        description: 'List all available tags',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        handler: async (params) => {
            const tags = await tagsService.getAllForUser(context.userId);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: tags.length, tags },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_tag - Get a single tag by UID or name
    tools.push({
        name: 'get_tag',
        description: 'Get a specific tag by its UID or name',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Tag UID',
                },
                name: {
                    type: 'string',
                    description: 'Tag name (used if uid is not provided)',
                },
            },
        },
        handler: async (params) => {
            if (!params.uid && !params.name) {
                throw new Error('Either uid or name is required');
            }

            const tag = await tagsService.getByQuery(context.userId, {
                uid: params.uid,
                name: params.name,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ tag }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_tag - Create a new tag
    tools.push({
        name: 'create_tag',
        description: 'Create a new tag',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Tag name',
                },
            },
            required: ['name'],
        },
        handler: async (params) => {
            const tag = await tagsService.create(context.userId, params.name);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Tag created successfully', tag },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_tag - Update a tag's name
    tools.push({
        name: 'update_tag',
        description: "Update an existing tag's name",
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Tag UID or current name',
                },
                name: {
                    type: 'string',
                    description: 'New tag name',
                },
            },
            required: ['uid', 'name'],
        },
        handler: async (params) => {
            const tag = await tagsService.update(context.userId, params.uid, {
                name: params.name,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Tag updated successfully', tag },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_tag - Delete a tag and its associations
    tools.push({
        name: 'delete_tag',
        description:
            'Delete a tag and remove it from all associated tasks, notes, and projects',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Tag UID or name',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            await tagsService.delete(context.userId, params.uid);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Tag deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerTagTools };
