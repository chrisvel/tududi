const { Task, Tag, Project, sequelize } = require('../../models');
const { Op } = require('sequelize');
const permissionsService = require('../../services/permissionsService');
const {
    getSafeTimezone,
    getUpcomingRangeInUTC,
    getTodayBoundsInUTC,
    processDueDateForResponse,
} = require('../../utils/timezone-utils');
const { getTaskTodayMoveCount } = require('../../services/taskEventService');
const { validateTagName } = require('../../services/tagsService');
const { logError } = require('../../services/logService');
const moment = require('moment-timezone');

// Helper function to group tasks by actual day names
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

    // Group tasks by their exact due date
    tasks.forEach((task) => {
        if (!task.due_date) {
            // Tasks with no due date go to a special "No Due Date" group
            if (!tasksByDate.has('no-date')) {
                tasksByDate.set('no-date', []);
            }
            tasksByDate.get('no-date').push(task);
            return;
        }

        const taskDueDate = moment.tz(task.due_date, safeTimezone);

        // Skip tasks beyond the specified days
        if (taskDueDate.isAfter(cutoffDate)) {
            return; // Don't include tasks beyond the cutoff date
        }

        // Use YYYY-MM-DD as the key for grouping by exact date
        const dateKey = taskDueDate.format('YYYY-MM-DD');

        if (!tasksByDate.has(dateKey)) {
            tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey).push(task);
    });

    // Convert the map to the final grouped structure with day names
    const sortedDates = Array.from(tasksByDate.keys())
        .filter((key) => key !== 'no-date' && key !== 'later')
        .sort(); // Sort dates chronologically

    // Add date groups in chronological order
    sortedDates.forEach((dateKey) => {
        const dateMoment = moment.tz(dateKey, safeTimezone);
        const dayName = dateMoment.format('dddd'); // e.g., "Monday", "Tuesday"
        const dateDisplay = dateMoment.format('MMMM D'); // e.g., "August 12"
        const isToday = dateMoment.isSame(now, 'day');
        const isTomorrow = dateMoment.isSame(now.clone().add(1, 'day'), 'day');

        // Create a descriptive group name
        let groupName;
        if (isToday) {
            groupName = 'Today';
        } else if (isTomorrow) {
            groupName = 'Tomorrow';
        } else {
            groupName = `${dayName}, ${dateDisplay}`;
        }

        const tasks = tasksByDate.get(dateKey);

        // Sort tasks within each day based on orderBy parameter
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

            // Apply direction (desc = reverse order)
            return orderDirection === 'desc' ? -comparison : comparison;
        });

        groupedTasks[groupName] = tasks;
    });

    // Removed "Later" group as requested

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
                    // For no-date tasks, fall back to created_at
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

            // Apply direction (desc = reverse order)
            return orderDirection === 'desc' ? -comparison : comparison;
        });
        groupedTasks['No Due Date'] = noDateTasks;
    }

    return groupedTasks;
}

