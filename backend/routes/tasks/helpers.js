const { Task, Tag, Project, sequelize } = require('../../models');
const { Op } = require('sequelize');
const permissionsService = require('../../services/permissionsService');
const {
    getSafeTimezone,
    getUpcomingRangeInUTC,
    getTodayBoundsInUTC,
    processDueDateForResponse,
} = require('../../utils/timezone-utils');
const {
    getTaskTodayMoveCount,
    getTaskTodayMoveCounts,
} = require('../../services/taskEventService');
const { validateTagName } = require('../../services/tagsService');
const { logError } = require('../../services/logService');
const moment = require('moment-timezone');

async function groupTasksByDay(
    tasks,
    userTimezone,
    maxDays = 14,
    orderBy = 'created_at:desc'
) {
    const safeTimezone = getSafeTimezone(userTimezone);
    const groupedTasks = {};
    const tasksByDate = new Map();

    const now = moment.tz(safeTimezone);
    const cutoffDate = now.clone().add(maxDays, 'days').endOf('day');

    tasks.forEach((task) => {
        if (!task.due_date) {
            if (!tasksByDate.has('no-date')) {
                tasksByDate.set('no-date', []);
            }
            tasksByDate.get('no-date').push(task);
            return;
        }

        const taskDueDate = moment.tz(task.due_date, safeTimezone);

        if (taskDueDate.isAfter(cutoffDate)) {
            return;
        }

        const dateKey = taskDueDate.format('YYYY-MM-DD');

        if (!tasksByDate.has(dateKey)) {
            tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey).push(task);
    });

    const sortedDates = Array.from(tasksByDate.keys())
        .filter((key) => key !== 'no-date' && key !== 'later')
        .sort();

    sortedDates.forEach((dateKey) => {
        const dateMoment = moment.tz(dateKey, safeTimezone);
        const dayName = dateMoment.format('dddd');
        const dateDisplay = dateMoment.format('MMMM D');
        const isToday = dateMoment.isSame(now, 'day');
        const isTomorrow = dateMoment.isSame(now.clone().add(1, 'day'), 'day');

        let groupName;
        if (isToday) {
            groupName = 'Today';
        } else if (isTomorrow) {
            groupName = 'Tomorrow';
        } else {
            groupName = `${dayName}, ${dateDisplay}`;
        }

        const tasks = tasksByDate.get(dateKey);

        const [orderColumn, orderDirection = 'desc'] = orderBy.split(':');
        tasks.sort((a, b) => {
            let comparison = 0;

            switch (orderColumn) {
                case 'priority':
                    comparison = (a.priority || 0) - (b.priority || 0);
                    break;
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'due_date':
                    if (a.due_date && b.due_date) {
                        const timeA = moment.tz(a.due_date, safeTimezone);
                        const timeB = moment.tz(b.due_date, safeTimezone);
                        comparison =
                            timeA.hour() * 60 +
                            timeA.minute() -
                            (timeB.hour() * 60 + timeB.minute());
                    } else if (a.due_date && !b.due_date) {
                        comparison = -1;
                    } else if (!a.due_date && b.due_date) {
                        comparison = 1;
                    }
                    break;
                case 'created_at':
                default:
                    comparison =
                        new Date(a.created_at || 0) -
                        new Date(b.created_at || 0);
                    break;
            }

            return orderDirection === 'desc' ? -comparison : comparison;
        });

        groupedTasks[groupName] = tasks;
    });


    if (tasksByDate.has('no-date')) {
        const noDateTasks = tasksByDate.get('no-date');
        const [orderColumn, orderDirection = 'desc'] = orderBy.split(':');
        noDateTasks.sort((a, b) => {
            let comparison = 0;

            switch (orderColumn) {
                case 'priority':
                    comparison = (a.priority || 0) - (b.priority || 0);
                    break;
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'due_date':
                    comparison =
                        new Date(a.created_at || 0) -
                        new Date(b.created_at || 0);
                    break;
                case 'created_at':
                default:
                    comparison =
                        new Date(a.created_at || 0) -
                        new Date(b.created_at || 0);
                    break;
            }

            return orderDirection === 'desc' ? -comparison : comparison;
        });
        groupedTasks['No Due Date'] = noDateTasks;
    }

    return groupedTasks;
}

