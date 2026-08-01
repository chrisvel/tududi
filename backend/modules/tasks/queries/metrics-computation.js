const { Task, RecurringCompletion } = require('../../../models');
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
    fetchSomedayExcludedTaskIds,
    fetchNonProjectTasks,
    fetchProjectTasks,
    fetchSomedayFallbackTasks,
    fetchTasksCompletedToday,
} = require('./metrics-queries');

const MAX_SUGGESTED_TASKS = 50;

const getPriorityValue = (priority) => {
    const priorityOrder = {
        high: 3,
        medium: 2,
        low: 1,
    };

    if (priority === null || priority === undefined) {
        return 0;
    }

    if (typeof priority === 'number') {
        // Normalize numeric priority (assuming 2=high,1=medium,0=low)
        if (priority >= 2) return priorityOrder.high;
        if (priority === 1) return priorityOrder.medium;
        if (priority === 0) return priorityOrder.low;
        return 0;
    }

    const normalized = String(priority).toLowerCase();
    return priorityOrder[normalized] || 0;
};

const multiCriteriaTaskSort = (a, b) => {
    // 1. Priority
    const priorityDiff =
        getPriorityValue(b.priority) - getPriorityValue(a.priority);
    if (priorityDiff !== 0) {
        return priorityDiff;
    }

    // 2. Due date (earlier first, null/undefined last)
    const getDueDateValue = (task) => {
        if (!task.due_date) return Infinity;
        const due =
            task.due_date instanceof Date
                ? task.due_date
                : new Date(task.due_date);
        const time = due.getTime();
        return Number.isNaN(time) ? Infinity : time;
    };

    const dueDiff = getDueDateValue(a) - getDueDateValue(b);
    if (dueDiff !== 0) {
        return dueDiff;
    }

    // 3. Project (group similar project tasks)
    const projectA = (a.project_id || '').toString();
    const projectB = (b.project_id || '').toString();
    return projectA.localeCompare(projectB);
};

async function computeSuggestedTasks(
    visibleTasksWhere,
    userId,
    totalOpenTasks,
    tasksInProgress,
    tasksDueToday,
    tasksOverdue,
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
        ...tasksOverdue.map((t) => t.id),
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
            somedayTaskIds
        );

        combinedTasks = [...combinedTasks, ...somedayFallbackTasks];
    }

    const now = Date.now();
    const DUE_DATE_HORIZON_MS = 3 * 24 * 60 * 60 * 1000;
    const filteredTasks = combinedTasks.filter((task) => {
        if (task.defer_until) {
            const deferUntil = new Date(task.defer_until).getTime();
            if (!Number.isNaN(deferUntil) && deferUntil > now) return false;
        }
        if (task.due_date) {
            const due = new Date(task.due_date).getTime();
            if (!Number.isNaN(due) && due > now + DUE_DATE_HORIZON_MS)
                return false;
        }
        return true;
    });

    filteredTasks.sort(multiCriteriaTaskSort);

    return filteredTasks.slice(0, MAX_SUGGESTED_TASKS);
}

async function computeWeeklyCompletions(userId, userTimezone) {
    const todayInUserTz = moment.tz(userTimezone);
    const weekStartInUserTz = moment.tz(userTimezone).subtract(6, 'days');
    const weekStart = weekStartInUserTz.clone().startOf('day').utc().toDate();
    const weekEnd = todayInUserTz.clone().endOf('day').utc().toDate();

    const [weeklyCompletionsRaw, recurringCompletionsRaw] = await Promise.all([
        Task.findAll({
            where: {
                user_id: userId,
                status: Task.STATUS.DONE,
                habit_mode: false,
                completed_at: {
                    [Op.between]: [weekStart, weekEnd],
                },
            },
            attributes: ['completed_at'],
            raw: true,
        }),
        RecurringCompletion.findAll({
            include: [
                {
                    model: Task,
                    as: 'Task',
                    attributes: [],
                    where: { user_id: userId },
                    required: true,
                },
            ],
            where: {
                completed_at: {
                    [Op.between]: [weekStart, weekEnd],
                },
                skipped: false,
            },
            attributes: ['completed_at'],
            raw: true,
        }),
    ]);

    const dateCountMap = {};
    weeklyCompletionsRaw.forEach((task) => {
        const completedDate = new Date(task.completed_at);
        const dateInUserTz = moment(completedDate)
            .tz(userTimezone)
            .format('YYYY-MM-DD');
        dateCountMap[dateInUserTz] = (dateCountMap[dateInUserTz] || 0) + 1;
    });
    recurringCompletionsRaw.forEach((rc) => {
        const completedDate = new Date(rc.completed_at);
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

    const somedayExcludedIds = await fetchSomedayExcludedTaskIds(userId);

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
        fetchTodayPlanTasks(visibleTasksWhere, somedayExcludedIds),
        fetchTasksDueToday(
            visibleTasksWhere,
            userTimezone,
            userId,
            somedayExcludedIds,
            permissionCache
        ),
        fetchOverdueTasks(
            visibleTasksWhere,
            userTimezone,
            userId,
            somedayExcludedIds,
            permissionCache
        ),
        fetchTasksCompletedToday(userId, userTimezone),
        computeWeeklyCompletions(userId, userTimezone),
    ]);

    const suggestedTasks = await computeSuggestedTasks(
        visibleTasksWhere,
        userId,
        totalOpenTasks,
        tasksInProgress,
        tasksDueToday,
        tasksOverdue,
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
    const permissionCache = new Map();
    const metrics = await computeTaskMetrics(userId, timezone, permissionCache);

    const {
        buildMetricsResponse,
        serializeTasks,
    } = require('../core/serializers');
    const { getTaskTodayMoveCounts } = require('../taskEventService');
    const { Task } = require('../../../models');
    const { Op } = require('sequelize');

    const response = await buildMetricsResponse(metrics);

    // Collect all tasks across every list for single-pass pre-fetching
    const allLists = [
        metrics.tasks_in_progress,
        metrics.today_plan_tasks,
        metrics.tasks_due_today,
        metrics.tasks_overdue,
        metrics.suggested_tasks,
        metrics.tasks_completed_today,
    ];
    const allTasks = allLists.flat();
    const allTaskIds = [...new Set(allTasks.map((t) => t.id))];

    // Single move-count query covering all lists
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

    // Parallelize all 6 serialization calls with shared pre-fetched maps
    const [
        tasks_in_progress,
        tasks_today_plan,
        tasks_due_today,
        tasks_overdue,
        suggested_tasks,
        tasks_completed_today,
    ] = await Promise.all([
        serializeTasks(
            metrics.tasks_in_progress,
            timezone,
            {},
            moveCountMap,
            parentUidMap
        ),
        serializeTasks(
            metrics.today_plan_tasks,
            timezone,
            {},
            moveCountMap,
            parentUidMap
        ),
        serializeTasks(
            metrics.tasks_due_today,
            timezone,
            {},
            moveCountMap,
            parentUidMap
        ),
        serializeTasks(
            metrics.tasks_overdue,
            timezone,
            {},
            moveCountMap,
            parentUidMap
        ),
        serializeTasks(
            metrics.suggested_tasks,
            timezone,
            {},
            moveCountMap,
            parentUidMap
        ),
        serializeTasks(
            metrics.tasks_completed_today,
            timezone,
            {},
            moveCountMap,
            parentUidMap
        ),
    ]);

    const serializedLists = {
        tasks_in_progress,
        tasks_today_plan,
        tasks_due_today,
        tasks_overdue,
        suggested_tasks,
        tasks_completed_today,
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