// Helper function to serialize task with today move count
async function serializeTask(task, userTimezone = 'UTC', options = {}) {
    if (!task) {
        throw new Error('Task is null or undefined');
    }
    const taskJson = task.toJSON();
    const todayMoveCount = await getTaskTodayMoveCount(task.id);
    const safeTimezone = getSafeTimezone(userTimezone);

    // Include subtasks if they exist
    const { Subtasks, ...taskWithoutSubtasks } = taskJson;

    // For recurring task templates, show recurrence type instead of original name
    // unless skipDisplayNameTransform option is true
    // Skip this transformation for 'today' type queries to show actual task names
    let displayName = taskJson.name;
    if (
        !options.skipDisplayNameTransform &&
        !options.preserveOriginalName &&
        taskJson.recurrence_type &&
        taskJson.recurrence_type !== 'none' &&
        !taskJson.recurring_parent_id
    ) {
        // This is a recurring template - format the display name based on recurrence type
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
        uid: task.uid, // Explicitly include uid
        due_date: processDueDateForResponse(taskJson.due_date, safeTimezone),
        tags: taskJson.Tags || [],
        Project: taskJson.Project
            ? {
                  ...taskJson.Project,
                  uid: taskJson.Project.uid, // Explicitly include Project uid
              }
            : null,
        subtasks: Subtasks
            ? Subtasks.map((subtask) => ({
                  ...subtask,
                  uid: subtask.uid, // Also include uid for subtasks
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

// Helper function to serialize multiple tasks
async function serializeTasks(tasks, userTimezone = 'UTC', options = {}) {
    return await Promise.all(
        tasks.map((task) => serializeTask(task, userTimezone, options))
    );
}

// Helper function to build metrics response with serialized tasks
async function buildMetricsResponse(
    metrics,
    userTimezone,
    serializationOptions = {}
) {
    return {
        total_open_tasks: metrics.total_open_tasks,
        tasks_pending_over_month: metrics.tasks_pending_over_month,
        tasks_in_progress_count: metrics.tasks_in_progress_count,
        tasks_in_progress: await serializeTasks(
            metrics.tasks_in_progress,
            userTimezone,
            serializationOptions
        ),
        tasks_due_today: await serializeTasks(
            metrics.tasks_due_today,
            userTimezone,
            serializationOptions
        ),
        today_plan_tasks: await serializeTasks(
            metrics.today_plan_tasks,
            userTimezone,
            serializationOptions
        ),
        suggested_tasks: await serializeTasks(
            metrics.suggested_tasks,
            userTimezone,
            serializationOptions
        ),
        tasks_completed_today: await Promise.all(
            metrics.tasks_completed_today.map(async (task) => {
                const serialized = await serializeTask(
                    task,
                    userTimezone,
                    serializationOptions
                );
                return {
                    ...serialized,
                    completed_at: task.completed_at
                        ? task.completed_at.toISOString()
                        : null,
                };
            })
        ),
        weekly_completions: metrics.weekly_completions,
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
        logError('Error checking parent task completion:', error);
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
        logError('Error undoing parent task:', error);
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
        logError('Error completing all subtasks:', error);
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
        logError('Error undoing all subtasks:', error);
        return false;
    }
}

// Filter tasks by parameters
async function filterTasksByParams(params, userId, userTimezone) {
    // Include owned or shared tasks; exclude subtasks by default
    const ownedOrShared = await permissionsService.ownershipOrPermissionWhere(
        'task',
        userId
    );
    if (params.type === 'upcoming') {
        // Remove search-related parameters to prevent search functionality
        // Keep client_side_filtering to allow frontend to control completed task visibility
        params = { ...params };
        delete params.search;
    }
    let whereClause = {
        parent_task_id: null,
    };

    // Include both recurring templates and instances, but handle them appropriately
    whereClause[Op.or] = [
        // Include all non-recurring tasks
        {
            [Op.and]: [
                {
                    [Op.or]: [
                        { recurrence_type: 'none' },
                        { recurrence_type: null },
                    ],
                },
                { recurring_parent_id: null }, // Non-recurring tasks have no parent
            ],
        },
        // Include recurring templates that are not in the past
        {
            [Op.and]: [
                { recurrence_type: { [Op.ne]: 'none' } },
                { recurrence_type: { [Op.ne]: null } },
                { recurring_parent_id: null }, // Templates have no parent
                {
                    [Op.or]: [
                        { due_date: null }, // No due date - always show
                        {
                            due_date: {
                                [Op.gte]: new Date(
                                    new Date().setHours(0, 0, 0, 0)
                                ),
                            },
                        }, // Today or future (start of today)
                    ],
                },
            ],
        },
        // Include recurring task instances (but only future ones)
        {
            [Op.and]: [
                { recurring_parent_id: { [Op.ne]: null } }, // Has a recurring parent
                {
                    [Op.or]: [
                        { due_date: null }, // No due date - always show
                        {
                            due_date: {
                                [Op.gte]: new Date(
                                    new Date().setHours(0, 0, 0, 0)
                                ),
                            },
                        }, // Today or future instances only
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

    // Filter by type
    switch (params.type) {
        case 'today':
            // Exclude recurring task instances for today view
            whereClause.recurring_parent_id = null;
            whereClause.status = {
                [Op.notIn]: [
                    Task.STATUS.DONE,
                    Task.STATUS.ARCHIVED,
                    'done',
                    'archived',
                ],
            }; // Exclude completed and archived tasks (both integer and string values)
            break;
        case 'upcoming': {
            const safeTimezone = getSafeTimezone(userTimezone);
            const upcomingRange = getUpcomingRangeInUTC(safeTimezone, 7);

            // For upcoming view, we want to show recurring instances (children) with due dates
            // Override the default whereClause to include recurring instances
            whereClause = {
                parent_task_id: null, // Exclude subtasks from main task lists
                due_date: {
                    [Op.between]: [upcomingRange.start, upcomingRange.end],
                },
                [Op.or]: [
                    // Include non-recurring tasks
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
                    // Include recurring task instances (children) - this is the key change!
                    {
                        [Op.and]: [
                            { recurring_parent_id: { [Op.ne]: null } }, // Has a parent (is an instance)
                            { recurrence_type: 'none' }, // Instances have recurrence_type: 'none'
                        ],
                    },
                ],
            };

            // Apply status filter based on client_side_filtering
            if (params.status === 'done') {
                whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
            } else if (!params.client_side_filtering) {
                // Only exclude completed tasks if not doing client-side filtering
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
            // If client_side_filtering is true, don't add any status filter (include all)
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
            // Exclude recurring task instances for someday view
            whereClause.recurring_parent_id = null;
            whereClause.due_date = null;
            whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            break;
        case 'waiting':
            whereClause.status = Task.STATUS.WAITING;
            break;
        case 'all':
            // For 'all' view, include both recurring templates and instances
            // The complex OR logic above already handles this correctly
            if (params.status === 'done') {
                whereClause.status = { [Op.in]: [Task.STATUS.DONE, 'done'] };
            } else if (!params.client_side_filtering) {
                // Only exclude completed tasks if not doing client-side filtering
                whereClause.status = { [Op.notIn]: [Task.STATUS.DONE, 'done'] };
            }
            break;
        default:
            // Exclude recurring task instances from default view unless include_instances is specified
            if (!params.include_instances) {
                whereClause.recurring_parent_id = null;
            }
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

    // Filter by priority
    if (params.priority) {
        whereClause.priority = Task.getPriorityValue(params.priority);
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

    // Always apply ownership filter
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

// Compute task metrics
async function computeTaskMetrics(userId, userTimezone = 'UTC') {
    const visibleTasksWhere =
        await permissionsService.ownershipOrPermissionWhere('task', userId);
    const totalOpenTasks = await Task.count({
        where: {
            ...visibleTasksWhere,
            status: { [Op.ne]: Task.STATUS.DONE },
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
        },
    });

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tasksPendingOverMonth = await Task.count({
        where: {
            ...visibleTasksWhere,
            status: { [Op.ne]: Task.STATUS.DONE },
            created_at: { [Op.lt]: oneMonthAgo },
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
        },
    });

    const tasksInProgress = await Task.findAll({
        where: {
            ...visibleTasksWhere,
            status: { [Op.in]: [Task.STATUS.IN_PROGRESS, 'in_progress'] },
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
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

    // Get tasks in today plan
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
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
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

    // Get tasks due today in user's timezone
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
                    parent_task_id: null, // Exclude subtasks
                    recurring_parent_id: null, // Exclude recurring instances
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
                ...visibleTasksWhere,
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                },
                id: { [Op.notIn]: [...excludedTaskIds, ...somedayTaskIds] },
                [Op.or]: [{ project_id: null }, { project_id: '' }],
                parent_task_id: null, // Exclude subtasks
                recurring_parent_id: null, // Exclude recurring instances
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

        // Get tasks with projects (excluding someday tagged tasks)
        const projectTasks = await Task.findAll({
            where: {
                ...visibleTasksWhere,
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.WAITING],
                },
                id: { [Op.notIn]: [...excludedTaskIds, ...somedayTaskIds] },
                project_id: { [Op.not]: null, [Op.ne]: '' },
                parent_task_id: null, // Exclude subtasks
                recurring_parent_id: null, // Exclude recurring instances
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
                    parent_task_id: null, // Exclude subtasks
                    recurring_parent_id: null, // Exclude recurring instances
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

    // Get tasks completed today - use user's timezone
    const todayInUserTz = moment.tz(userTimezone);
    const todayStart = todayInUserTz.clone().startOf('day').utc().toDate();
    const todayEnd = todayInUserTz.clone().endOf('day').utc().toDate();

    const tasksCompletedToday = await Task.findAll({
        where: {
            user_id: userId,
            status: Task.STATUS.DONE,
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
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