async function serializeTask(
    task,
    userTimezone = 'UTC',
    options = {},
    moveCountMap = null
) {
    if (!task) {
        throw new Error('Task is null or undefined');
    }
    const taskJson = task.toJSON();

    const todayMoveCount = moveCountMap
        ? (moveCountMap[task.id] || 0)
        : await getTaskTodayMoveCount(task.id);

    const safeTimezone = getSafeTimezone(userTimezone);

    const { Subtasks, ...taskWithoutSubtasks } = taskJson;

    let displayName = taskJson.name;
    if (
        !options.skipDisplayNameTransform &&
        !options.preserveOriginalName &&
        taskJson.recurrence_type &&
        taskJson.recurrence_type !== 'none' &&
        !taskJson.recurring_parent_id
    ) {
        switch (taskJson.recurrence_type) {
            case 'daily':
                displayName = 'Daily';
                break;
            case 'weekly':
                displayName = 'Weekly';
                break;
            case 'monthly':
                displayName = 'Monthly';
                break;
            case 'yearly':
                displayName = 'Yearly';
                break;
            default:
                displayName =
                    taskJson.recurrence_type.charAt(0).toUpperCase() +
                    taskJson.recurrence_type.slice(1);
        }
    }

    return {
        ...taskWithoutSubtasks,
        name: displayName,
        original_name: taskJson.name,
        uid: task.uid,
        due_date: processDueDateForResponse(taskJson.due_date, safeTimezone),
        tags: taskJson.Tags || [],
        Project: taskJson.Project
            ? {
                  ...taskJson.Project,
                  uid: taskJson.Project.uid,
              }
            : null,
        subtasks: Subtasks
            ? Subtasks.map((subtask) => ({
                  ...subtask,
                  uid: subtask.uid,
                  tags: subtask.Tags || [],
                  due_date: processDueDateForResponse(
                      subtask.due_date,
                      safeTimezone
                  ),
                  completed_at: subtask.completed_at
                      ? subtask.completed_at instanceof Date
                          ? subtask.completed_at.toISOString()
                          : new Date(subtask.completed_at).toISOString()
                      : null,
              }))
            : [],
        completed_at: task.completed_at
            ? task.completed_at instanceof Date
                ? task.completed_at.toISOString()
                : new Date(task.completed_at).toISOString()
            : null,
        today_move_count: todayMoveCount,
    };
}

async function serializeTasks(tasks, userTimezone = 'UTC', options = {}) {
    if (!tasks || tasks.length === 0) {
        return [];
    }

    const taskIds = tasks.map((task) => task.id);
    const moveCountMap = await getTaskTodayMoveCounts(taskIds);

    return await Promise.all(
        tasks.map((task) =>
            serializeTask(task, userTimezone, options, moveCountMap)
        )
    );
}

async function buildMetricsResponse(
    metrics,
    userTimezone,
    serializationOptions = {}
) {
    return {
        total_open_tasks: metrics.total_open_tasks,
        tasks_pending_over_month: metrics.tasks_pending_over_month,
        tasks_in_progress_count: metrics.tasks_in_progress_count,
        tasks_due_today_count: metrics.tasks_due_today.length,
        today_plan_tasks_count: metrics.today_plan_tasks.length,
        suggested_tasks_count: metrics.suggested_tasks.length,
        tasks_completed_today_count: metrics.tasks_completed_today.length,
        weekly_completions: metrics.weekly_completions,
    };
}

