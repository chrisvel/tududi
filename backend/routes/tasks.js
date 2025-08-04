const express = require('express');
const { Task, Tag, Project, TaskEvent, sequelize } = require('../models');
const { Op } = require('sequelize');
const RecurringTaskService = require('../services/recurringTaskService');
const TaskEventService = require('../services/taskEventService');
const moment = require('moment-timezone');
const router = express.Router();

// Helper function to validate tag name (same as in tags.js)
function validateTagName(name) {
    if (!name || !name.trim()) {
        return { valid: false, error: 'Tag name is required' };
    }

    const trimmedName = name.trim();

    // Check for invalid characters that can break URLs or cause issues
    const invalidChars = /[#%&{}\\<>*?/$!'":@+`|=]/;
    if (invalidChars.test(trimmedName)) {
        return {
            valid: false,
            error: 'Tag name contains invalid characters. Please avoid: # % & { } \\ < > * ? / $ ! \' " : @ + ` | =',
        };
    }

    // Check length limits
    if (trimmedName.length > 50) {
        return {
            valid: false,
            error: 'Tag name must be 50 characters or less',
        };
    }

    if (trimmedName.length < 1) {
        return { valid: false, error: 'Tag name cannot be empty' };
    }

    return { valid: true, name: trimmedName };
}

// Helper function to serialize task with today move count
async function serializeTask(task) {
    const taskJson = task.toJSON();
    const todayMoveCount = await TaskEventService.getTaskTodayMoveCount(
        task.id
    );

    // Include subtasks if they exist
    const { Subtasks, ...taskWithoutSubtasks } = taskJson;

    return {
        ...taskWithoutSubtasks,
        nanoid: task.nanoid, // Explicitly include nanoid
        tags: taskJson.Tags || [],
        Project: taskJson.Project
            ? {
                  ...taskJson.Project,
                  nanoid: taskJson.Project.nanoid, // Explicitly include Project nanoid
              }
            : null,
        subtasks: Subtasks
            ? Subtasks.map((subtask) => ({
                  ...subtask,
                  nanoid: subtask.nanoid, // Also include nanoid for subtasks
                  tags: subtask.Tags || [],
                  due_date: subtask.due_date
                      ? subtask.due_date.toISOString().split('T')[0]
                      : null,
                  completed_at: subtask.completed_at
                      ? subtask.completed_at.toISOString()
                      : null,
              }))
            : [],
        due_date: task.due_date
            ? task.due_date.toISOString().split('T')[0]
            : null,
        completed_at: task.completed_at
            ? task.completed_at.toISOString()
            : null,
        today_move_count: todayMoveCount,
    };
}

// Helper function to update task tags
async function updateTaskTags(task, tagsData, userId) {
    if (!tagsData) return;

    // Validate and filter tag names
    const validTagNames = [];
    const invalidTags = [];

    for (const tag of tagsData) {
        const validation = validateTagName(tag.name);
        if (validation.valid) {
            // Check for duplicates
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name: tag.name, error: validation.error });
        }
    }

    // If there are invalid tags, throw an error
    if (invalidTags.length > 0) {
        throw new Error(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }

    if (validTagNames.length === 0) {
        await task.setTags([]);
        return;
    }

    // Find existing tags
    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: validTagNames },
    });

    // Create new tags
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = validTagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => Tag.create({ name, user_id: userId }))
    );

    // Set all tags to task
    const allTags = [...existingTags, ...createdTags];
    await task.setTags(allTags);
}

