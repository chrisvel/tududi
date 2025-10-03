const express = require('express');
const { Task, Tag, Project, TaskEvent, sequelize } = require('../models');
const { Op } = require('sequelize');
const {
    generateRecurringTasks,
    handleTaskCompletion,
    calculateNextDueDate,
} = require('../services/recurringTaskService');
const {
    logEvent,
    logTaskCreated,
    logStatusChange,
    logPriorityChange,
    logDueDateChange,
    logProjectChange,
    logNameChange,
    logDescriptionChange,
    logTaskUpdate,
    getTaskTodayMoveCount,
} = require('../services/taskEventService');
const { validateTagName } = require('../services/tagsService');
const {
    getSafeTimezone,
    getUpcomingRangeInUTC,
    getTodayBoundsInUTC,
    processDueDateForStorage,
    processDueDateForResponse,
} = require('../utils/timezone-utils');
const moment = require('moment-timezone');
const _ = require('lodash');
const router = express.Router();

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
async function filterTasksByParams(params, userId, userTimezone) {
    // Disable search functionality for upcoming view
    if (params.type === 'upcoming') {
        // Remove search-related parameters to prevent search functionality
        params = { ...params, client_side_filtering: false };
        delete params.search;
    }

    let whereClause = {
        user_id: userId,
        parent_task_id: null, // Exclude subtasks from main task lists
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
            // NOTE: Search functionality is disabled for upcoming view - ignore client_side_filtering
            whereClause = {
                user_id: userId,
                parent_task_id: null, // Exclude subtasks from main task lists
                due_date: {
                    [Op.between]: [upcomingRange.start, upcomingRange.end],
                },
                status: { [Op.notIn]: [Task.STATUS.DONE, 'done'] },
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
        where: {
            user_id: userId,
            status: { [Op.ne]: Task.STATUS.DONE },
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
        },
    });

    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tasksPendingOverMonth = await Task.count({
        where: {
            user_id: userId,
            status: { [Op.ne]: Task.STATUS.DONE },
            created_at: { [Op.lt]: oneMonthAgo },
            parent_task_id: null, // Exclude subtasks
            recurring_parent_id: null, // Exclude recurring instances
        },
    });

    const tasksInProgress = await Task.findAll({
        where: {
            user_id: userId,
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
            user_id: userId,
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
                user_id: userId,
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
                user_id: userId,
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

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks for the authenticated user
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [all, upcoming, today, overdue]
 *         description: Filter tasks by type
 *     responses:
 *       200:
 *         description: List of tasks
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   status:
 *                     type: string
 *                   priority:
 *                     type: string
 *                   dueDate:
 *                     type: string
 *                     format: date-time
 */
router.get('/tasks', async (req, res) => {
    try {
        // Generate recurring tasks for upcoming view, but prevent concurrent execution
        if (req.query.type === 'upcoming') {
            // Use a simple lock to prevent concurrent generation per user
            const lockKey = `generating_recurring_${req.currentUser.id}`;
            if (!global[lockKey]) {
                global[lockKey] = true;
                try {
                    console.log(
                        '🔄 GENERATING recurring tasks for upcoming view (7 days)'
                    );
                    await generateRecurringTasks(req.currentUser.id, 7);
                } finally {
                    delete global[lockKey];
                }
            }
        }

        const tasks = await filterTasksByParams(
            req.query,
            req.currentUser.id,
            req.currentUser.timezone
        );

        // Debug logging for upcoming view
        if (req.query.type === 'upcoming') {
            console.log('🔍 UPCOMING TASKS DEBUG:');
            tasks.forEach((task) => {
                console.log(
                    `- ID: ${task.id}, Name: "${task.name}", Due: ${task.due_date}, Recur: ${task.recurrence_type}, Parent: ${task.recurring_parent_id}`
                );
            });
        }

        // Group upcoming tasks by day of week if requested
        let groupedTasks = null;
        if (req.query.type === 'upcoming' && req.query.groupBy === 'day') {
            // Always show 7 days (whole week including tomorrow)
            const maxDays = req.query.maxDays
                ? parseInt(req.query.maxDays, 10)
                : 7;

            // For upcoming kanban view, sort tasks by due date within each day column
            const dayGroupingOrderBy = req.query.order_by || 'due_date:asc';
            groupedTasks = await groupTasksByDay(
                tasks,
                req.currentUser.timezone,
                maxDays,
                dayGroupingOrderBy
            );
        }
        const metrics = await computeTaskMetrics(
            req.currentUser.id,
            req.currentUser.timezone
        );

        // Preserve original names for recurring tasks in 'today' view for productivity assistant
        const serializationOptions =
            req.query.type === 'today' ? { preserveOriginalName: true } : {};

        const response = {
            tasks: await Promise.all(
                tasks.map((task) =>
                    serializeTask(
                        task,
                        req.currentUser.timezone,
                        serializationOptions
                    )
                )
            ),
            metrics: {
                total_open_tasks: metrics.total_open_tasks,
                tasks_pending_over_month: metrics.tasks_pending_over_month,
                tasks_in_progress_count: metrics.tasks_in_progress_count,
                tasks_in_progress: await Promise.all(
                    metrics.tasks_in_progress.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                tasks_due_today: await Promise.all(
                    metrics.tasks_due_today.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                today_plan_tasks: await Promise.all(
                    metrics.today_plan_tasks.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                suggested_tasks: await Promise.all(
                    metrics.suggested_tasks.map((task) =>
                        serializeTask(
                            task,
                            req.currentUser.timezone,
                            serializationOptions
                        )
                    )
                ),
                tasks_completed_today: await Promise.all(
                    metrics.tasks_completed_today.map(async (task) => {
                        const serialized = await serializeTask(
                            task,
                            req.currentUser.timezone,
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
            },
        };

        // Add grouped tasks if requested
        if (groupedTasks) {
            response.groupedTasks = {};
            for (const [groupName, groupTasks] of Object.entries(
                groupedTasks
            )) {
                response.groupedTasks[groupName] = await Promise.all(
                    groupTasks.map((task) =>
                        serializeTask(task, req.currentUser.timezone)
                    )
                );
            }
        }

        res.json(response);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        if (error.message === 'Invalid order column specified.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/task?uid=...
router.get('/task', async (req, res) => {
    try {
        const { uid } = req.query;

        if (_.isEmpty(uid)) {
            return res
                .status(400)
                .json({ error: 'uid query parameter is required' });
        }

        const task = await Task.findOne({
            where: { uid: uid, user_id: req.currentUser.id },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
                {
                    model: Task,
                    as: 'Subtasks',
                    required: false,
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
                            through: { attributes: [] },
                        },
                    ],
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(
            task,
            req.currentUser.timezone
        );

        res.json(serializedTask);
    } catch (error) {
        console.error('Error fetching task by UID:', error);
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
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
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
                        },
                    ],
                },
            ],
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found.' });
        }

        const serializedTask = await serializeTask(
            task,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

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
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
            ],
            order: [['created_at', 'ASC']],
        });

        const serializedSubtasks = await Promise.all(
            subtasks.map((subtask) =>
                serializeTask(subtask, req.currentUser.timezone)
            )
        );

        res.json(serializedSubtasks);
    } catch (error) {
        console.error('Error fetching subtasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * @swagger
 * /task:
 *   post:
 *     summary: Create a new task
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               priority:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Task created
 */
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
            due_date: processDueDateForStorage(
                due_date,
                getSafeTimezone(req.currentUser.timezone)
            ),
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

        // Log task creation event (temporarily disabled due to foreign key constraint issues)
        /*
        try {
            await logTaskCreated(
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
        */

        // Reload task with associations
        const taskWithAssociations = await Task.findByPk(task.id, {
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
            ],
        });

        if (!taskWithAssociations) {
            console.error('Failed to reload created task:', task.id);
            // Return the original task data as fallback
            const fallbackTask = {
                ...task.toJSON(),
                tags: [],
                Project: null,
                subtasks: [],
                today_move_count: 0,
                due_date: task.due_date
                    ? task.due_date instanceof Date
                        ? task.due_date.toISOString().split('T')[0]
                        : new Date(task.due_date).toISOString().split('T')[0]
                    : null,
                completed_at: task.completed_at
                    ? task.completed_at instanceof Date
                        ? task.completed_at.toISOString()
                        : new Date(task.completed_at).toISOString()
                    : null,
            };
            return res.status(201).json(fallbackTask);
        }

        const serializedTask = await serializeTask(
            taskWithAssociations,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

        // Add cache-busting headers to prevent HTTP caching
        res.set({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
        });

        res.status(201).json(serializedTask);
    } catch (error) {
        console.error('Error creating task:', error);
        console.error('Error stack:', error.stack);
        console.error('Error name:', error.name);
        res.status(400).json({
            error: 'There was a problem creating the task.',
            details: error.errors
                ? error.errors.map((e) => e.message)
                : [error.message],
        });
    }
});

/**
 * @swagger
 * /task/{id}:
 *   patch:
 *     summary: Update a task
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               priority:
 *                 type: string
 *               status:
 *                 type: string
 *               note:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Task updated
 */
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
                    attributes: ['id', 'name', 'uid'],
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
            due_date: processDueDateForStorage(
                due_date,
                getSafeTimezone(req.currentUser.timezone)
            ),
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

        // Check if any recurrence settings are changing and cleanup future instances if needed
        const recurrenceFields = [
            'recurrence_type',
            'recurrence_interval',
            'recurrence_end_date',
            'recurrence_weekday',
            'recurrence_month_day',
            'recurrence_week_of_month',
            'completion_based',
        ];

        const recurrenceChanged = recurrenceFields.some((field) => {
            const newValue = req.body[field];
            return newValue !== undefined && newValue !== task[field];
        });

        // Only cleanup if recurrence changed AND the old task was recurring (not 'none')
        // This prevents cleanup when changing TO 'none' from 'none'
        if (recurrenceChanged && task.recurrence_type !== 'none') {
            // Find child instances of this recurring task
            const childTasks = await Task.findAll({
                where: { recurring_parent_id: task.id },
            });

            if (childTasks.length > 0) {
                const now = new Date();

                // Separate future and past instances
                const futureInstances = childTasks.filter((child) => {
                    if (!child.due_date) return true; // Tasks without due_date are considered future (not yet scheduled)
                    return new Date(child.due_date) > now;
                });

                // Only cleanup future instances if not changing to 'none'
                const newRecurrenceType =
                    recurrence_type !== undefined
                        ? recurrence_type
                        : task.recurrence_type;
                if (newRecurrenceType !== 'none') {
                    // Delete future instances since recurrence changed
                    for (const futureInstance of futureInstances) {
                        await futureInstance.destroy();
                    }
                }

                // Past instances remain as orphaned instances (no changes needed)
                // This allows users to keep their completed/in-progress work
            }
        }

        await task.update(taskAttributes);

        // Generate new recurring tasks after updating recurrence settings (if still recurring)
        if (recurrenceChanged && task.recurrence_type !== 'none') {
            const newRecurrenceType =
                recurrence_type !== undefined
                    ? recurrence_type
                    : task.recurrence_type;
            if (newRecurrenceType !== 'none') {
                try {
                    // Generate new recurring tasks for the updated pattern
                    await generateRecurringTasks(req.currentUser.id, 7);
                } catch (error) {
                    console.error(
                        'Error generating new recurring tasks after update:',
                        error
                    );
                    // Don't fail the update if regeneration fails
                }
            }
        }
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
                await logTaskUpdate(task.id, req.currentUser.id, changes, {
                    source: 'web',
                });
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
                    await logEvent({
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
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
                    required: false,
                },
            ],
        });

        // Use serializeTask to include subtasks data
        const serializedTask = await serializeTask(
            taskWithAssociations,
            req.currentUser.timezone,
            { skipDisplayNameTransform: true }
        );

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
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
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
            nextTask = await handleTaskCompletion(task);
        }

        // Use serializeTask to include subtasks data
        const response = await serializeTask(task, req.currentUser.timezone);

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

        // Check for child tasks and handle smart deletion for recurring tasks
        const childTasks = await Task.findAll({
            where: { recurring_parent_id: req.params.id },
        });

        // If this is a recurring parent task with children, implement smart deletion
        if (childTasks.length > 0) {
            const now = new Date();

            // Separate past and future instances
            const futureInstances = childTasks.filter((child) => {
                if (!child.due_date) return true; // Tasks without due_date are considered future (not yet scheduled)
                return new Date(child.due_date) > now;
            });

            const pastInstances = childTasks.filter((child) => {
                if (!child.due_date) return false; // Tasks without due_date are considered future, not past
                return new Date(child.due_date) <= now;
            });

            // Delete future instances
            for (const futureInstance of futureInstances) {
                await futureInstance.destroy();
            }

            // Orphan past instances (remove parent relationship)
            for (const pastInstance of pastInstances) {
                await pastInstance.update({
                    recurring_parent_id: null,
                    recurrence_type: 'none',
                    recurrence_interval: null,
                    recurrence_end_date: null,
                    last_generated_date: null,
                    recurrence_weekday: null,
                    recurrence_month_day: null,
                    recurrence_week_of_month: null,
                    completion_based: false,
                });
            }
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
        const newTasks = await generateRecurringTasks(req.currentUser.id);

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
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Project,
                    attributes: ['id', 'name', 'uid'],
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
            await logEvent({
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
        const serializedTask = await serializeTask(
            task,
            req.currentUser.timezone
        );
        res.json(serializedTask);
    } catch (error) {
        console.error('Error toggling task today flag:', error);
        res.status(500).json({ error: 'Failed to update task today flag' });
    }
});

// GET /api/task/:id/next-iterations
router.get('/task/:id/next-iterations', async (req, res) => {
    try {
        const taskId = parseInt(req.params.id);

        // Find the task
        const task = await Task.findOne({
            where: {
                id: taskId,
                user_id: req.currentUser.id,
            },
        });

        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        // Check if task has recurrence
        if (!task.recurrence_type || task.recurrence_type === 'none') {
            return res.json({ iterations: [] });
        }

        // Calculate next 5 iteration dates
        const iterations = [];

        // Allow starting from a specific date (for child tasks) or default to today
        const startFromDate = req.query.startFromDate;
        const startDate = startFromDate ? new Date(startFromDate) : new Date();
        startDate.setUTCHours(0, 0, 0, 0);

        // Calculate next iteration directly using recurrence logic
        let nextDate = new Date(startDate);

        // For daily recurrence, start from the next day after startDate
        if (task.recurrence_type === 'daily') {
            nextDate.setDate(
                nextDate.getDate() + (task.recurrence_interval || 1)
            );
        } else if (task.recurrence_type === 'weekly') {
            // For weekly, find next occurrence of the target weekday
            const interval = task.recurrence_interval || 1;
            if (
                task.recurrence_weekday !== null &&
                task.recurrence_weekday !== undefined
            ) {
                const currentWeekday = nextDate.getDay();
                const daysUntilTarget =
                    (task.recurrence_weekday - currentWeekday + 7) % 7;
                if (daysUntilTarget === 0) {
                    // If startDate is the target weekday, move to next week
                    nextDate.setDate(nextDate.getDate() + interval * 7);
                } else {
                    nextDate.setDate(nextDate.getDate() + daysUntilTarget);
                }
            } else {
                nextDate.setDate(nextDate.getDate() + interval * 7);
            }
        } else {
            // For other types, use the RecurringTaskService method but calculate from startDate
            nextDate = calculateNextDueDate(task, startDate);
        }

        for (let i = 0; i < 5 && nextDate; i++) {
            // Check if recurrence has an end date and we've exceeded it
            if (task.recurrence_end_date) {
                const endDate = new Date(task.recurrence_end_date);
                if (nextDate > endDate) {
                    break;
                }
            }

            iterations.push({
                date: processDueDateForResponse(
                    nextDate,
                    getSafeTimezone(req.currentUser.timezone)
                ),
                utc_date: nextDate.toISOString(),
            });

            // Calculate the next iteration by adding the interval
            if (task.recurrence_type === 'daily') {
                nextDate = new Date(nextDate);
                nextDate.setDate(
                    nextDate.getDate() + (task.recurrence_interval || 1)
                );
            } else if (task.recurrence_type === 'weekly') {
                nextDate = new Date(nextDate);
                nextDate.setDate(
                    nextDate.getDate() + (task.recurrence_interval || 1) * 7
                );
            } else {
                // For monthly and other complex recurrences, use the service method
                nextDate = calculateNextDueDate(task, nextDate);
            }
        }

        res.json({ iterations });
    } catch (error) {
        console.error('Error getting next iterations:', error);
        res.status(500).json({ error: 'Failed to get next iterations' });
    }
});

module.exports = router;
