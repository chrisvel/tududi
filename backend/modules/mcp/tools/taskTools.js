'use strict';

const taskRepository = require('../../tasks/repository');
const {
    serializeTask,
    serializeTasks,
} = require('../../tasks/core/serializers');
const { buildTaskAttributes } = require('../../tasks/core/builders');
const { Op } = require('sequelize');
const { Task, Project, Tag } = require('../../../models');
const { validateProjectAccess } = require('../../tasks/utils/validation');
const permissionsService = require('../../../services/permissionsService');

async function findTaskByIdentifier(identifier) {
    const isNumeric = !isNaN(identifier);

    const includeOptions = [
        { model: Project, as: 'Project' },
        { model: Tag, as: 'Tags' },
        {
            model: Task,
            as: 'Subtasks',
            required: false,
            include: [
                {
                    model: Tag,
                    as: 'Tags',
                    through: { attributes: [] },
                },
            ],
            separate: true,
            order: [
                ['order', 'ASC'],
                ['created_at', 'ASC'],
            ],
        },
    ];

    if (isNumeric) {
        return await taskRepository.findById(parseInt(identifier), {
            include: includeOptions,
        });
    } else {
        return await taskRepository.findByUid(identifier, {
            include: includeOptions,
        });
    }
}

function registerTaskTools(server, context, tools) {
    // 1. list_tasks - List tasks with filtering
    tools.push({
        name: 'list_tasks',
        description: 'List tasks from tududi with optional filtering',
        inputSchema: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['today', 'upcoming', 'completed', 'archived', 'all'],
                    description: 'Filter tasks by type',
                },
                status: {
                    type: 'string',
                    enum: [
                        'not_started',
                        'pending',
                        'in_progress',
                        'done',
                        'completed',
                        'archived',
                        'waiting',
                        'cancelled',
                        'planned',
                    ],
                    description: 'Filter by status',
                },
                project_id: {
                    type: 'number',
                    description: 'Filter by project ID',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum number of tasks to return',
                    default: 50,
                },
            },
        },
        handler: async (params) => {
            const whereClause =
                await permissionsService.ownershipOrPermissionWhere(
                    'task',
                    context.userId
                );
            const limit = params.limit || 50;

            if (params.status) {
                const statusMap = {
                    not_started: 0,
                    pending: 0,
                    in_progress: 1,
                    done: 2,
                    completed: 2,
                    archived: 3,
                    waiting: 4,
                    cancelled: 5,
                    planned: 6,
                };
                whereClause.status = statusMap[params.status];
            }

            if (params.project_id) {
                whereClause.project_id = params.project_id;
            }

            if (params.type === 'completed') {
                whereClause.status = 2;
            } else if (params.type === 'archived') {
                whereClause.status = 3;
            } else if (params.type === 'today' || params.type === 'upcoming') {
                whereClause.status = { [Op.ne]: 3 };
            }

            const tasks = await taskRepository.findAll(whereClause, {
                include: [
                    { model: Project, as: 'Project' },
                    { model: Tag, as: 'Tags' },
                ],
                limit: limit,
                order: [['created_at', 'DESC']],
            });

            const serializedTasks = await serializeTasks(
                tasks,
                context.user.timezone
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                count: serializedTasks.length,
                                tasks: serializedTasks,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 2. get_task - Get single task by ID or UID
    tools.push({
        name: 'get_task',
        description: 'Get a specific task by ID or UID with full details',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: ['number', 'string'],
                    description: 'Task ID (number) or UID (string)',
                },
            },
            required: ['id'],
        },
        handler: async (params) => {
            const task = await findTaskByIdentifier(params.id);

            if (!task) {
                throw new Error(`Task not found: ${params.id}`);
            }

            const access = await permissionsService.getAccess(
                context.userId,
                'task',
                task.uid
            );
            if (access === permissionsService.ACCESS.NONE) {
                throw new Error(`Task not found: ${params.id}`);
            }

            const serialized = await serializeTask(task, context.user.timezone);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(serialized, null, 2),
                    },
                ],
            };
        },
    });

    // 3. create_task - Create new task
    tools.push({
        name: 'create_task',
        description: 'Create a new task in tududi',
        inputSchema: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'Task name (required)',
                },
                description: {
                    type: 'string',
                    description: 'Task description/note',
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                    description: 'Task priority',
                },
                due_date: {
                    type: 'string',
                    description: 'Due date (ISO 8601 format)',
                },
                project_id: {
                    type: 'number',
                    description: 'Project ID to assign task to',
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
            const priorityMap = { low: 0, medium: 1, high: 2 };

            // Validate project access before creating task
            const resolvedProjectId = params.project_id
                ? await validateProjectAccess(params.project_id, context.userId)
                : null;

            const taskData = {
                user_id: context.userId,
                name: params.name,
                note: params.description || '',
                priority: params.priority ? priorityMap[params.priority] : 1,
                status: 0, // pending
                due_date: params.due_date || null,
                project_id: resolvedProjectId,
            };

            const task = await taskRepository.create(taskData);

            if (params.tags && params.tags.length > 0) {
                const tagInstances = await Promise.all(
                    params.tags.map(async (tagName) => {
                        const [tag] = await Tag.findOrCreate({
                            where: { name: tagName, user_id: context.userId },
                        });
                        return tag;
                    })
                );
                await task.setTags(tagInstances);
            }

            const reloadedTask = await taskRepository.findByIdAndUser(
                task.id,
                context.userId,
                {
                    include: [
                        { model: Project, as: 'Project' },
                        { model: Tag, as: 'Tags' },
                    ],
                }
            );

            const serialized = await serializeTask(
                reloadedTask,
                context.user.timezone
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Task created successfully',
                                task: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 4. update_task - Update existing task
    tools.push({
        name: 'update_task',
        description: 'Update an existing task',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: ['number', 'string'],
                    description: 'Task ID or UID',
                },
                name: { type: 'string', description: 'New task name' },
                description: { type: 'string', description: 'New description' },
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                },
                status: {
                    type: 'string',
                    enum: [
                        'not_started',
                        'pending',
                        'in_progress',
                        'done',
                        'completed',
                        'archived',
                        'waiting',
                        'cancelled',
                        'planned',
                    ],
                },
                due_date: { type: 'string', description: 'New due date' },
                project_id: {
                    type: 'number',
                    description:
                        'Project ID to assign task to (use null to remove project)',
                },
                today: {
                    type: 'boolean',
                    description: 'Add to Today list',
                },
            },
            required: ['id'],
        },
        handler: async (params) => {
            const task = await findTaskByIdentifier(params.id);

            if (!task) {
                throw new Error(`Task not found: ${params.id}`);
            }

            const access = await permissionsService.getAccess(
                context.userId,
                'task',
                task.uid
            );
            const canWrite =
                task.user_id === context.userId ||
                access === permissionsService.ACCESS.RW ||
                access === permissionsService.ACCESS.ADMIN;
            if (!canWrite) {
                throw new Error('Access denied');
            }

            const updates = {};
            if (params.name !== undefined) updates.name = params.name;
            if (params.description !== undefined)
                updates.note = params.description;
            if (params.priority) {
                const priorityMap = { low: 0, medium: 1, high: 2 };
                updates.priority = priorityMap[params.priority];
            }
            if (params.status) {
                const statusMap = {
                    not_started: 0,
                    pending: 0,
                    in_progress: 1,
                    done: 2,
                    completed: 2,
                    archived: 3,
                    waiting: 4,
                    cancelled: 5,
                    planned: 6,
                };
                updates.status = statusMap[params.status];
            }
            if (params.due_date !== undefined)
                updates.due_date = params.due_date;
            if (params.project_id !== undefined) {
                const validProjectId = await validateProjectAccess(
                    params.project_id,
                    context.userId
                );
                updates.project_id = validProjectId;
            }
            if (params.today !== undefined) updates.today = params.today;

            await task.update(updates);

            const reloadedTask = await taskRepository.findById(task.id, {
                include: [
                    { model: Project, as: 'Project' },
                    { model: Tag, as: 'Tags' },
                ],
            });

            const serialized = await serializeTask(
                reloadedTask,
                context.user.timezone
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Task updated successfully',
                                task: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 5. complete_task - Toggle task completion
    tools.push({
        name: 'complete_task',
        description: 'Mark a task as completed or reopen it',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: ['number', 'string'],
                    description: 'Task ID or UID',
                },
            },
            required: ['id'],
        },
        handler: async (params) => {
            const task = await findTaskByIdentifier(params.id);

            if (!task) {
                throw new Error(`Task not found: ${params.id}`);
            }

            const access = await permissionsService.getAccess(
                context.userId,
                'task',
                task.uid
            );
            const canWrite =
                task.user_id === context.userId ||
                access === permissionsService.ACCESS.RW ||
                access === permissionsService.ACCESS.ADMIN;
            if (!canWrite) {
                throw new Error('Access denied');
            }

            const newStatus = task.status === 2 ? 0 : 2;
            const updates = {
                status: newStatus,
                completed_at: newStatus === 2 ? new Date() : null,
            };

            await task.update(updates);

            const reloadedTask = await taskRepository.findById(task.id, {
                include: [
                    { model: Project, as: 'Project' },
                    { model: Tag, as: 'Tags' },
                ],
            });

            const serialized = await serializeTask(
                reloadedTask,
                context.user.timezone
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message:
                                    newStatus === 2
                                        ? 'Task completed'
                                        : 'Task reopened',
                                task: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 6. delete_task - Delete task (owner only)
    tools.push({
        name: 'delete_task',
        description: 'Permanently delete a task',
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: ['number', 'string'],
                    description: 'Task ID or UID',
                },
            },
            required: ['id'],
        },
        handler: async (params) => {
            const task = await findTaskByIdentifier(params.id);

            if (!task) {
                throw new Error(`Task not found: ${params.id}`);
            }

            if (task.user_id !== context.userId) {
                throw new Error('Access denied');
            }

            await task.destroy();

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Task deleted successfully',
                                task_id: params.id,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 7. add_subtask - Add subtask to parent
    tools.push({
        name: 'add_subtask',
        description: 'Add a subtask to an existing task',
        inputSchema: {
            type: 'object',
            properties: {
                parent_id: {
                    type: ['number', 'string'],
                    description: 'Parent task ID or UID',
                },
                name: {
                    type: 'string',
                    description: 'Subtask name',
                },
                priority: {
                    type: 'string',
                    enum: ['low', 'medium', 'high'],
                },
                due_date: {
                    type: 'string',
                    description: 'Due date',
                },
            },
            required: ['parent_id', 'name'],
        },
        handler: async (params) => {
            const parentTask = await findTaskByIdentifier(params.parent_id);

            if (!parentTask) {
                throw new Error(`Parent task not found: ${params.parent_id}`);
            }

            const access = await permissionsService.getAccess(
                context.userId,
                'task',
                parentTask.uid
            );
            const canWrite =
                parentTask.user_id === context.userId ||
                access === permissionsService.ACCESS.RW ||
                access === permissionsService.ACCESS.ADMIN;
            if (!canWrite) {
                throw new Error('Access denied');
            }

            const priorityMap = { low: 0, medium: 1, high: 2 };

            const subtaskData = {
                user_id: context.userId,
                name: params.name,
                parent_task_id: parentTask.id,
                priority: params.priority ? priorityMap[params.priority] : 1,
                status: 0,
                due_date: params.due_date || null,
                project_id: parentTask.project_id,
            };

            const subtask = await taskRepository.create(subtaskData);

            const reloadedSubtask = await taskRepository.findByIdAndUser(
                subtask.id,
                context.userId,
                {
                    include: [
                        { model: Project, as: 'Project' },
                        { model: Tag, as: 'Tags' },
                    ],
                }
            );

            const serialized = await serializeTask(
                reloadedSubtask,
                context.user.timezone
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(
                            {
                                message: 'Subtask created successfully',
                                subtask: serialized,
                            },
                            null,
                            2
                        ),
                    },
                ],
            };
        },
    });

    // 8. get_task_metrics - Get task statistics
    tools.push({
        name: 'get_task_metrics',
        description: 'Get task statistics and productivity metrics',
        inputSchema: {
            type: 'object',
            properties: {},
        },
        handler: async (params) => {
            const openCount = await taskRepository.count({
                user_id: context.userId,
                status: { [Op.in]: [0, 1] },
            });

            const completedCount = await taskRepository.count({
                user_id: context.userId,
                status: 2,
            });

            const now = new Date();
            const overdueCount = await taskRepository.count({
                user_id: context.userId,
                status: { [Op.in]: [0, 1] },
                due_date: { [Op.lt]: now },
            });

            const inProgressCount = await taskRepository.count({
                user_id: context.userId,
                status: 1,
            });

            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const todayCompletions = await taskRepository.count({
                user_id: context.userId,
                status: 2,
                completed_at: { [Op.gte]: startOfDay },
            });

            const startOfWeek = new Date();
            startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            const weekCompletions = await taskRepository.count({
                user_id: context.userId,
                status: 2,
                completed_at: { [Op.gte]: startOfWeek },
            });

            const metrics = {
                open_tasks: openCount,
                completed_tasks: completedCount,
                overdue_tasks: overdueCount,
                in_progress_tasks: inProgressCount,
                completed_today: todayCompletions,
                completed_this_week: weekCompletions,
            };

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(metrics, null, 2),
                    },
                ],
            };
        },
    });
}

module.exports = { registerTaskTools };