// Helper function to check if all subtasks are done and update parent task
async function checkAndUpdateParentTaskCompletion(parentTaskId, userId) {
    try {
        // Get all subtasks for the parent task
        const subtasks = await Task.findAll({
            where: {
                parent_task_id: parentTaskId,
                user_id: userId,
            },
        });

        // Check if all subtasks are done
        const allSubtasksDone =
            subtasks.length > 0 &&
            subtasks.every(
                (subtask) =>
                    subtask.status === Task.STATUS.DONE ||
                    subtask.status === 'done'
            );

        if (allSubtasksDone) {
            // Check if parent is already done to avoid unnecessary updates
            const parentTask = await Task.findOne({
                where: {
                    id: parentTaskId,
                    user_id: userId,
                },
            });

            if (
                parentTask &&
                parentTask.status !== Task.STATUS.DONE &&
                parentTask.status !== 'done'
            ) {
                // Update parent task to done
                await Task.update(
                    {
                        status: Task.STATUS.DONE,
                        completed_at: new Date(),
                    },
                    {
                        where: {
                            id: parentTaskId,
                            user_id: userId,
                        },
                    }
                );
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking parent task completion:', error);
        return false;
    }
}

// Helper function to undone parent task when subtask gets undone
async function undoneParentTaskIfNeeded(parentTaskId, userId) {
    try {
        // Get parent task
        const parentTask = await Task.findOne({
            where: {
                id: parentTaskId,
                user_id: userId,
            },
        });

        // If parent is done, undone it
        if (
            parentTask &&
            (parentTask.status === Task.STATUS.DONE ||
                parentTask.status === 'done')
        ) {
            await Task.update(
                {
                    status: Task.STATUS.NOT_STARTED,
                    completed_at: null,
                },
                {
                    where: {
                        id: parentTaskId,
                        user_id: userId,
                    },
                }
            );
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error undoing parent task:', error);
        return false;
    }
}

// Helper function to complete all subtasks when parent is done
async function completeAllSubtasks(parentTaskId, userId) {
    try {
        // Update all subtasks to be completed - this ensures completed_at is set for all
        const result = await Task.update(
            {
                status: Task.STATUS.DONE,
                completed_at: new Date(),
            },
            {
                where: {
                    parent_task_id: parentTaskId,
                    user_id: userId,
                },
            }
        );
        return result[0] > 0; // Return true if any subtasks were actually updated
    } catch (error) {
        console.error('Error completing all subtasks:', error);
        return false;
    }
}

// Helper function to undone all subtasks when parent is undone
async function undoneAllSubtasks(parentTaskId, userId) {
    try {
        const result = await Task.update(
            {
                status: Task.STATUS.NOT_STARTED,
                completed_at: null,
            },
            {
                where: {
                    parent_task_id: parentTaskId,
                    user_id: userId,
                    status: {
                        [Op.in]: [Task.STATUS.DONE, 'done'],
                    },
                },
            }
        );
        return result[0] > 0; // Return true if any subtasks were actually updated
    } catch (error) {
        console.error('Error undoing all subtasks:', error);
        return false;
    }
}

// Filter tasks by parameters
async function filterTasksByParams(params, userId) {
    let whereClause = {
        user_id: userId,
        parent_task_id: null, // Exclude subtasks from main task lists
    };
    let includeClause = [
        {
            model: Tag,
            attributes: ['id', 'name', 'nanoid'],
            through: { attributes: [] },
        },
        {
            model: Project,
            attributes: ['id', 'name', 'nanoid'],
            required: false,
        },
        {
            model: Task,
            as: 'Subtasks',
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                    required: false,
                },
            ],
            required: false,
        },
    ];

    // Filter by type
    switch (params.type) {
        case 'today':
            whereClause.status = {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            }; // Exclude completed and archived tasks (both integer and string values)
            break;
        case 'upcoming':
            whereClause.due_date = {
                [Op.between]: [
                    new Date(),
                    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                ],
            };
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'next':
            whereClause.due_date = null;
            whereClause.project_id = null;
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'inbox':
            whereClause[Op.or] = [{ due_date: null }, { project_id: null }];
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'someday':
            whereClause.due_date = null;
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'waiting':
            whereClause.status = Task.STATUS.WAITING;
            break;
        default:
            if (params.status === 'done') {
                whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
            } else if (!params.client_side_filtering) {
                // Only exclude completed tasks if not doing client-side filtering
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
        // If client_side_filtering is true, don't add any status filter (include all)
    }

    // Filter by tag
    if (params.tag) {
        includeClause[0].where = { name: params.tag };
        includeClause[0].required = true;
    }

    let orderClause = [['created_at', 'DESC']];

    // Special ordering for inbox - newest items first
    if (params.type === 'inbox') {
        orderClause = [['created_at', 'DESC']];
    }

    // Apply ordering
    if (params.order_by) {
        const [orderColumn, orderDirection = 'asc'] =
            params.order_by.split(':');
        const allowedColumns = [
            'created_at',
            'updated_at',
            'name',
            'priority',
            'status',
            'due_date',
        ];

        if (!allowedColumns.includes(orderColumn)) {
            throw new Error('Invalid order column specified.');
        }

        if (orderColumn === 'due_date') {
            orderClause = [
                [
                    sequelize.literal(
                        'CASE WHEN Task.due_date IS NULL THEN 1 ELSE 0 END'
                    ),
                    'ASC',
                ],
                ['due_date', orderDirection.toUpperCase()],
            ];
        } else {
            orderClause = [[orderColumn, orderDirection.toUpperCase()]];
        }
    }

    return await Task.findAll({
        where: whereClause,
        include: includeClause,
        order: orderClause,
        distinct: true,
    });
}

// Compute task metrics
async function computeTaskMetrics(userId, userTimezone = 'UTC') {
    const totalOpenTasks = await Task.count({
        where: { user_id: userId, status: { [Op.ne]: Task.STATUS.DONE } },
    });

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tasksPendingOverMonth = await Task.count({
        where: {
            user_id: userId,
            status: { [Op.ne]: Task.STATUS.DONE },
            created_at: { [Op.lt]: oneMonthAgo },
        },
    });

    const tasksInProgress = await Task.findAll({
        where: {
            user_id: userId,
            status: { [Op.in]: [Task.STATUS.IN_PROGRESS, 'in_progress'] },
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'nanoid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active', 'nanoid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'nanoid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
        order: [['priority', 'DESC']],
    });

    // Get tasks in today plan
    const todayPlanTasks = await Task.findAll({
        where: {
            user_id: userId,
            today: true,
            status: {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            },
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'nanoid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active', 'nanoid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'nanoid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
        order: [
            ['priority', 'DESC'],
            ['created_at', 'ASC'],
        ],
    });

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const tasksDueToday = await Task.findAll({
        where: {
            user_id: userId,
            status: {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            },
            [Op.or]: [
                { due_date: { [Op.lte]: today } },
                sequelize.literal(`EXISTS (
          SELECT 1 FROM projects 
          WHERE projects.id = Task.project_id 
          AND projects.due_date_at <= '${today.toISOString()}'
        )`),
            ],
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'nanoid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active', 'nanoid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'nanoid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
    });

    // Get suggested tasks only if user has a meaningful task base
    let suggestedTasks = [];

    // Only show suggested tasks if:
    // 1. User has at least 3 total tasks, OR
    // 2. User has at least 1 project with tasks
    if (
        totalOpenTasks >= 3 ||
        tasksInProgress.length > 0 ||
        tasksDueToday.length > 0
    ) {
        const excludedTaskIds = [
            ...tasksInProgress.map((t) => t.id),
            ...tasksDueToday.map((t) => t.id),
        ];

        // Get task IDs that have "someday" tag
        const somedayTaskIds = await sequelize
            .query(
                `SELECT DISTINCT task_id FROM tasks_tags 
       JOIN tags ON tasks_tags.tag_id = tags.id 
       WHERE tags.name = 'someday' AND tags.user_id = ?`,
                {
                    replacements: [userId],
                    type: sequelize.QueryTypes.SELECT,
                }
            )
            .then((results) => results.map((r) => r.task_id));

        // Get tasks without projects (excluding someday tagged tasks)
        const nonProjectTasks = await Task.findAll({
            where: {
                user_id: userId,
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                },
                id: { [Op.notIn]: [...excludedTaskIds, ...somedayTaskIds] },
                [Op.or]: [{ project_id: null }, { project_id: '' }],
            },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'active', 'nanoid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'nanoid'],
                            through: { attributes: [] },
                            required: false,
                        },
                    ],
                    required: false,
                },
            ],
            order: [
                ['priority', 'DESC'],
                ['created_at', 'ASC'],
            ],
            limit: 6,
        });

        // Get tasks with projects (excluding someday tagged tasks)
        const projectTasks = await Task.findAll({
            where: {
                user_id: userId,
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                },
                id: { [Op.notIn]: [...excludedTaskIds, ...somedayTaskIds] },
                project_id: { [Op.not]: null, [Op.ne]: '' },
            },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'active', 'nanoid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'nanoid'],
                            through: { attributes: [] },
                            required: false,
                        },
                    ],
                    required: false,
                },
            ],
            order: [
                ['priority', 'DESC'],
                ['created_at', 'ASC'],
            ],
            limit: 6,
        });

        // Check if we have enough suggestions (at least 6 total)
        let combinedTasks = [...nonProjectTasks, ...projectTasks];

        // If we don't have enough suggestions, include someday tasks as fallback
        if (combinedTasks.length < 6) {
            const usedTaskIds = [
                ...excludedTaskIds,
                ...combinedTasks.map((t) => t.id),
            ];

            const somedayFallbackTasks = await Task.findAll({
                where: {
                    user_id: userId,
                    status: {
                        [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                    },
                    id: {
                        [Op.notIn]: usedTaskIds,
                        [Op.in]: somedayTaskIds,
                    },
                },
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'nanoid'],
                        through: { attributes: [] },
                        required: false,
                    },
                    {
                        model: Project,
                        attributes: ['id', 'name', 'active', 'nanoid'],
                        required: false,
                    },
                    {
                        model: Task,
                        as: 'Subtasks',
                        include: [
                            {
                                model: Tag,
                                attributes: ['id', 'name', 'nanoid'],
                                through: { attributes: [] },
                                required: false,
                            },
                        ],
                        required: false,
                    },
                ],
                order: [
                    ['priority', 'DESC'],
                    ['created_at', 'ASC'],
                ],
                limit: 12 - combinedTasks.length,
            });

            combinedTasks = [...combinedTasks, ...somedayFallbackTasks];
        }

        suggestedTasks = combinedTasks;
    }

    // Get tasks completed today - use user's timezone
    const todayInUserTz = moment.tz(userTimezone);
    const todayStart = todayInUserTz.clone().startOf('day').utc().toDate();
    const todayEnd = todayInUserTz.clone().endOf('day').utc().toDate();

    const tasksCompletedToday = await Task.findAll({
        where: {
            user_id: userId,
            status: Task.STATUS.DONE,
            parent_task_id: null,
            completed_at: {
                [Op.between]: [todayStart, todayEnd],
            },
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'nanoid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active', 'nanoid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'nanoid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
        order: [['completed_at', 'DESC']],
    });

    // Get weekly completion data (last 7 days) - use user's timezone
    const weekStartInUserTz = moment.tz(userTimezone).subtract(6, 'days');
    const weekStart = weekStartInUserTz.clone().startOf('day').utc().toDate();
    const weekEnd = todayInUserTz.clone().endOf('day').utc().toDate();

    // For SQLite, we'll fetch the raw data and process it in JavaScript
    const weeklyCompletionsRaw = await Task.findAll({
        where: {
            user_id: userId,
            status: Task.STATUS.DONE,
            completed_at: {
                [Op.between]: [weekStart, weekEnd],
            },
        },
        attributes: ['completed_at'],
        raw: true,
    });

    // Process the data in JavaScript to group by date in user's timezone
    const dateCountMap = {};
    weeklyCompletionsRaw.forEach((task) => {
        // Parse the completed_at field more reliably - convert to Date first, then to moment
        const completedDate = new Date(task.completed_at);
        const dateInUserTz = moment(completedDate)
            .tz(userTimezone)
            .format('YYYY-MM-DD');
        dateCountMap[dateInUserTz] = (dateCountMap[dateInUserTz] || 0) + 1;
    });

    // Convert to the format expected by the rest of the code
    const weeklyCompletions = Object.entries(dateCountMap).map(
        ([date, count]) => ({
            date,
            count: count.toString(),
        })
    );

    // Process weekly completion data to ensure all 7 days are represented
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
        const dateInUserTz = moment.tz(userTimezone).subtract(i, 'days');
        const dateString = dateInUserTz.format('YYYY-MM-DD');

        const found = weeklyCompletions.find(
            (item) => item.date === dateString
        );
        const dayData = {
            date: dateString,
            count: found ? parseInt(found.count) : 0,
            dayName: dateInUserTz.format('ddd'), // Short day name
        };
        weeklyData.push(dayData);
    }

    return {
        total_open_tasks: totalOpenTasks,
        tasks_pending_over_month: tasksPendingOverMonth,
        tasks_in_progress_count: tasksInProgress.length,
        tasks_in_progress: tasksInProgress,
        tasks_due_today: tasksDueToday,
        today_plan_tasks: todayPlanTasks,
        suggested_tasks: suggestedTasks,
        tasks_completed_today: tasksCompletedToday,
        weekly_completions: weeklyData,
    };
}

