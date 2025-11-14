const { TaskEvent, sequelize } = require('../models');

// Helper function to create value object
const createValueObject = (fieldName, value) =>
    value ? { [fieldName || 'value']: value } : null;

/**
 * Log a task event
 * @param {Object} eventData - Event data
 * @param {number} eventData.taskId - Task ID
 * @param {number} eventData.userId - User ID
 * @param {string} eventData.eventType - Type of event
 * @param {string} eventData.fieldName - Field that changed (optional)
 * @param {any} eventData.oldValue - Old value (optional)
 * @param {any} eventData.newValue - New value (optional)
 * @param {Object} eventData.metadata - Additional metadata (optional)
 */
const logEvent = async ({
    taskId,
    userId,
    eventType,
    fieldName = null,
    oldValue = null,
    newValue = null,
    metadata = {},
}) => {
    try {
        const finalMetadata = {
            source: 'web',
            ...metadata,
        };

        const event = await TaskEvent.create({
            task_id: taskId,
            user_id: userId,
            event_type: eventType,
            field_name: fieldName,
            old_value: createValueObject(fieldName, oldValue),
            new_value: createValueObject(fieldName, newValue),
            metadata: finalMetadata,
        });

        return event;
    } catch (error) {
        console.error('Error logging task event:', error);
        throw error;
    }
};

/**
 * Log task creation event
 */
const logTaskCreated = async (taskId, userId, taskData, metadata = {}) => {
    return await logEvent({
        taskId,
        userId,
        eventType: 'created',
        newValue: taskData,
        metadata: { ...metadata, action: 'task_created' },
    });
};

/**
 * Log status change event
 */
const logStatusChange = async (
    taskId,
    userId,
    oldStatus,
    newStatus,
    metadata = {}
) => {
    const eventType =
        newStatus === 2
            ? 'completed'
            : newStatus === 3
              ? 'archived'
              : 'status_changed';

    return await logEvent({
        taskId,
        userId,
        eventType,
        fieldName: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
        metadata: { ...metadata, action: 'status_change' },
    });
};

/**
 * Log priority change event
 */
const logPriorityChange = async (
    taskId,
    userId,
    oldPriority,
    newPriority,
    metadata = {}
) => {
    return await logEvent({
        taskId,
        userId,
        eventType: 'priority_changed',
        fieldName: 'priority',
        oldValue: oldPriority,
        newValue: newPriority,
        metadata: { ...metadata, action: 'priority_change' },
    });
};

/**
 * Log due date change event
 */
const logDueDateChange = async (
    taskId,
    userId,
    oldDueDate,
    newDueDate,
    metadata = {}
) => {
    return await logEvent({
        taskId,
        userId,
        eventType: 'due_date_changed',
        fieldName: 'due_date',
        oldValue: oldDueDate,
        newValue: newDueDate,
        metadata: { ...metadata, action: 'due_date_change' },
    });
};

/**
 * Log project change event
 */
const logProjectChange = async (
    taskId,
    userId,
    oldProjectId,
    newProjectId,
    metadata = {}
) => {
    return await logEvent({
        taskId,
        userId,
        eventType: 'project_changed',
        fieldName: 'project_id',
        oldValue: oldProjectId,
        newValue: newProjectId,
        metadata: { ...metadata, action: 'project_change' },
    });
};

/**
 * Log task name change event
 */
const logNameChange = async (
    taskId,
    userId,
    oldName,
    newName,
    metadata = {}
) => {
    return await logEvent({
        taskId,
        userId,
        eventType: 'name_changed',
        fieldName: 'name',
        oldValue: oldName,
        newValue: newName,
        metadata: { ...metadata, action: 'name_change' },
    });
};

/**
 * Log description change event
 */
const logDescriptionChange = async (
    taskId,
    userId,
    oldDescription,
    newDescription,
    metadata = {}
) => {
    return await logEvent({
        taskId,
        userId,
        eventType: 'description_changed',
        fieldName: 'description',
        oldValue: oldDescription,
        newValue: newDescription,
        metadata: { ...metadata, action: 'description_change' },
    });
};

// Helper function to determine event type based on field name and value
const getEventType = (fieldName, newValue) => {
    switch (fieldName) {
        case 'status':
            return newValue === 2
                ? 'completed'
                : newValue === 3
                  ? 'archived'
                  : 'status_changed';
        default:
            return `${fieldName}_changed`;
    }
};

/**
 * Log multiple field changes at once
 */
const logTaskUpdate = async (taskId, userId, changes, metadata = {}) => {
    const events = [];

    for (const [fieldName, { oldValue, newValue }] of Object.entries(changes)) {
        // Skip if values are the same
        if (oldValue === newValue) continue;

        const eventType = getEventType(fieldName, newValue);

        const event = await logEvent({
            taskId,
            userId,
            eventType,
            fieldName,
            oldValue,
            newValue,
            metadata: { ...metadata, action: 'bulk_update' },
        });

        events.push(event);
    }

    return events;
};

/**
 * Get task timeline (all events for a task)
 */
const getTaskTimeline = async (taskId) => {
    return await TaskEvent.findAll({
        where: { task_id: taskId },
        order: [['created_at', 'ASC']],
        include: [
            {
                model: require('../models').User,
                as: 'User',
                attributes: ['id', 'name', 'email'],
            },
        ],
    });
};

// Helper function to find start event
const findStartEvent = (events) =>
    events.find(
        (e) =>
            e.event_type === 'created' ||
            (e.event_type === 'status_changed' && e.new_value?.status === 1) // in_progress
    );

