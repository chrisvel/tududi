const { Task } = require('../../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const permissionsService = require('../../../services/permissionsService');
const {
    countTotalOpenTasks,
    countTasksPendingOverMonth,
    fetchTasksInProgress,
    fetchTodayPlanTasks,
    fetchTasksDueToday,
    fetchOverdueTasks,
    fetchSomedayTaskIds,
    fetchNonProjectTasks,
    fetchProjectTasks,
    fetchSomedayFallbackTasks,
    fetchTasksCompletedToday,
} = require('./metrics-queries');

async function computeSuggestedTasks(
    visibleTasksWhere,
    userId,
    totalOpenTasks,
    tasksInProgress,
    tasksDueToday,
    todayPlanTasks
) {
    if (
        totalOpenTasks < 3 &&
        tasksInProgress.length === 0 &&
        tasksDueToday.length === 0
    ) {
        return [];
    }

    const excludedTaskIds = [
        ...tasksInProgress.map((t) => t.id),
        ...tasksDueToday.map((t) => t.id),
        ...todayPlanTasks.map((t) => t.id),
    ];

    const somedayTaskIds = await fetchSomedayTaskIds(userId);

    const [nonProjectTasks, projectTasks] = await Promise.all([
        fetchNonProjectTasks(
            visibleTasksWhere,
            excludedTaskIds,
            somedayTaskIds
        ),
        fetchProjectTasks(visibleTasksWhere, excludedTaskIds, somedayTaskIds),
    ]);

    let combinedTasks = [...nonProjectTasks, ...projectTasks];

    if (combinedTasks.length < 6) {
        const usedTaskIds = [
            ...excludedTaskIds,
            ...combinedTasks.map((t) => t.id),
        ];

        const somedayFallbackTasks = await fetchSomedayFallbackTasks(
            userId,
            usedTaskIds,
            somedayTaskIds,
            12 - combinedTasks.length
        );

        combinedTasks = [...combinedTasks, ...somedayFallbackTasks];
    }

    return combinedTasks;
}

async function computeWeeklyCompletions(userId, userTimezone) {
    const todayInUserTz = moment.tz(userTimezone);
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

    return weeklyData;
}

async function computeTaskMetrics(
    userId,
    userTimezone = 'UTC',
    permissionCache = null
) {
    const visibleTasksWhere =
        await permissionsService.ownershipOrPermissionWhere(
            'task',
            userId,
            permissionCache
        );

    const [
        totalOpenTasks,
        tasksPendingOverMonth,
        tasksInProgress,
        todayPlanTasks,
        tasksDueToday,
        tasksOverdue,
        tasksCompletedToday,
        weeklyCompletions,
    ] = await Promise.all([
        countTotalOpenTasks(visibleTasksWhere),
        countTasksPendingOverMonth(visibleTasksWhere),
        fetchTasksInProgress(visibleTasksWhere),
        fetchTodayPlanTasks(visibleTasksWhere),
        fetchTasksDueToday(visibleTasksWhere, userTimezone),
        fetchOverdueTasks(visibleTasksWhere, userTimezone),
        fetchTasksCompletedToday(userId, userTimezone),
        computeWeeklyCompletions(userId, userTimezone),
    ]);

    const suggestedTasks = await computeSuggestedTasks(
        visibleTasksWhere,
        userId,
        totalOpenTasks,
        tasksInProgress,
        tasksDueToday,
        todayPlanTasks
    );

    return {
        total_open_tasks: totalOpenTasks,
        tasks_pending_over_month: tasksPendingOverMonth,
        tasks_in_progress_count: tasksInProgress.length,
        tasks_in_progress: tasksInProgress,
        tasks_due_today: tasksDueToday,
        tasks_overdue: tasksOverdue,
        today_plan_tasks: todayPlanTasks,
        suggested_tasks: suggestedTasks,
        tasks_completed_today: tasksCompletedToday,
        weekly_completions: weeklyCompletions,
    };
}

async function getTaskMetrics(userId, timezone) {
    const metrics = await computeTaskMetrics(userId, timezone);
    const {
        buildMetricsResponse,
        serializeTasks,
    } = require('../core/serializers');

    const response = await buildMetricsResponse(metrics);

    const serializedLists = {
        tasks_in_progress: await serializeTasks(
            metrics.tasks_in_progress,
            timezone
        ),
        tasks_today_plan: await serializeTasks(
            metrics.today_plan_tasks,
            timezone
        ),
        tasks_due_today: await serializeTasks(
            metrics.tasks_due_today,
            timezone
        ),
        tasks_overdue: await serializeTasks(metrics.tasks_overdue, timezone),
        suggested_tasks: await serializeTasks(
            metrics.suggested_tasks,
            timezone
        ),
        tasks_completed_today: await serializeTasks(
            metrics.tasks_completed_today,
            timezone
        ),
    };

    Object.assign(response, serializedLists);
    response.dashboard_lists = serializedLists;

    return response;
}

module.exports = {
    computeSuggestedTasks,
    computeWeeklyCompletions,
    computeTaskMetrics,
    getTaskMetrics,
};
