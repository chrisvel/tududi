const express = require('express');
const { Task, Tag, Project, TaskEvent, sequelize } = require('../models');
const { Op } = require('sequelize');
const RecurringTaskService = require('../services/recurringTaskService');
const TaskEventService = require('../services/taskEventService');
const moment = require('moment-timezone');
const router = express.Router();

// Helper function to serialize task with today move count
async function serializeTask(task) {
    const taskJson = task.toJSON();
    const todayMoveCount = await TaskEventService.getTaskTodayMoveCount(
        task.id
    );

    return {
        ...taskJson,
        tags: taskJson.Tags || [],
        due_date: task.due_date
            ? task.due_date.toISOString().split('T')[0]
            : null,
        today_move_count: todayMoveCount,
    };
}

// Helper function to update task tags
async function updateTaskTags(task, tagsData, userId) {
    if (!tagsData) return;

    const tagNames = tagsData
        .map((tag) => tag.name)
        .filter((name) => name && name.trim())
        .filter((name, index, arr) => arr.indexOf(name) === index); // unique

    if (tagNames.length === 0) {
        await task.setTags([]);
        return;
    }

    // Find existing tags
    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: tagNames },
    });

    // Create new tags
    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = tagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => Tag.create({ name, user_id: userId }))
    );

    // Set all tags to task
    const allTags = [...existingTags, ...createdTags];
    await task.setTags(allTags);
}

// Filter tasks by parameters
async function filterTasksByParams(params, userId) {
    let whereClause = { user_id: userId };
    let includeClause = [
        { model: Tag, attributes: ['id', 'name'], through: { attributes: [] } },
        { model: Project, attributes: ['name'], required: false },
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
            } else {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
    }

    // Filter by tag
    if (params.tag) {
        includeClause[0].where = { name: params.tag };
        includeClause[0].required = true;
    }

    let orderClause = [['created_at', 'ASC']];

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
                        'CASE WHEN due_date IS NULL THEN 1 ELSE 0 END'
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
    console.log(
        'Computing metrics for user',
        userId,
        'with timezone:',
        userTimezone
    );
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
                attributes: ['id', 'name'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active'],
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
                attributes: ['id', 'name'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active'],
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
                attributes: ['id', 'name'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active'],
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
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'active'],
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
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'active'],
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
                        attributes: ['id', 'name'],
                        through: { attributes: [] },
                        required: false,
                    },
                    {
                        model: Project,
                        attributes: ['id', 'name', 'active'],
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
            completed_at: {
                [Op.between]: [todayStart, todayEnd],
            },
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'active'],
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
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                },
                { model: Project, attributes: ['name'], required: false },
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