async function updateTaskTags(task, tagsData, userId) {
    if (!tagsData) return;

    const validTagNames = [];
    const invalidTags = [];

    for (const tag of tagsData) {
        const validation = validateTagName(tag.name);
        if (validation.valid) {
            if (!validTagNames.includes(validation.name)) {
                validTagNames.push(validation.name);
            }
        } else {
            invalidTags.push({ name: tag.name, error: validation.error });
        }
    }

    if (invalidTags.length > 0) {
        throw new Error(
            `Invalid tag names: ${invalidTags.map((t) => `"${t.name}" (${t.error})`).join(', ')}`
        );
    }

    if (validTagNames.length === 0) {
        await task.setTags([]);
        return;
    }

    const existingTags = await Tag.findAll({
        where: { user_id: userId, name: validTagNames },
    });

    const existingTagNames = existingTags.map((tag) => tag.name);
    const newTagNames = validTagNames.filter(
        (name) => !existingTagNames.includes(name)
    );

    const createdTags = await Promise.all(
        newTagNames.map((name) => Tag.create({ name, user_id: userId }))
    );

    const allTags = [...existingTags, ...createdTags];
    await task.setTags(allTags);
}

async function checkAndUpdateParentTaskCompletion(parentTaskId, userId) {
    try {
        const subtasks = await Task.findAll({
            where: {
                parent_task_id: parentTaskId,
                user_id: userId,
            },
        });

        const allSubtasksDone =
            subtasks.length > 0 &&
            subtasks.every(
                (subtask) =>
                    subtask.status === Task.STATUS.DONE ||
                    subtask.status === 'done'
            );

        if (allSubtasksDone) {
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
        logError('Error checking parent task completion:', error);
        return false;
    }
}

async function undoneParentTaskIfNeeded(parentTaskId, userId) {
    try {
        const parentTask = await Task.findOne({
            where: {
                id: parentTaskId,
                user_id: userId,
            },
        });

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
        logError('Error undoing parent task:', error);
        return false;
    }
}

async function completeAllSubtasks(parentTaskId, userId) {
    try {
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
        return result[0] > 0;
    } catch (error) {
        logError('Error completing all subtasks:', error);
        return false;
    }
}

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
        return result[0] > 0;
    } catch (error) {
        logError('Error undoing all subtasks:', error);
        return false;
    }
}

