const { groupTasksByDay } = require('./grouping');
const { serializeTasks } = require('../core/serializers');
const { computeTaskMetrics } = require('../queries/metrics-computation');
const { getTaskTodayMoveCounts } = require('../taskEventService');
const { Task } = require('../../../models');
const { Op } = require('sequelize');

async function handleRecurringTasks(userId, queryType) {
    return;
}

async function buildGroupedTasks(
    tasks,
    queryType,
    groupBy,
    maxDays,
    orderBy,
    timezone,
    language = 'en'
) {
    if (queryType !== 'upcoming' || groupBy !== 'day') {
        return null;
    }

    const days = maxDays ? parseInt(maxDays, 10) : 7;
    const dayGroupingOrderBy = orderBy || 'due_date:asc';

    return await groupTasksByDay(
        tasks,
        timezone,
        days,
        dayGroupingOrderBy,
        language
    );
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

    const permissionCache = new Map();
    const metricsData = await computeTaskMetrics(
        userId,
        timezone,
        permissionCache
    );

    const listKeyMap = {
        tasks_in_progress: metricsData.tasks_in_progress,
        tasks_today_plan: metricsData.today_plan_tasks,
        tasks_due_today: metricsData.tasks_due_today,
        tasks_overdue: metricsData.tasks_overdue,
        suggested_tasks: metricsData.suggested_tasks,
        tasks_completed_today: metricsData.tasks_completed_today,
    };

    // Single move-count query covering all lists
    const allTasks = Object.values(listKeyMap).flat();
    const allTaskIds = [...new Set(allTasks.map((t) => t.id))];
    const moveCountMap = await getTaskTodayMoveCounts(allTaskIds);

    // Single batch query for all recurring parent UIDs
    const parentIds = [
        ...new Set(
            allTasks
                .filter((t) => t.recurring_parent_id)
                .map((t) => t.recurring_parent_id)
        ),
    ];
    const parentUidMap = {};
    if (parentIds.length > 0) {
        const parents = await Task.findAll({
            where: { id: { [Op.in]: parentIds } },
            attributes: ['id', 'uid'],
            raw: true,
        });
        parents.forEach((p) => {
            parentUidMap[p.id] = p.uid;
        });
    }

    // Parallelize all serialization calls with shared pre-fetched maps
    const keys = Object.keys(listKeyMap);
    const serializedArrays = await Promise.all(
        keys.map((key) =>
            serializeTasks(
                listKeyMap[key],
                timezone,
                serializationOptions,
                moveCountMap,
                parentUidMap
            )
        )
    );

    const serializedLists = {};
    keys.forEach((key, i) => {
        serializedLists[key] = serializedArrays[i];
    });

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