// GET /api/task/:id
router.get('/task/:id', async (req, res) => {
    try {
        const task = await Task.findOne({
            where: { id: req.params.id, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                },
                { model: Project, attributes: ['name'], required: false },
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
            tags,
            Tags,
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

        const task = await Task.create(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);

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
                    attributes: ['name'],
                    through: { attributes: [] },
                },
                { model: Project, attributes: ['name'], required: false },
            ],
        });

        const taskJson = taskWithAssociations.toJSON();

        res.status(201).json({
            ...taskJson,
            tags: taskJson.Tags || [],
            due_date: taskWithAssociations.due_date
                ? taskWithAssociations.due_date.toISOString().split('T')[0]
                : null,
        });
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
            tags,
            Tags,
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
                    attributes: ['id', 'name'],
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
                console.log(
                    `Updated parent task ${parentTask.id} recurrence settings from child task ${task.id}`
                );
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

        await task.update(taskAttributes);
        await updateTaskTags(task, tagsData, req.currentUser.id);

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
                    attributes: ['id', 'name'],
                    through: { attributes: [] },
                },
                { model: Project, attributes: ['name'], required: false },
            ],
        });

        const taskJson = taskWithAssociations.toJSON();

        res.json({
            ...taskJson,
            tags: taskJson.Tags || [], // Normalize Tags to tags
            due_date: taskWithAssociations.due_date
                ? taskWithAssociations.due_date.toISOString().split('T')[0]
                : null,
        });
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
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        console.log('🎯 Toggle completion called for task:', {
            id: task.id,
            name: task.name,
            currentStatus: task.status,
            recurrence_type: task.recurrence_type,
            completion_based: task.completion_based,
        });

        const newStatus =
            task.status === Task.STATUS.DONE || task.status === 'done'
                ? task.note
                    ? Task.STATUS.IN_PROGRESS
                    : Task.STATUS.NOT_STARTED
                : Task.STATUS.DONE;

        console.log('📝 Status changing from', task.status, 'to', newStatus);

        // Set completed_at when task is completed/uncompleted
        const updateData = { status: newStatus };
        if (newStatus === Task.STATUS.DONE) {
            updateData.completed_at = new Date();
        } else if (task.status === Task.STATUS.DONE || task.status === 'done') {
            updateData.completed_at = null;
        }

        await task.update(updateData);

        // Handle recurring task completion
        let nextTask = null;
        if (newStatus === Task.STATUS.DONE || newStatus === 'done') {
            console.log(
                '✅ Task marked as done, calling RecurringTaskService...'
            );
            nextTask = await RecurringTaskService.handleTaskCompletion(task);
        } else {
            console.log(
                '❌ Task not marked as done, skipping RecurringTaskService'
            );
        }

        const response = {
            ...task.toJSON(),
            due_date: task.due_date
                ? task.due_date.toISOString().split('T')[0]
                : null,
        };

        if (nextTask) {
            response.next_task = {
                ...nextTask.toJSON(),
                due_date: nextTask.due_date
                    ? nextTask.due_date.toISOString().split('T')[0]
                    : null,
            };
        }

        res.json(response);
    } catch (error) {
        console.error('Error toggling task completion:', error);
        res.status(422).json({ error: 'Unable to update task' });
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

        console.log(`Attempting to delete task ${req.params.id}`);

        // Check for child tasks - prevent deletion of parent tasks with children
        const childTasks = await Task.findAll({
            where: { recurring_parent_id: req.params.id },
        });
        console.log(`Found ${childTasks.length} child tasks`);

        // If this is a recurring parent task with children, prevent deletion
        if (childTasks.length > 0) {
            console.log(
                `Cannot delete task ${req.params.id} - has ${childTasks.length} child tasks`
            );
            return res
                .status(400)
                .json({ error: 'There was a problem deleting the task.' });
        }

        const taskEvents = await TaskEvent.findAll({
            where: { task_id: req.params.id },
        });
        console.log(`Found ${taskEvents.length} task events`);

        const tagAssociations = await sequelize.query(
            'SELECT COUNT(*) as count FROM tasks_tags WHERE task_id = ?',
            { replacements: [req.params.id], type: sequelize.QueryTypes.SELECT }
        );
        console.log(`Found ${tagAssociations[0].count} tag associations`);

        // Check SQLite foreign key list for tasks table
        const foreignKeys = await sequelize.query(
            'PRAGMA foreign_key_list(tasks)',
            { type: sequelize.QueryTypes.SELECT }
        );
        console.log('Foreign keys in tasks table:', foreignKeys);

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
                        console.log(
                            `Table ${table.name} references tasks:`,
                            taskRefs
                        );
                        // Check if this table has any records referencing our task
                        for (const fk of taskRefs) {
                            const count = await sequelize.query(
                                `SELECT COUNT(*) as count FROM ${table.name} WHERE ${fk.from} = ?`,
                                {
                                    replacements: [req.params.id],
                                    type: sequelize.QueryTypes.SELECT,
                                }
                            );
                            console.log(
                                `  ${table.name}.${fk.from} -> tasks.${fk.to}: ${count[0].count} references`
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

        console.log(`Successfully deleted task ${req.params.id}`);
        res.json({ message: 'Task successfully deleted' });
    } catch (error) {
        console.error('Error deleting task:', error);
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
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        // Toggle the today flag
        const newTodayValue = !task.today;
        await task.update({ today: newTodayValue });

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

        res.json({
            ...task.toJSON(),
            due_date: task.due_date
                ? task.due_date.toISOString().split('T')[0]
                : null,
        });
    } catch (error) {
        console.error('Error toggling task today flag:', error);
        res.status(500).json({ error: 'Failed to update task today flag' });
    }
});

module.exports = router;
