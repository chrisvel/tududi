'use strict';

const entitlements = require('../../../services/entitlementsService');
const { sequelize, Project, Area, Tag, Goal } = require('../../../models');
const { Op } = require('sequelize');
const projectsRepository = require('../../projects/repository');
const permissionsService = require('../../../services/permissionsService');
const rolesService = require('../../../services/rolesService');
const {
    syncProjectSharesFromContainer,
} = require('../../../services/containerShareSync');
const { resolveTagsForTransaction } = require('./tagResolver');

const goalInputProperties = {
    goal_id: {
        type: 'number',
        description: 'Goal ID to link the project to (null to unlink)',
    },
    goal_uid: {
        type: 'string',
        description:
            'Goal UID to link the project to (null or empty to unlink)',
    },
    is_maintenance: {
        type: 'boolean',
        description:
            'Mark as a maintenance project (keeps something running, not goal-directed). Setting true unlinks any goal; linking a goal clears it.',
    },
};

function assertNotGoalAndMaintenance(params, goalId) {
    if (params.is_maintenance === true && goalId) {
        throw new Error(
            'A project cannot be linked to a goal and marked as maintenance'
        );
    }
}

// Returns undefined when no goal was passed, null to unlink, or the ID of a
// goal the user owns.
async function resolveGoalId(params, userId) {
    const hasId = params.goal_id !== undefined;
    const hasUid = params.goal_uid !== undefined;
    if (!hasId && !hasUid) return undefined;

    const where = { user_id: userId };
    if (hasUid && params.goal_uid !== null && params.goal_uid !== '') {
        where.uid = params.goal_uid;
    } else if (hasId && params.goal_id !== null && params.goal_id !== '') {
        where.id = params.goal_id;
    } else {
        return null;
    }

    const goal = await Goal.findOne({ where, attributes: ['id'] });
    if (!goal) {
        throw new Error(`Goal not found: ${params.goal_uid || params.goal_id}`);
    }
    return goal.id;
}

function serializeGoal(goal) {
    return goal ? { id: goal.id, uid: goal.uid, title: goal.title } : null;
}

const projectIncludes = [
    { model: Area, as: 'Area' },
    { model: Tag, as: 'Tags' },
    { model: Goal, as: 'Goal', attributes: ['id', 'uid', 'title'] },
];