// Helper function to find completed event
const findCompletedEvent = (events) =>
    events.find(
        (e) =>
            e.event_type === 'completed' ||
            (e.event_type === 'status_changed' && e.new_value?.status === 2) // done
    );

// Helper function to calculate duration metrics
const calculateDurationMetrics = (taskId, startTime, endTime) => ({
    task_id: taskId,
    started_at: startTime,
    completed_at: endTime,
    duration_ms: endTime - startTime,
    duration_hours: (endTime - startTime) / (1000 * 60 * 60),
    duration_days: (endTime - startTime) / (1000 * 60 * 60 * 24),
});

/**
 * Get task completion metrics
 */
const getTaskCompletionTime = async (taskId) => {
    const events = await TaskEvent.findAll({
        where: {
            task_id: taskId,
            event_type: ['status_changed', 'created', 'completed'],
        },
        order: [['created_at', 'ASC']],
    });

    if (events.length === 0) return null;

    const startEvent = findStartEvent(events);
    const completedEvent = findCompletedEvent(events);

    if (!startEvent || !completedEvent) return null;

    const startTime = new Date(startEvent.created_at);
    const endTime = new Date(completedEvent.created_at);

    return calculateDurationMetrics(taskId, startTime, endTime);
};

// Helper function to build where clause for date range
const buildDateWhereClause = (userId, startDate, endDate) => {
    const whereClause = { user_id: userId };

    if (startDate && endDate) {
        whereClause.created_at = {
            [require('sequelize').Op.between]: [startDate, endDate],
        };
    }

    return whereClause;
};

// Helper function to calculate basic metrics from events
const calculateBasicMetrics = (events) => ({
    total_events: events.length,
    tasks_created: events.filter((e) => e.event_type === 'created').length,
    tasks_completed: events.filter((e) => e.event_type === 'completed').length,
    status_changes: events.filter((e) => e.event_type === 'status_changed')
        .length,
    average_completion_time: null,
    completion_times: [],
});

// Helper function to calculate average completion time
const calculateAverageCompletionTime = (completionTimes) => {
    if (completionTimes.length === 0) return null;

    const totalHours = completionTimes.reduce(
        (sum, ct) => sum + ct.duration_hours,
        0
    );
    return totalHours / completionTimes.length;
};

/**
 * Get user productivity metrics
 */
const getUserProductivityMetrics = async (
    userId,
    startDate = null,
    endDate = null
) => {
    const whereClause = buildDateWhereClause(userId, startDate, endDate);

    const events = await TaskEvent.findAll({
        where: whereClause,
        order: [['created_at', 'ASC']],
    });

    const metrics = calculateBasicMetrics(events);

    // Calculate completion times for all completed tasks
    const completedTasks = events.filter((e) => e.event_type === 'completed');
    const completionTimes = [];

    for (const completedEvent of completedTasks) {
        const taskCompletion = await getTaskCompletionTime(
            completedEvent.task_id
        );
        if (taskCompletion) {
            completionTimes.push(taskCompletion);
        }
    }

    if (completionTimes.length > 0) {
        metrics.average_completion_time =
            calculateAverageCompletionTime(completionTimes);
        metrics.completion_times = completionTimes;
    }

    return metrics;
};

/**
 * Get task activity summary for a date range
 */
const getTaskActivitySummary = async (userId, startDate, endDate) => {
    const events = await TaskEvent.findAll({
        where: {
            user_id: userId,
            created_at: {
                [require('sequelize').Op.between]: [startDate, endDate],
            },
        },
        attributes: [
            'event_type',
            [
                require('sequelize').fn(
                    'COUNT',
                    require('sequelize').col('id')
                ),
                'count',
            ],
            [
                require('sequelize').fn(
                    'DATE',
                    require('sequelize').col('created_at')
                ),
                'date',
            ],
        ],
        group: ['event_type', 'date'],
        order: [['date', 'ASC']],
    });

    return events;
};

/**
 * Get count of how many times a task has been moved to today
 */
const getTaskTodayMoveCount = async (taskId) => {
    const { Op } = require('sequelize');

    const count = await TaskEvent.count({
        where: {
            task_id: taskId,
            event_type: 'today_changed',
            new_value: {
                [Op.like]: '%"today":true%',
            },
        },
    });

    return count;
};

/**
 * Get today move counts for multiple tasks in a single query (bulk operation)
 * @param {Array<number>} taskIds - Array of task IDs
 * @returns {Promise<Object>} Map of task_id -> count
 */
const getTaskTodayMoveCounts = async (taskIds) => {
    const { Op } = require('sequelize');

    if (!taskIds || taskIds.length === 0) {
        return {};
    }

    const results = await TaskEvent.findAll({
        attributes: [
            'task_id',
            [sequelize.fn('COUNT', sequelize.col('task_id')), 'move_count'],
        ],
        where: {
            task_id: {
                [Op.in]: taskIds,
            },
            event_type: 'today_changed',
            new_value: {
                [Op.like]: '%"today":true%',
            },
        },
        group: ['task_id'],
        raw: true,
    });

    // Convert array to map for O(1) lookup
    const countMap = {};
    results.forEach((result) => {
        countMap[result.task_id] = parseInt(result.move_count, 10);
    });

    return countMap;
};

module.exports = {
    logEvent,
    logTaskCreated,
    logStatusChange,
    logPriorityChange,
    logDueDateChange,
    logProjectChange,
    logNameChange,
    logDescriptionChange,
    logTaskUpdate,
    getTaskTimeline,
    getTaskCompletionTime,
    getUserProductivityMetrics,
    getTaskActivitySummary,
    getTaskTodayMoveCount,
    getTaskTodayMoveCounts,
};