async function filterTasksByParams(params, userId, userTimezone, permissionCache = null) {
    const ownedOrShared = await permissionsService.ownershipOrPermissionWhere(
        'task',
        userId,
        permissionCache
    );
    if (params.type === 'upcoming') {
        params = { ...params };
        delete params.search;
    }
    let whereClause = {
        parent_task_id: null,
    };

    whereClause[Op.or] = [
        {
            [Op.and]: [
                {
                    [Op.or]: [
                        { recurrence_type: 'none' },
                        { recurrence_type: null },
                    ],
                },
                { recurring_parent_id: null },
            ],
        },
        {
            [Op.and]: [
                { recurrence_type: { [Op.ne]: 'none' } },
                { recurrence_type: { [Op.ne]: null } },
                { recurring_parent_id: null },
                {
                    [Op.or]: [
                        { due_date: null },
                        {
                            due_date: {
                                [Op.gte]: new Date(
                                    new Date().setHours(0, 0, 0, 0)
                                ),
                            },
                        },
                    ],
                },
            ],
        },
        {
            [Op.and]: [
                { recurring_parent_id: { [Op.ne]: null } },
                {
                    [Op.or]: [
                        { due_date: null },
                        {
                            due_date: {
                                [Op.gte]: new Date(
                                    new Date().setHours(0, 0, 0, 0)
                                ),
                            },
                        },
                    ],
                },
            ],
        },
    ];
    let includeClause = [
        {
            model: Tag,
            attributes: ['id', 'name', 'uid'],
            through: { attributes: [] },
        },
        {
            model: Project,
            attributes: ['id', 'name', 'state', 'uid'],
            required: false,
        },
        {
            model: Task,
            as: 'Subtasks',
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                    required: false,
                },
            ],
            required: false,
        },
    ];

    switch (params.type) {
        case 'today':
            whereClause.recurring_parent_id = null;
            whereClause.status = {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            };
            break;
        case 'upcoming': {
            const safeTimezone = getSafeTimezone(userTimezone);
            const upcomingRange = getUpcomingRangeInUTC(safeTimezone, 7);

            whereClause = {
                parent_task_id: null,
                due_date: {
                    [Op.between]: [upcomingRange.start, upcomingRange.end],
                },
                [Op.or]: [
                    {
                        [Op.and]: [
                            { recurring_parent_id: null },
                            {
                                [Op.or]: [
                                    { recurrence_type: 'none' },
                                    { recurrence_type: null },
                                ],
                            },
                        ],
                    },
                    {
                        [Op.and]: [
                            { recurring_parent_id: { [Op.ne]: null } },
                            { recurrence_type: 'none' },
                        ],
                    },
                ],
            };

            if (params.status === 'done') {
                whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
            } else if (!params.client_side_filtering) {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
            break;
        }
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
            whereClause.recurring_parent_id = null;
            whereClause.due_date = null;
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'waiting':
            whereClause.status = Task.STATUS.WAITING;
            break;
        case 'all':
            if (params.status === 'done') {
                whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
            } else if (!params.client_side_filtering) {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
            break;
        default:
            if (!params.include_instances) {
                whereClause.recurring_parent_id = null;
            }
            if (params.status === 'done') {
                whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
            } else if (!params.client_side_filtering) {
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
    }

    if (params.tag) {
        includeClause[0].where = { name: params.tag };
        includeClause[0].required = true;
    }

    if (params.priority) {
        whereClause.priority = Task.getPriorityValue(params.priority);
    }

    let orderClause = [['created_at', 'DESC']];

    if (params.type === 'inbox') {
        orderClause = [['created_at', 'DESC']];
    }

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

    const finalWhereClause = {
        [Op.and]: [ownedOrShared, whereClause],
    };

    return await Task.findAll({
        where: finalWhereClause,
        include: includeClause,
        order: orderClause,
        distinct: true,
    });
}

async function computeTaskMetrics(userId, userTimezone = 'UTC', permissionCache = null) {
    const visibleTasksWhere =
        await permissionsService.ownershipOrPermissionWhere('task', userId, permissionCache);
    const totalOpenTasks = await Task.count({
        where: {
            ...visibleTasksWhere,
            status: { [Op.ne]: Task.STATUS.DONE },
            parent_task_id: null,
            recurring_parent_id: null,
        },
    });

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tasksPendingOverMonth = await Task.count({
        where: {
            ...visibleTasksWhere,
            status: { [Op.ne]: Task.STATUS.DONE },
            created_at: { [Op.lt]: oneMonthAgo },
            parent_task_id: null,
            recurring_parent_id: null,
        },
    });

    const tasksInProgress = await Task.findAll({
        where: {
            ...visibleTasksWhere,
            status: { [Op.in]: [Task.STATUS.IN_PROGRESS, 'in_progress'] },
            parent_task_id: null,
            recurring_parent_id: null,
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'uid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'state', 'uid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
        order: [['priority', 'DESC']],
    });

    const todayPlanTasks = await Task.findAll({
        where: {
            ...visibleTasksWhere,
            today: true,
            status: {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            },
            parent_task_id: null,
            recurring_parent_id: null,
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'uid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'state', 'uid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
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

    const safeTimezone = getSafeTimezone(userTimezone);
    const todayBounds = getTodayBoundsInUTC(safeTimezone);

    const tasksDueToday = await Task.findAll({
        where: {
            [Op.and]: [
                visibleTasksWhere,
                {
                    status: {
                        [Op.notIn]: [
                            Task.STATUS.DONE,
                            Task.STATUS.ARCHIVED,
                            'done',
                            'archived',
                        ],
                    },
                    parent_task_id: null,
                    recurring_parent_id: null,
                    [Op.or]: [
                        { due_date: { [Op.lte]: todayBounds.end } },
                        sequelize.literal(`EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id = Task.project_id
          AND projects.due_date_at <= '${todayBounds.end.toISOString()}'
        )`),
                    ],
                },
            ],
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'uid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'state', 'uid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
    });

    let suggestedTasks = [];

    if (
        totalOpenTasks >= 3 ||
        tasksInProgress.length > 0 ||
        tasksDueToday.length > 0
    ) {
        const excludedTaskIds = [
            ...tasksInProgress.map((t) => t.id),
            ...tasksDueToday.map((t) => t.id),
        ];

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

        const nonProjectTasks = await Task.findAll({
            where: {
                ...visibleTasksWhere,
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                },
                id: { [Op.notIn]: [...excludedTaskIds, ...somedayTaskIds] },
                [Op.or]: [{ project_id: null }, { project_id: '' }],
                parent_task_id: null,
                recurring_parent_id: null,
            },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
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

        const projectTasks = await Task.findAll({
            where: {
                ...visibleTasksWhere,
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                },
                id: { [Op.notIn]: [...excludedTaskIds, ...somedayTaskIds] },
                project_id: { [Op.not]: null, [Op.ne]: '' },
                parent_task_id: null,
                recurring_parent_id: null,
            },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                    required: false,
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
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

        let combinedTasks = [...nonProjectTasks, ...projectTasks];

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
                    parent_task_id: null,
                    recurring_parent_id: null,
                },
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                        required: false,
                    },
                    {
                        model: Project,
                        attributes: ['id', 'name', 'uid'],
                        required: false,
                    },
                    {
                        model: Task,
                        as: 'Subtasks',
                        include: [
                            {
                                model: Tag,
                                attributes: ['id', 'name', 'uid'],
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

    const todayInUserTz = moment.tz(userTimezone);
    const todayStart = todayInUserTz.clone().startOf('day').utc().toDate();
    const todayEnd = todayInUserTz.clone().endOf('day').utc().toDate();

    const tasksCompletedToday = await Task.findAll({
        where: {
            user_id: userId,
            status: Task.STATUS.DONE,
            parent_task_id: null,
            recurring_parent_id: null,
            completed_at: {
                [Op.between]: [todayStart, todayEnd],
            },
        },
        include: [
            {
                model: Tag,
                attributes: ['id', 'name', 'uid'],
                through: { attributes: [] },
                required: false,
            },
            {
                model: Project,
                attributes: ['id', 'name', 'state', 'uid'],
                required: false,
            },
            {
                model: Task,
                as: 'Subtasks',
                include: [
                    {
                        model: Tag,
                        attributes: ['id', 'name', 'uid'],
                        through: { attributes: [] },
                        required: false,
                    },
                ],
                required: false,
            },
        ],
        order: [['completed_at', 'DESC']],
    });

    const weekStartInUserTz = moment.tz(userTimezone).subtract(6, 'days');
    const weekStart = weekStartInUserTz.clone().startOf('day').utc().toDate();
    const weekEnd = todayInUserTz.clone().endOf('day').utc().toDate();

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

    const dateCountMap = {};
    weeklyCompletionsRaw.forEach((task) => {
        const completedDate = new Date(task.completed_at);
        const dateInUserTz = moment(completedDate)
            .tz(userTimezone)
            .format('YYYY-MM-DD');
        dateCountMap[dateInUserTz] = (dateCountMap[dateInUserTz] || 0) + 1;
    });

    const weeklyCompletions = Object.entries(dateCountMap).map(
        ([date, count]) => ({
            date,
            count: count.toString(),
        })
    );

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
            dayName: dateInUserTz.format('ddd'),
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

module.exports = {
    groupTasksByDay,
    serializeTask,
    serializeTasks,
    buildMetricsResponse,
    updateTaskTags,
    checkAndUpdateParentTaskCompletion,
    undoneParentTaskIfNeeded,
    completeAllSubtasks,
    undoneAllSubtasks,
    filterTasksByParams,
    computeTaskMetrics,
};
