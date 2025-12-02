const {
    generateRecurringTasksWithLock,
} = require('../../../services/recurringTaskService');
const { groupTasksByDay } = require('./grouping');
const { serializeTasks } = require('../core/serializers');
const { computeTaskMetrics } = require('../queries/metrics-computation');

async function handleRecurringTasks(userId, queryType) {
    if (queryType === 'upcoming') {
        await generateRecurringTasksWithLock(userId, 7);
    } else if (queryType === 'today') {
        await generateRecurringTasksWithLock(userId, 1);
    }
}

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

async function serializeGroupedTasks(groupedTasks, timezone) {
    if (!groupedTasks) return null;

    const serialized = {};
    for (const [groupName, groupTasks] of Object.entries(groupedTasks)) {
        serialized[groupName] = await serializeTasks(groupTasks, timezone);
    }
    return serialized;
}

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
        'tasks_today_plan',
        'tasks_due_today',
        'tasks_overdue',
        'suggested_tasks',
        'tasks_completed_today',
    ];

    const serializedLists = {};

    for (const key of listKeys) {
        const metricsKey =
            key === 'tasks_today_plan' ? 'today_plan_tasks' : key;
        serializedLists[key] = await serializeTasks(
            metricsData[metricsKey],
            timezone,
            serializationOptions
        );
    }

    Object.assign(response, serializedLists);
    response.dashboard_lists = serializedLists;
}

function addPerformanceHeaders(res, startTime, queryStats) {
    const totalTime = Date.now() - startTime;
    res.set('X-Response-Time', `${totalTime}ms`);
    res.set('X-Query-Count', queryStats.count.toString());
}

module.exports = {
    handleRecurringTasks,
    buildGroupedTasks,
    serializeGroupedTasks,
    addDashboardLists,
    addPerformanceHeaders,
};
