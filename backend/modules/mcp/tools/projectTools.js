'use strict';

const { Project, Area, Tag } = require('../../../models');
const { Op } = require('sequelize');

/**
 * Register all project-related MCP tools
 */
function registerProjectTools(server, context, tools) {
    // 1. list_projects - List projects
    tools.push({
        name: 'list_projects',
        description: 'List projects from TaskNoteTaker with optional filtering',
        inputSchema: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    enum: [
                        'not_started',
                        'planned',
                        'in_progress',
                        'waiting',
                        'done',
                        'cancelled',
                        'all',
                    ],
                    description: 'Filter by project status',
                },
                area_id: {
                    type: 'number',
                    description: 'Filter by area ID',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of projects to return',
                    default: 30,
                },
            },
        },
        handler: async (params) => {
            const where = { user_id: context.userId };
            const limit = params.limit || 30;

            // Apply status filter
            if (params.status && params.status !== 'all') {
                where.status = params.status;
            }

            // Apply area filter
            if (params.area_id) {
                where.area_id = params.area_id;
            }

            const projects = await Project.findAll({
                where: where,
                include: [
                    { model: Area, as: 'Area' },
                    { model: Tag, as: 'Tags' },
                ],
                limit: limit,
                order: [['created_at', 'DESC']],
            });

            const serialized = projects.map((p) => {
                const proj = p.toJSON();
                return {
                    id: proj.id,
                    uid: proj.uid,
                    name: proj.name,
                    description: proj.description,
                    status: proj.status,
                    priority: proj.priority,
                    area: proj.Area ? proj.Area.name : null,
                    tags: proj.Tags ? proj.Tags.map((t) => t.name) : [],
                    due_date_at: proj.due_date_at,
                    pin_to_sidebar: proj.pin_to_sidebar,
                    created_at: proj.created_at,
                    updated_at: proj.updated_at,
                };
            });

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                count: serialized.length,
                                projects: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. create_project - Create new project
    tools.push({
        name: 'create_project',
        description: 'Create a new project in TaskNoteTaker',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Project name (required)',
                },
                description: {
                    type: 'string',
                    description: 'Project description',
                },
                priority: {
                    type: 'number',
                    description: 'Priority (0=low, 1=medium, 2=high)',
                },
                status: {
                    type: 'string',
                    enum: [
                        'not_started',
                        'planned',
                        'in_progress',
                        'waiting',
                        'done',
                        'cancelled',
                    ],
                },
                area_id: {
                    type: 'number',
                    description: 'Area ID',
                },
                due_date_at: {
                    type: 'string',
                    description: 'Due date (ISO 8601)',
                },
                tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of tag names',
                },
            },
            required: ['name'],
        },
        handler: async (params) => {
            const projectData = {
                user_id: context.userId,
                name: params.name,
                description: params.description || '',
                priority: params.priority !== undefined ? params.priority : 1,
                status: params.status || 'not_started',
                area_id: params.area_id || null,
                due_date_at: params.due_date_at || null,
            };

            const project = await Project.create(projectData);

            // Handle tags if provided
            if (params.tags && params.tags.length > 0) {
                const tagInstances = await Promise.all(
                    params.tags.map(async (tagName) => {
                        const [tag] = await Tag.findOrCreate({
                            where: { name: tagName, user_id: context.userId },
                        });
                        return tag;
                    })
                );
                await project.setTags(tagInstances);
            }

            // Reload with associations
            const reloadedProject = await Project.findByPk(project.id, {
                include: [
                    { model: Area, as: 'Area' },
                    { model: Tag, as: 'Tags' },
                ],
            });

            const serialized = {
                id: reloadedProject.id,
                uid: reloadedProject.uid,
                name: reloadedProject.name,
                description: reloadedProject.description,
                status: reloadedProject.status,
                priority: reloadedProject.priority,
                area: reloadedProject.Area ? reloadedProject.Area.name : null,
                tags: reloadedProject.Tags
                    ? reloadedProject.Tags.map((t) => t.name)
                    : [],
                due_date_at: reloadedProject.due_date_at,
                created_at: reloadedProject.created_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Project created successfully',
                                project: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 3. update_project - Update existing project
    tools.push({
        name: 'update_project',
        description: 'Update an existing project',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Project UID (required)',
                },
                name: { type: 'string', description: 'New project name' },
                description: {
                    type: 'string',
                    description: 'New description',
                },
                priority: {
                    type: 'number',
                    description: 'New priority',
                },
                status: {
                    type: 'string',
                    enum: [
                        'not_started',
                        'planned',
                        'in_progress',
                        'waiting',
                        'done',
                        'cancelled',
                    ],
                },
                area_id: {
                    type: 'number',
                    description: 'New area ID',
                },
                pinned: {
                    type: 'boolean',
                    description: 'Pin to sidebar',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const project = await Project.findOne({
                where: { uid: params.uid, user_id: context.userId },
            });

            if (!project) {
                throw new Error(`Project not found: ${params.uid}`);
            }

            const updates = {};
            if (params.name !== undefined) updates.name = params.name;
            if (params.description !== undefined)
                updates.description = params.description;
            if (params.priority !== undefined)
                updates.priority = params.priority;
            if (params.status !== undefined) updates.status = params.status;
            if (params.area_id !== undefined) updates.area_id = params.area_id;
            if (params.pinned !== undefined)
                updates.pin_to_sidebar = params.pinned;

            await project.update(updates);

            // Reload with associations
            const reloadedProject = await Project.findByPk(project.id, {
                include: [
                    { model: Area, as: 'Area' },
                    { model: Tag, as: 'Tags' },
                ],
            });

            const serialized = {
                id: reloadedProject.id,
                uid: reloadedProject.uid,
                name: reloadedProject.name,
                description: reloadedProject.description,
                status: reloadedProject.status,
                priority: reloadedProject.priority,
                area: reloadedProject.Area ? reloadedProject.Area.name : null,
                tags: reloadedProject.Tags
                    ? reloadedProject.Tags.map((t) => t.name)
                    : [],
                due_date_at: reloadedProject.due_date_at,
                pin_to_sidebar: reloadedProject.pin_to_sidebar,
                updated_at: reloadedProject.updated_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Project updated successfully',
                                project: serialized,
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

module.exports = { registerProjectTools };
