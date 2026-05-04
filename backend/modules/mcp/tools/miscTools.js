'use strict';

const { Area, Tag, Task, Project, Note } = require('../../../models');
const { Op } = require('sequelize');

/**
 * Register miscellaneous MCP tools
 */
function registerMiscTools(server, context, tools) {
    // 1. list_areas - List all areas
    tools.push({
        name: 'list_areas',
        description: 'List all organizational areas',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        handler: async (params) => {
            const areas = await Area.findAll({
                where: { user_id: context.userId },
                order: [['name', 'ASC']],
            });

            const serialized = areas.map((area) => ({
                id: area.id,
                uid: area.uid,
                name: area.name,
                description: area.description,
                created_at: area.created_at,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                count: serialized.length,
                                areas: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. list_tags - List all tags
    tools.push({
        name: 'list_tags',
        description: 'List all available tags',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        handler: async (params) => {
            const tags = await Tag.findAll({
                where: { user_id: context.userId },
                order: [['name', 'ASC']],
            });

            const serialized = tags.map((tag) => ({
                id: tag.id,
                uid: tag.uid,
                name: tag.name,
                created_at: tag.created_at,
            }));

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                count: serialized.length,
                                tags: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 3. search - Universal search across tasks, projects, notes
    tools.push({
        name: 'search',
        description: 'Search across tasks, projects, and notes',
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (required)',
                },
                type: {
                    type: 'string',
                    enum: ['task', 'project', 'note', 'all'],
                    description: 'Resource type to search (default: all)',
                    default: 'all',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum results per type',
                    default: 10,
                },
            },
            required: ['query'],
        },
        handler: async (params) => {
            const query = params.query;
            const type = params.type || 'all';
            const limit = params.limit || 10;
            const results = {};

            const searchCondition = {
                [Op.or]: [
                    { name: { [Op.like]: `%${query}%` } },
                    { note: { [Op.like]: `%${query}%` } },
                ],
            };

            // Search tasks
            if (type === 'task' || type === 'all') {
                const tasks = await Task.findAll({
                    where: {
                        user_id: context.userId,
                        [Op.or]: [
                            { name: { [Op.like]: `%${query}%` } },
                            { note: { [Op.like]: `%${query}%` } },
                        ],
                    },
                    limit: limit,
                    order: [['created_at', 'DESC']],
                });

                results.tasks = tasks.map((t) => ({
                    id: t.id,
                    uid: t.uid,
                    name: t.name,
                    status: t.status,
                    priority: t.priority,
                }));
            }

            // Search projects
            if (type === 'project' || type === 'all') {
                const projects = await Project.findAll({
                    where: {
                        user_id: context.userId,
                        [Op.or]: [
                            { name: { [Op.like]: `%${query}%` } },
                            { description: { [Op.like]: `%${query}%` } },
                        ],
                    },
                    limit: limit,
                    order: [['created_at', 'DESC']],
                });

                results.projects = projects.map((p) => ({
                    id: p.id,
                    uid: p.uid,
                    name: p.name,
                    status: p.status,
                }));
            }

            // Search notes
            if (type === 'note' || type === 'all') {
                const notes = await Note.findAll({
                    where: {
                        user_id: context.userId,
                        [Op.or]: [
                            { title: { [Op.like]: `%${query}%` } },
                            { content: { [Op.like]: `%${query}%` } },
                        ],
                    },
                    limit: limit,
                    order: [['created_at', 'DESC']],
                });

                results.notes = notes.map((n) => ({
                    id: n.id,
                    uid: n.uid,
                    title: n.title,
                }));
            }

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                query: query,
                                results: results,
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

module.exports = { registerMiscTools };
