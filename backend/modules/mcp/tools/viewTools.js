'use strict';

const viewsRepository = require('../../views/repository');

function registerViewTools(server, context, tools) {
    // 1. list_views - List all views
    tools.push({
        name: 'list_views',
        description:
            'List saved smart views (saved searches) with optional pinned filter',
        inputSchema: {
            type: 'object',
            properties: {
                pinned_only: {
                    type: 'boolean',
                    description: 'Return only pinned views',
                    default: false,
                },
            },
        },
        handler: async (params) => {
            const views = params.pinned_only
                ? await viewsRepository.findPinnedByUser(context.userId)
                : await viewsRepository.findAllByUser(context.userId);

            const serialized = views.map((v) => ({
                id: v.id,
                uid: v.uid,
                name: v.name,
                is_pinned: v.is_pinned,
                search_query: v.search_query,
                filters: v.filters,
                priority: v.priority,
                due: v.due,
                defer: v.defer,
                tags: v.tags,
                extras: v.extras,
                recurring: v.recurring,
                created_at: v.created_at,
                updated_at: v.updated_at,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { count: serialized.length, views: serialized },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_view - Get a single view by UID
    tools.push({
        name: 'get_view',
        description: 'Get a specific smart view by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'View UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const view = await viewsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!view) {
                throw new Error(`View not found: ${params.uid}`);
            }

            const serialized = {
                id: view.id,
                uid: view.uid,
                name: view.name,
                is_pinned: view.is_pinned,
                search_query: view.search_query,
                filters: view.filters,
                priority: view.priority,
                due: view.due,
                defer: view.defer,
                tags: view.tags,
                extras: view.extras,
                recurring: view.recurring,
                created_at: view.created_at,
                updated_at: view.updated_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ view: serialized }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_view - Create a new view
    tools.push({
        name: 'create_view',
        description: 'Create a new smart view (saved search)',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'View name (required)',
                },
                search_query: {
                    type: 'string',
                    description: 'Text search query',
                },
                is_pinned: {
                    type: 'boolean',
                    description: 'Pin view to sidebar',
                    default: false,
                },
                priority: {
                    type: 'string',
                    description: 'Priority filter (low, medium, high)',
                },
                due: {
                    type: 'string',
                    description: 'Due date filter (e.g. today, this_week)',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Tag filters',
                },
            },
            required: ['name'],
        },
        handler: async (params) => {
            if (!params.name || params.name.trim().length === 0) {
                throw new Error('View name is required');
            }

            const view = await viewsRepository.createForUser(context.userId, {
                name: params.name.trim(),
                search_query: params.search_query || null,
                is_pinned: params.is_pinned || false,
                priority: params.priority || null,
                due: params.due || null,
                tags: params.tags || [],
                filters: [],
                extras: [],
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'View created successfully',
                                view: {
                                    id: view.id,
                                    uid: view.uid,
                                    name: view.name,
                                    is_pinned: view.is_pinned,
                                    search_query: view.search_query,
                                    created_at: view.created_at,
                                },
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_view - Update an existing view
    tools.push({
        name: 'update_view',
        description: 'Update an existing smart view',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'View UID (required)',
                },
                name: {
                    type: 'string',
                    description: 'New name',
                },
                search_query: {
                    type: 'string',
                    description: 'New text search query',
                },
                is_pinned: {
                    type: 'boolean',
                    description: 'Pin or unpin from sidebar',
                },
                priority: {
                    type: 'string',
                    description: 'New priority filter',
                },
                due: {
                    type: 'string',
                    description: 'New due date filter',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'New tag filters',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const view = await viewsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!view) {
                throw new Error(`View not found: ${params.uid}`);
            }

            const updates = {};
            if (params.name !== undefined) updates.name = params.name;
            if (params.search_query !== undefined)
                updates.search_query = params.search_query;
            if (params.is_pinned !== undefined)
                updates.is_pinned = params.is_pinned;
            if (params.priority !== undefined)
                updates.priority = params.priority;
            if (params.due !== undefined) updates.due = params.due;
            if (params.tags !== undefined) updates.tags = params.tags;

            await view.update(updates);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'View updated successfully',
                                view: {
                                    id: view.id,
                                    uid: view.uid,
                                    name: view.name,
                                    is_pinned: view.is_pinned,
                                    updated_at: view.updated_at,
                                },
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. delete_view - Delete a view
    tools.push({
        name: 'delete_view',
        description: 'Delete a smart view',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'View UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const view = await viewsRepository.findByUidAndUser(
                params.uid,
                context.userId
            );

            if (!view) {
                throw new Error(`View not found: ${params.uid}`);
            }

            await view.destroy();

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'View deleted successfully' },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });
}

module.exports = { registerViewTools };