// GET /api/tasks
router.get('/tasks', async (req, res) => {
    try {
        const tasks = await filterTasksByParams(req.query, req.currentUser.id);
        const metrics = await computeTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone
        );

        res.json({
            tasks: await Promise.all(tasks.map((task) => serializeTask(task))),
            metrics: {
                total_open_tasks: metrics.total_open_tasks,
                tasks_pending_over_month: metrics.tasks_pending_over_month,
                tasks_in_progress_count: metrics.tasks_in_progress_count,
                tasks_in_progress: await Promise.all(
                    metrics.tasks_in_progress.map((task) => serializeTask(task))
                ),
                tasks_due_today: await Promise.all(
                    metrics.tasks_due_today.map((task) => serializeTask(task))
                ),
                today_plan_tasks: await Promise.all(
                    metrics.today_plan_tasks.map((task) => serializeTask(task))
                ),
                suggested_tasks: await Promise.all(
                    metrics.suggested_tasks.map((task) => serializeTask(task))
                ),
                tasks_completed_today: await Promise.all(
                    metrics.tasks_completed_today.map(async (task) => {
                        const serialized = await serializeTask(task);
                        return {
                            ...serialized,
                            completed_at: task.completed_at
                                ? task.completed_at.toISOString()
                                : null,
                        };
                    })
                ),
                weekly_completions: metrics.weekly_completions,
            },
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        if (error.message === 'Invalid order column specified.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/task/uuid/:uuid
router.get('/task/uuid/:uuid', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { uuid: req.params.uuid, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(task);

        res.json(serializedTask);
    } catch (error) {
        console.error('Error fetching task by UUID:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/task/nanoid/:nanoid
router.get('/task/nanoid/:nanoid', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { nanoid: req.params.nanoid, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'nanoid'],
                            through: { attributes: [] },
                        },
                    ],
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(task);

        res.json(serializedTask);
    } catch (error) {
        console.error('Error fetching task by nanoid:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/task/:id
router.get('/task/:id', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { id: req.params.id, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'nanoid'],
                            through: { attributes: [] },
                        },
                    ],
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(task);

        res.json(serializedTask);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/task/:id/subtasks
router.get('/task/:id/subtasks', async (req, res) => {
    try {
        const subtasks = await Task.findAll({
            where: {
                parent_task_id: req.params.id,
                user_id: req.currentUser.id,
            },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
            ],
            order: [['created_at', 'ASC']],
        });

        const serializedSubtasks = await Promise.all(
            subtasks.map((subtask) => serializeTask(subtask))
        );

        res.json(serializedSubtasks);
    } catch (error) {
        console.error('Error fetching subtasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/task
router.post('/task', async (req, res) => {
    try {
        const {
            name,
            priority,
            due_date,
            status,
            note,
            project_id,
            parent_task_id,
            tags,
            Tags,
            subtasks,
            today,
            recurrence_type,
            recurrence_interval,
            recurrence_end_date,
            recurrence_weekday,
            recurrence_month_day,
            recurrence_week_of_month,
            completion_based,
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({ error: 'Task name is required.' });
        }

        const taskAttributes = {
            name: name.trim(),
            priority:
                priority !== undefined
                    ? typeof priority === 'string'
                        ? Task.getPriorityValue(priority)
                        : priority
                    : Task.PRIORITY.LOW,
            due_date: due_date || null,
            status:
                status !== undefined
                    ? typeof status === 'string'
                        ? Task.getStatusValue(status)
                        : status
                    : Task.STATUS.NOT_STARTED,
            note,
            today: today !== undefined ? today : false,
            user_id: req.currentUser.id,
            recurrence_type: recurrence_type || 'none',
            recurrence_interval: recurrence_interval || null,
            recurrence_end_date: recurrence_end_date || null,
            recurrence_weekday:
                recurrence_weekday !== undefined ? recurrence_weekday : null,
            recurrence_month_day:
                recurrence_month_day !== undefined
                    ? recurrence_month_day
                    : null,
            recurrence_week_of_month:
                recurrence_week_of_month !== undefined
                    ? recurrence_week_of_month
                    : null,
            completion_based: completion_based || false,
        };

        // Handle project assignment
        if (project_id && project_id.toString().trim()) {
            const project = await Project.findOne({
                where: { id: project_id, user_id: req.currentUser.id },
            });
            if (!project) {
                return res.status(400).json({ error: 'Invalid project.' });
            }
            taskAttributes.project_id = project_id;
        }

        // Handle parent task assignment
        if (parent_task_id && parent_task_id.toString().trim()) {
            const parentTask = await Task.findOne({
                where: { id: parent_task_id, user_id: req.currentUser.id },
            });
            if (!parentTask) {
                return res.status(400).json({ error: 'Invalid parent task.' });
            }
            taskAttributes.parent_task_id = parent_task_id;
        }

        const task = await Task.create(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);

        // Handle subtasks creation
        if (subtasks && Array.isArray(subtasks)) {
            const subtaskPromises = subtasks
                .filter((subtask) => subtask.name && subtask.name.trim())
                .map((subtask) =>
                    Task.create({
                        name: subtask.name.trim(),
                        parent_task_id: task.id,
                        user_id: req.currentUser.id,
                        priority: Task.PRIORITY.LOW,
                        status: Task.STATUS.NOT_STARTED,
                        today: false,
                        recurrence_type: 'none',
                        completion_based: false,
                    })
                );

            await Promise.all(subtaskPromises);
        }

        // Log task creation event
        try {
            await TaskEventService.logTaskCreated(
                task.id,
                req.currentUser.id,
                {
                    name: task.name,
                    status: task.status,
                    priority: task.priority,
                    due_date: task.due_date,
                    project_id: task.project_id,
                },
                { source: 'web' }
            );
        } catch (eventError) {
            console.error('Error logging task creation event:', eventError);
            // Don't fail the request if event logging fails
        }

        // Reload task with associations
        const taskWithAssociations = await Task.findByPk(task.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
            ],
        });

        const serializedTask = await serializeTask(taskWithAssociations);

        res.status(201).json(serializedTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(400).json({
            error: 'There was a problem creating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// PATCH /api/task/:id
router.patch('/task/:id', async (req, res) => {
    try {
        const {
            name,
            priority,
            status,
            note,
            due_date,
            project_id,
            parent_task_id,
            tags,
            Tags,
            subtasks,
            today,
            recurrence_type,
            recurrence_interval,
            recurrence_end_date,
            recurrence_weekday,
            recurrence_month_day,
            recurrence_week_of_month,
            completion_based,
            update_parent_recurrence,
        } = req.body;

        // Handle both tags and Tags (Sequelize association format)
        const tagsData = tags || Tags;

        const task = await Task.findOne({
            where: { id: req.params.id, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        // Capture old values for event logging
        const oldValues = {
            name: task.name,
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            project_id: task.project_id,
            note: task.note,
            recurrence_type: task.recurrence_type,
            recurrence_interval: task.recurrence_interval,
            recurrence_end_date: task.recurrence_end_date,
            recurrence_weekday: task.recurrence_weekday,
            recurrence_month_day: task.recurrence_month_day,
            recurrence_week_of_month: task.recurrence_week_of_month,
            completion_based: task.completion_based,
            tags: task.Tags
                ? task.Tags.map((tag) => ({ id: tag.id, name: tag.name }))
                : [],
        };

        // Handle updating parent recurrence settings if this is a child task
        if (update_parent_recurrence && task.recurring_parent_id) {
            const parentTask = await Task.findOne({
                where: {
                    id: task.recurring_parent_id,
                    user_id: req.currentUser.id,
                },
            });

            if (parentTask) {
                await parentTask.update({
                    recurrence_type:
                        recurrence_type !== undefined
                            ? recurrence_type
                            : parentTask.recurrence_type,
                    recurrence_interval:
                        recurrence_interval !== undefined
                            ? recurrence_interval
                            : parentTask.recurrence_interval,
                    recurrence_end_date:
                        recurrence_end_date !== undefined
                            ? recurrence_end_date
                            : parentTask.recurrence_end_date,
                    recurrence_weekday:
                        recurrence_weekday !== undefined
                            ? recurrence_weekday
                            : parentTask.recurrence_weekday,
                    recurrence_month_day:
                        recurrence_month_day !== undefined
                            ? recurrence_month_day
                            : parentTask.recurrence_month_day,
                    recurrence_week_of_month:
                        recurrence_week_of_month !== undefined
                            ? recurrence_week_of_month
                            : parentTask.recurrence_week_of_month,
                    completion_based:
                        completion_based !== undefined
                            ? completion_based
                            : parentTask.completion_based,
                });
            }
        }

        const taskAttributes = {
            name,
            priority:
                priority !== undefined
                    ? typeof priority === 'string'
                        ? Task.getPriorityValue(priority)
                        : priority
                    : undefined,
            status:
                status !== undefined
                    ? typeof status === 'string'
                        ? Task.getStatusValue(status)
                        : status
                    : Task.STATUS.NOT_STARTED,
            note,
            due_date: due_date || null,
            today: today !== undefined ? today : task.today,
            recurrence_type:
                recurrence_type !== undefined
                    ? recurrence_type
                    : task.recurrence_type,
            recurrence_interval:
                recurrence_interval !== undefined
                    ? recurrence_interval
                    : task.recurrence_interval,
            recurrence_end_date:
                recurrence_end_date !== undefined
                    ? recurrence_end_date
                    : task.recurrence_end_date,
            recurrence_weekday:
                recurrence_weekday !== undefined
                    ? recurrence_weekday
                    : task.recurrence_weekday,
            recurrence_month_day:
                recurrence_month_day !== undefined
                    ? recurrence_month_day
                    : task.recurrence_month_day,
            recurrence_week_of_month:
                recurrence_week_of_month !== undefined
                    ? recurrence_week_of_month
                    : task.recurrence_week_of_month,
            completion_based:
                completion_based !== undefined
                    ? completion_based
                    : task.completion_based,
        };

        // If task is being moved away from today and has in_progress status, change it to not_started
        if (
            today !== undefined &&
            task.today === true &&
            today === false &&
            task.status === Task.STATUS.IN_PROGRESS
        ) {
            taskAttributes.status = Task.STATUS.NOT_STARTED;
        }

        // Set completed_at when task is marked as done
        if (status !== undefined) {
            const newStatus =
                typeof status === 'string'
                    ? Task.getStatusValue(status)
                    : status;
            const oldStatus =
                typeof task.status === 'string'
                    ? Task.getStatusValue(task.status)
                    : task.status;

            if (
                newStatus === Task.STATUS.DONE &&
                oldStatus !== Task.STATUS.DONE
            ) {
                // Task is being completed
                taskAttributes.completed_at = new Date();
            } else if (
                newStatus !== Task.STATUS.DONE &&
                oldStatus === Task.STATUS.DONE
            ) {
                // Task is being uncompleted
                taskAttributes.completed_at = null;
            }
        }

        // Handle project assignment
        if (project_id && project_id.toString().trim()) {
            const project = await Project.findOne({
                where: { id: project_id, user_id: req.currentUser.id },
            });
            if (!project) {
                return res.status(400).json({ error: 'Invalid project.' });
            }
            taskAttributes.project_id = project_id;
        } else {
            taskAttributes.project_id = null;
        }

        // Handle parent task assignment
        if (parent_task_id && parent_task_id.toString().trim()) {
            const parentTask = await Task.findOne({
                where: { id: parent_task_id, user_id: req.currentUser.id },
            });
            if (!parentTask) {
                return res.status(400).json({ error: 'Invalid parent task.' });
            }
            taskAttributes.parent_task_id = parent_task_id;
        } else if (parent_task_id === null || parent_task_id === '') {
            taskAttributes.parent_task_id = null;
        }

        await task.update(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);

        // Handle subtasks updates
        if (subtasks && Array.isArray(subtasks)) {
            // Delete existing subtasks that are not in the new list
            const existingSubtasks = await Task.findAll({
                where: { parent_task_id: task.id, user_id: req.currentUser.id },
            });

            const subtasksToKeep = subtasks.filter((s) => s.id && !s.isNew);
            const subtasksToDelete = existingSubtasks.filter(
                (existing) =>
                    !subtasksToKeep.find((keep) => keep.id === existing.id)
            );

            // Delete removed subtasks
            if (subtasksToDelete.length > 0) {
                await Task.destroy({
                    where: {
                        id: subtasksToDelete.map((s) => s.id),
                        user_id: req.currentUser.id,
                    },
                });
            }

            // Update edited subtasks and status changes
            const subtasksToUpdate = subtasks.filter(
                (s) =>
                    s.id &&
                    ((s.isEdited && s.name && s.name.trim()) ||
                        s._statusChanged)
            );
            if (subtasksToUpdate.length > 0) {
                const updatePromises = subtasksToUpdate.map((subtask) => {
                    const updateData = {};

                    if (
                        subtask.isEdited &&
                        subtask.name &&
                        subtask.name.trim()
                    ) {
                        updateData.name = subtask.name.trim();
                    }

                    if (
                        subtask._statusChanged ||
                        subtask.status !== undefined
                    ) {
                        updateData.status = subtask.status
                            ? typeof subtask.status === 'string'
                                ? Task.getStatusValue(subtask.status)
                                : subtask.status
                            : Task.STATUS.NOT_STARTED;

                        if (
                            updateData.status === Task.STATUS.DONE &&
                            !subtask.completed_at
                        ) {
                            updateData.completed_at = new Date();
                        } else if (updateData.status !== Task.STATUS.DONE) {
                            updateData.completed_at = null;
                        }
                    }

                    if (subtask.priority !== undefined) {
                        updateData.priority = subtask.priority
                            ? typeof subtask.priority === 'string'
                                ? Task.getPriorityValue(subtask.priority)
                                : subtask.priority
                            : Task.PRIORITY.LOW;
                    }

                    return Task.update(updateData, {
                        where: {
                            id: subtask.id,
                            user_id: req.currentUser.id,
                        },
                    });
                });

                await Promise.all(updatePromises);
            }

            // Create new subtasks
            const newSubtasks = subtasks.filter(
                (s) => s.isNew && s.name && s.name.trim()
            );
            if (newSubtasks.length > 0) {
                const subtaskPromises = newSubtasks.map((subtask) =>
                    Task.create({
                        name: subtask.name.trim(),
                        parent_task_id: task.id,
                        user_id: req.currentUser.id,
                        priority: subtask.priority
                            ? typeof subtask.priority === 'string'
                                ? Task.getPriorityValue(subtask.priority)
                                : subtask.priority
                            : Task.PRIORITY.LOW,
                        status: subtask.status
                            ? typeof subtask.status === 'string'
                                ? Task.getStatusValue(subtask.status)
                                : subtask.status
                            : Task.STATUS.NOT_STARTED,
                        completed_at:
                            subtask.status === 'done' ||
                            subtask.status === Task.STATUS.DONE
                                ? subtask.completed_at
                                    ? new Date(subtask.completed_at)
                                    : new Date()
                                : null,
                        today: subtask.today || false,
                        recurrence_type: 'none',
                        completion_based: false,
                    })
                );

                await Promise.all(subtaskPromises);
            }
        }

        // Log task update events
        try {
            const changes = {};

            // Check for changes in each field
            if (name !== undefined && name !== oldValues.name) {
                changes.name = { oldValue: oldValues.name, newValue: name };
            }
            if (status !== undefined && status !== oldValues.status) {
                changes.status = {
                    oldValue: oldValues.status,
                    newValue: status,
                };
            }
            if (priority !== undefined && priority !== oldValues.priority) {
                changes.priority = {
                    oldValue: oldValues.priority,
                    newValue: priority,
                };
            }
            if (due_date !== undefined) {
                // Normalize dates for comparison (convert to YYYY-MM-DD format)
                const oldDateStr = oldValues.due_date
                    ? oldValues.due_date.toISOString().split('T')[0]
                    : null;
                const newDateStr = due_date || null;

                if (oldDateStr !== newDateStr) {
                    changes.due_date = {
                        oldValue: oldValues.due_date,
                        newValue: due_date,
                    };
                }
            }
            if (
                project_id !== undefined &&
                project_id !== oldValues.project_id
            ) {
                changes.project_id = {
                    oldValue: oldValues.project_id,
                    newValue: project_id,
                };
            }
            if (note !== undefined && note !== oldValues.note) {
                changes.note = { oldValue: oldValues.note, newValue: note };
            }

            // Check recurrence field changes
            if (
                recurrence_type !== undefined &&
                recurrence_type !== oldValues.recurrence_type
            ) {
                changes.recurrence_type = {
                    oldValue: oldValues.recurrence_type,
                    newValue: recurrence_type,
                };
            }
            if (
                recurrence_interval !== undefined &&
                recurrence_interval !== oldValues.recurrence_interval
            ) {
                changes.recurrence_interval = {
                    oldValue: oldValues.recurrence_interval,
                    newValue: recurrence_interval,
                };
            }
            if (
                recurrence_end_date !== undefined &&
                recurrence_end_date !== oldValues.recurrence_end_date
            ) {
                changes.recurrence_end_date = {
                    oldValue: oldValues.recurrence_end_date,
                    newValue: recurrence_end_date,
                };
            }
            if (
                recurrence_weekday !== undefined &&
                recurrence_weekday !== oldValues.recurrence_weekday
            ) {
                changes.recurrence_weekday = {
                    oldValue: oldValues.recurrence_weekday,
                    newValue: recurrence_weekday,
                };
            }
            if (
                recurrence_month_day !== undefined &&
                recurrence_month_day !== oldValues.recurrence_month_day
            ) {
                changes.recurrence_month_day = {
                    oldValue: oldValues.recurrence_month_day,
                    newValue: recurrence_month_day,
                };
            }
            if (
                recurrence_week_of_month !== undefined &&
                recurrence_week_of_month !== oldValues.recurrence_week_of_month
            ) {
                changes.recurrence_week_of_month = {
                    oldValue: oldValues.recurrence_week_of_month,
                    newValue: recurrence_week_of_month,
                };
            }
            if (
                completion_based !== undefined &&
                completion_based !== oldValues.completion_based
            ) {
                changes.completion_based = {
                    oldValue: oldValues.completion_based,
                    newValue: completion_based,
                };
            }

            // Log all changes
            if (Object.keys(changes).length > 0) {
                await TaskEventService.logTaskUpdate(
                    task.id,
                    req.currentUser.id,
                    changes,
                    { source: 'web' }
                );
            }

            // Check for tag changes (this is more complex due to the array comparison)
            if (tagsData) {
                const newTags = tagsData.map((tag) => ({
                    id: tag.id,
                    name: tag.name,
                }));
                const oldTagNames = oldValues.tags
                    .map((tag) => tag.name)
                    .sort();
                const newTagNames = newTags.map((tag) => tag.name).sort();

                if (
                    JSON.stringify(oldTagNames) !== JSON.stringify(newTagNames)
                ) {
                    await TaskEventService.logEvent({
                        taskId: task.id,
                        userId: req.currentUser.id,
                        eventType: 'tags_changed',
                        fieldName: 'tags',
                        oldValue: oldValues.tags,
                        newValue: newTags,
                        metadata: { source: 'web', action: 'tags_update' },
                    });
                }
            }
        } catch (eventError) {
            console.error('Error logging task update events:', eventError);
            // Don't fail the request if event logging fails
        }

        // Reload task with associations
        const taskWithAssociations = await Task.findByPk(task.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
            ],
        });

        // Use serializeTask to include subtasks data
        const serializedTask = await serializeTask(taskWithAssociations);

        res.json(serializedTask);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(400).json({
            error: 'There was a problem updating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

// PATCH /api/task/:id/toggle_completion
router.patch('/task/:id/toggle_completion', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { id: req.params.id, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'nanoid'],
                            through: { attributes: [] },
                        },
                    ],
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        // Track if parent-child logic was executed
        let parentChildLogicExecuted = false;

        const newStatus =
            task.status === Task.STATUS.DONE || task.status === 'done'
                ? task.note
                    ? Task.STATUS.IN_PROGRESS
                    : Task.STATUS.NOT_STARTED
                : Task.STATUS.DONE;

        // Set completed_at when task is completed/uncompleted
        const updateData = { status: newStatus };
        if (newStatus === Task.STATUS.DONE) {
            updateData.completed_at = new Date();
        } else if (task.status === Task.STATUS.DONE || task.status === 'done') {
            updateData.completed_at = null;
        }

        await task.update(updateData);

        // Check if subtasks exist in database directly to debug association issue
        const directSubtasksQuery = await Task.findAll({
            where: {
                parent_task_id: task.id,
                user_id: req.currentUser.id,
            },
            attributes: ['id', 'name', 'status', 'parent_task_id'],
        });

        // If direct query finds subtasks but task.Subtasks is empty, there's an association issue
        if (
            directSubtasksQuery.length > 0 &&
            (!task.Subtasks || task.Subtasks.length === 0)
        ) {
            task.Subtasks = directSubtasksQuery;
        }

        if (task.parent_task_id) {
            if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
                // When subtask is done, check if parent should be done
                const parentUpdated = await checkAndUpdateParentTaskCompletion(
                    task.parent_task_id,
                    req.currentUser.id
                );
                if (parentUpdated) {
                    parentChildLogicExecuted = true;
                }
            } else {
                // When subtask is undone, undone parent if it was done
                const parentUpdated = await undoneParentTaskIfNeeded(
                    task.parent_task_id,
                    req.currentUser.id
                );
                if (parentUpdated) {
                    parentChildLogicExecuted = true;
                }
            }
        } else if (task.Subtasks && task.Subtasks.length > 0) {
            // This is a parent task with subtasks
            if (newStatus === Task.STATUS.DONE) {
                // When parent is done, complete all subtasks
                const subtasksUpdated = await completeAllSubtasks(
                    task.id,
                    req.currentUser.id
                );
                if (subtasksUpdated) {
                    parentChildLogicExecuted = true;
                }
            } else {
                // When parent is undone, undone all subtasks
                const subtasksUpdated = await undoneAllSubtasks(
                    task.id,
                    req.currentUser.id
                );
                if (subtasksUpdated) {
                    parentChildLogicExecuted = true;
                }
            }
        }

        // Handle recurring task completion
        let nextTask = null;
        if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
            nextTask = await RecurringTaskService.handleTaskCompletion(task);
        }

        // Use serializeTask to include subtasks data
        const response = await serializeTask(task);

        // If parent-child logic was executed, we might need to reload data
        // For now, let the frontend handle the refresh to avoid complex reloading logic

        if (nextTask) {
            response.next_task = {
                ...nextTask.toJSON(),
                due_date: nextTask.due_date
                    ? nextTask.due_date.toISOString().split('T')[0]
                    : null,
            };
        }

        // Add flag to response to indicate if parent-child logic was executed
        response.parent_child_logic_executed = parentChildLogicExecuted;

        res.json(response);
    } catch (error) {
        console.error('Error in toggle completion endpoint:', error);
        console.error('Error stack:', error.stack);
        res.status(422).json({
            error: 'Unable to update task',
            details: error.message,
        });
    }
});

// DELETE /api/task/:id
router.delete('/task/:id', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { id: req.params.id, user_id: req.currentUser.id },
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        // Check for child tasks - prevent deletion of parent tasks with children
        const childTasks = await Task.findAll({
            where: { recurring_parent_id: req.params.id },
        });

        // If this is a recurring parent task with children, prevent deletion
        if (childTasks.length > 0) {
            return res
                .status(400)
                .json({ error: 'There was a problem deleting the task.' });
        }

        const taskEvents = await TaskEvent.findAll({
            where: { task_id: req.params.id },
        });

        const tagAssociations = await sequelize.query(
            'SELECT COUNT(*) as count FROM tasks_tags WHERE task_id = ?',
            { replacements: [req.params.id], type: sequelize.QueryTypes.SELECT }
        );

        // Check SQLite foreign key list for tasks table
        const foreignKeys = await sequelize.query(
            'PRAGMA foreign_key_list(tasks)',
            { type: sequelize.QueryTypes.SELECT }
        );

        // Find all tables that reference tasks
        const allTables = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table'",
            { type: sequelize.QueryTypes.SELECT }
        );

        for (const table of allTables) {
            if (table.name !== 'tasks') {
                try {
                    const fks = await sequelize.query(
                        `PRAGMA foreign_key_list(${table.name})`,
                        { type: sequelize.QueryTypes.SELECT }
                    );
                    const taskRefs = fks.filter((fk) => fk.table === 'tasks');
                    if (taskRefs.length > 0) {
                        // Check if this table has any records referencing our task
                        for (const fk of taskRefs) {
                            const count = await sequelize.query(
                                `SELECT COUNT(*) as count FROM ${table.name} WHERE ${fk.from} = ?`,
                                {
                                    replacements: [req.params.id],
                                    type: sequelize.QueryTypes.SELECT,
                                }
                            );
                        }
                    }
                } catch (error) {
                    // Skip tables that might not exist or have issues
                }
            }
        }

        // Temporarily disable foreign key constraints for this operation
        await sequelize.query('PRAGMA foreign_keys = OFF');

        try {
            // Use force delete to bypass foreign key constraints
            await TaskEvent.destroy({
                where: { task_id: req.params.id },
                force: true,
            });

            await sequelize.query('DELETE FROM tasks_tags WHERE task_id = ?', {
                replacements: [req.params.id],
            });

            await Task.update(
                { recurring_parent_id: null },
                { where: { recurring_parent_id: req.params.id } }
            );

            // Delete the task itself
            await task.destroy({ force: true });
        } finally {
            // Re-enable foreign key constraints
            await sequelize.query('PRAGMA foreign_keys = ON');
        }

        res.json({ message: 'Task successfully deleted' });
    } catch (error) {
        res.status(400).json({
            error: 'There was a problem deleting the task.',
        });
    }
});

// POST /api/tasks/generate-recurring
router.post('/tasks/generate-recurring', async (req, res) => {
    try {
        const newTasks = await RecurringTaskService.generateRecurringTasks(
            req.currentUser.id
        );

        res.json({
            message: `Generated ${newTasks.length} recurring tasks`,
            tasks: newTasks.map((task) => ({
                ...task.toJSON(),
                due_date: task.due_date
                    ? task.due_date.toISOString().split('T')[0]
                    : null,
            })),
        });
    } catch (error) {
        console.error('Error generating recurring tasks:', error);
        res.status(500).json({ error: 'Failed to generate recurring tasks' });
    }
});

// PATCH /api/task/:id/toggle-today
router.patch('/task/:id/toggle-today', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { id: req.params.id, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'nanoid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'nanoid'],
                    required: false,
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        // Toggle the today flag
        const newTodayValue = !task.today;
        const updateData = { today: newTodayValue };

        // If task is being moved away from today and has in_progress status, change it to not_started
        if (
            task.today === true &&
            newTodayValue === false &&
            task.status === Task.STATUS.IN_PROGRESS
        ) {
            updateData.status = Task.STATUS.NOT_STARTED;
        }
        await task.update(updateData);

        // Log the change
        try {
            await TaskEventService.logEvent({
                taskId: task.id,
                userId: req.currentUser.id,
                eventType: 'today_changed',
                fieldName: 'today',
                oldValue: !newTodayValue,
                newValue: newTodayValue,
                metadata: { source: 'web', action: 'toggle_today' },
            });
        } catch (eventError) {
            console.error('Error logging today toggle event:', eventError);
            // Don't fail the request if event logging fails
        }

        // Use serializeTask helper to ensure consistent response format including tags
        const serializedTask = await serializeTask(task);
        res.json(serializedTask);
    } catch (error) {
        console.error('Error toggling task today flag:', error);
        res.status(500).json({ error: 'Failed to update task today flag' });
    }
});

module.exports = router;