function registerProjectTools(server, context, tools) {
    // 1. list_projects - List projects
    tools.push({
        name: 'list_projects',
        description: 'List projects from tududi with optional filtering',
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
            const whereClause =
                await permissionsService.ownershipOrPermissionWhere(
                    'project',
                    context.userId
                );
            const limit = params.limit || 30;

            if (params.status && params.status !== 'all') {
                whereClause.status = params.status;
            }

            if (params.area_id) {
                whereClause.area_id = params.area_id;
            }

            const projects = await Project.findAll({
                where: whereClause,
                include: projectIncludes,
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
                    goal: serializeGoal(proj.Goal),
                    is_maintenance: !!proj.is_maintenance,
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

    // 2. get_project - Get a single project by UID
    tools.push({
        name: 'get_project',
        description: 'Get a specific project by its UID',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Project UID',
                },
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const project = await Project.findOne({
                where: { uid: params.uid },
                include: projectIncludes,
            });

            if (!project) {
                throw new Error(`Project not found: ${params.uid}`);
            }

            const access = await permissionsService.getAccess(
                context.userId,
                'project',
                project.uid
            );
            if (access === permissionsService.ACCESS.NONE) {
                throw new Error(`Project not found: ${params.uid}`);
            }

            const proj = project.toJSON();
            const serialized = {
                id: proj.id,
                uid: proj.uid,
                name: proj.name,
                description: proj.description,
                status: proj.status,
                priority: proj.priority,
                area: proj.Area ? proj.Area.name : null,
                goal: serializeGoal(proj.Goal),
                is_maintenance: !!proj.is_maintenance,
                tags: proj.Tags ? proj.Tags.map((t) => t.name) : [],
                due_date_at: proj.due_date_at,
                pin_to_sidebar: proj.pin_to_sidebar,
                created_at: proj.created_at,
                updated_at: proj.updated_at,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ project: serialized }, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_project - Create new project
    tools.push({
        name: 'create_project',
        description: 'Create a new project in tududi',
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
                image_url: {
                    type: 'string',
                    description:
                        'Image URL (upload via POST /api/upload/project-image first)',
                },
                ...goalInputProperties,
            },
            required: ['name'],
        },
        handler: async (params) => {
            const goalId = await resolveGoalId(params, context.userId);
            assertNotGoalAndMaintenance(params, goalId);
            const projectData = {
                user_id: context.userId,
                name: params.name,
                description: params.description || '',
                priority: params.priority !== undefined ? params.priority : 1,
                status: params.status || 'not_started',
                area_id: params.area_id || null,
                due_date_at: params.due_date_at || null,
                image_url: params.image_url || null,
                goal_id: goalId || null,
                is_maintenance: params.is_maintenance === true,
            };

            await rolesService.assertCan(context.userId, 'create_projects');
            await entitlements.assertCanCreate(context.userId, 'project');
            const project = await sequelize.transaction(async (transaction) => {
                const project = await Project.create(projectData, {
                    transaction,
                });

                const tagInstances = await resolveTagsForTransaction(
                    params.tags,
                    context.userId,
                    transaction
                );
                if (tagInstances !== undefined) {
                    await project.setTags(tagInstances, { transaction });
                }

                return project;
            });

            if (projectData.area_id || projectData.goal_id) {
                await syncProjectSharesFromContainer(project.id);
            }

            const reloadedProject = await Project.findByPk(project.id, {
                include: projectIncludes,
            });

            const serialized = {
                id: reloadedProject.id,
                uid: reloadedProject.uid,
                name: reloadedProject.name,
                description: reloadedProject.description,
                status: reloadedProject.status,
                priority: reloadedProject.priority,
                area: reloadedProject.Area ? reloadedProject.Area.name : null,
                goal: serializeGoal(reloadedProject.Goal),
                is_maintenance: !!reloadedProject.is_maintenance,
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

    // 4. update_project - Update existing project
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
                image_url: {
                    type: 'string',
                    description:
                        'Image URL (upload via POST /api/upload/project-image first)',
                },
                ...goalInputProperties,
            },
            required: ['uid'],
        },
        handler: async (params) => {
            const project = await Project.findOne({
                where: { uid: params.uid },
            });

            if (!project) {
                throw new Error(`Project not found: ${params.uid}`);
            }

            const access = await permissionsService.getAccess(
                context.userId,
                'project',
                project.uid
            );
            const canWrite =
                project.user_id === context.userId ||
                access === permissionsService.ACCESS.RW ||
                access === permissionsService.ACCESS.ADMIN;
            if (!canWrite) {
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
            if (params.image_url !== undefined)
                updates.image_url =
                    params.image_url === '' ? null : params.image_url;

            const goalId = await resolveGoalId(params, context.userId);
            assertNotGoalAndMaintenance(params, goalId);
            if (goalId !== undefined) updates.goal_id = goalId;
            if (params.is_maintenance !== undefined) {
                updates.is_maintenance = params.is_maintenance === true;
                if (updates.is_maintenance && project.goal_id) {
                    updates.goal_id = null;
                }
            } else if (goalId) {
                updates.is_maintenance = false;
            }
            if (
                updates.goal_id !== undefined &&
                project.user_id !== context.userId
            ) {
                throw new Error('Only the project owner can change its goal');
            }

            await project.update(updates);

            if (
                project.user_id === context.userId &&
                (updates.area_id !== undefined || updates.goal_id !== undefined)
            ) {
                await syncProjectSharesFromContainer(project.id);
            }

            const reloadedProject = await Project.findByPk(project.id, {
                include: projectIncludes,
            });

            const serialized = {
                id: reloadedProject.id,
                uid: reloadedProject.uid,
                name: reloadedProject.name,
                description: reloadedProject.description,
                status: reloadedProject.status,
                priority: reloadedProject.priority,
                area: reloadedProject.Area ? reloadedProject.Area.name : null,
                goal: serializeGoal(reloadedProject.Goal),
                is_maintenance: !!reloadedProject.is_maintenance,
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

    // 5. delete_project - Delete a project (owner only)
    tools.push({
        name: 'delete_project',
        description: 'Delete a project and all its tasks (notes are orphaned)',
        inputSchema: {
            type: 'object',
            properties: {
                uid: {
                    type: 'string',
                    description: 'Project UID',
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

            await projectsRepository.deleteWithOrphaning(
                project,
                context.userId
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            { message: 'Project deleted successfully' },
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
