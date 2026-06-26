'use strict';

const areasRepository = require('../../areas/repository');

function registerAreaTools(server, context, tools) {
    // 1. list_areas - List all areas
    tools.push({
        name: 'list_areas',
        description: 'List all organizational areas',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        handler: async (params) => {
            const areas = await areasRepository.findAllByUser(context.userId);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: areas.length, areas },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_area - Get a single area by UID
    tools.push({
        name: 'get_area',
        description: 'Get a specific area by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Area UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const area = await areasRepository.findByUidPublic(
                context.userId,
                params.uid
            );

            if (!area) {
                throw new Error(`Area not found: ${params.uid}`);
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ area }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_area - Create a new area
    tools.push({
        name: 'create_area',
        description: 'Create a new organizational area',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Area name',
                },
                description: {
                    type: 'string',
                    description: 'Optional description',
                },
                color: {
                    type: 'string',
                    description: 'Optional hex color (e.g. #ff6b6b)',
                },
            },
            required: ['name'],
        },
        handler: async (params) => {
            if (!params.name || params.name.trim().length === 0) {
                throw new Error('Area name is required');
            }

            const area = await areasRepository.createForUser(context.userId, {
                name: params.name.trim(),
                description: params.description || '',
                color: params.color || null,
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Area created successfully', area },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_area - Update an area
    tools.push({
        name: 'update_area',
        description: 'Update an existing area',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Area UID',
                },
                name: {
                    type: 'string',
                    description: 'New name',
                },
                description: {
                    type: 'string',
                    description: 'New description',
                },
                color: {
                    type: 'string',
                    description: 'New hex color or empty string to remove',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const area = await areasRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!area) {
                throw new Error(`Area not found: ${params.uid}`);
            }

            const updates = {};
            if (params.name !== undefined) updates.name = params.name;
            if (params.description !== undefined)
                updates.description = params.description;
            if (params.color !== undefined)
                updates.color = params.color === '' ? null : params.color;

            await areasRepository.update(area, updates);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Area updated successfully', area },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_area - Delete an area
    tools.push({
        name: 'delete_area',
        description: 'Delete an area (projects are orphaned, not deleted)',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Area UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const area = await areasRepository.findByUid(
                context.userId,
                params.uid
            );

            if (!area) {
                throw new Error(`Area not found: ${params.uid}`);
            }

            await areasRepository.destroy(area);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Area deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerAreaTools };
