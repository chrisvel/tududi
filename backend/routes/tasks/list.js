const express = require('express');
const router = express.Router();
const {
    generateRecurringTasksWithLock,
} = require('../../services/recurringTaskService');
const { logError } = require('../../services/logService');
const {
    filterTasksByParams,
    serializeTasks,
    groupTasksByDay,
    computeTaskMetrics,
} = require('./helpers');
const {
    resetQueryCounter,
    getQueryStats,
    enableQueryLogging,
} = require('../../middleware/queryLogger');

// Enable query logging in development
if (process.env.NODE_ENV === 'development') {
    enableQueryLogging();
}

/**
 * Generate recurring tasks for upcoming view
 */
async function handleRecurringTasks(userId, queryType) {
    if (queryType === 'upcoming') {
        await generateRecurringTasksWithLock(userId, 7);
    }
}

/**
 * Build grouped tasks response if requested
 */
async function buildGroupedTasks(
    tasks,
    queryType,
    groupBy,
    maxDays,
    orderBy,
    timezone
) {
    if (queryType !== 'upcoming' || groupBy !== 'day') {
        return null;
    }

    const days = maxDays ? parseInt(maxDays, 10) : 7;
    const dayGroupingOrderBy = orderBy || 'due_date:asc';

    return await groupTasksByDay(tasks, timezone, days, dayGroupingOrderBy);
}

/**
 * Serialize grouped tasks for response
 */
async function serializeGroupedTasks(groupedTasks, timezone) {
    if (!groupedTasks) return null;

    const serialized = {};
    for (const [groupName, groupTasks] of Object.entries(groupedTasks)) {
        serialized[groupName] = await serializeTasks(groupTasks, timezone);
    }
    return serialized;
}

/**
 * Add dashboard task lists for today view
 */
async function addDashboardLists(
    response,
    userId,
    timezone,
    queryType,
    includeLists,
    serializationOptions
) {
    if (queryType !== 'today' || includeLists !== 'true') {
        return;
    }

    const metricsData = await computeTaskMetrics(userId, timezone);

    const listKeys = [
        'tasks_in_progress',
        'tasks_due_today',
        'suggested_tasks',
        'tasks_completed_today',
    ];

    for (const key of listKeys) {
        response[key] = await serializeTasks(
            metricsData[key],
            timezone,
            serializationOptions
        );
    }
}

/**
 * Add performance timing headers
 */
function addPerformanceHeaders(res, startTime, queryStats) {
    const totalTime = Date.now() - startTime;
    res.set('X-Response-Time', `${totalTime}ms`);
    res.set('X-Query-Count', queryStats.count.toString());
}

router.get('/tasks', async (req, res) => {
    const startTime = Date.now();
    resetQueryCounter();

    try {
        const { type, groupBy, maxDays, order_by, include_lists } = req.query;
        const { id: userId, timezone } = req.currentUser;

        await handleRecurringTasks(userId, type);

        const tasks = await filterTasksByParams(req.query, userId, timezone);

        const groupedTasks = await buildGroupedTasks(
            tasks,
            type,
            groupBy,
            maxDays,
            order_by,
            timezone
        );

        const serializationOptions =
            type === 'today' ? { preserveOriginalName: true } : {};

        const response = {
            tasks: await serializeTasks(tasks, timezone, serializationOptions),
        };

        const serializedGrouped = await serializeGroupedTasks(
            groupedTasks,
            timezone
        );
        if (serializedGrouped) {
            response.groupedTasks = serializedGrouped;
        }

        await addDashboardLists(
            response,
            userId,
            timezone,
            type,
            include_lists,
            serializationOptions
        );

        addPerformanceHeaders(res, startTime, getQueryStats());
        res.json(response);
    } catch (error) {
        logError('Error fetching tasks:', error);
        if (error.message === 'Invalid order column specified.') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
