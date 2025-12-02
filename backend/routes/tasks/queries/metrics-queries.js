const { Task, sequelize } = require('../../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const {
    getSafeTimezone,
    getTodayBoundsInUTC,
} = require('../../../utils/timezone-utils');
const { getTaskIncludeConfig } = require('./query-builders');

async function countTotalOpenTasks(visibleTasksWhere) {
    return await Task.count({
        where: {
            ...visibleTasksWhere,
            status: { [Op.ne]: Task.STATUS.DONE },
            parent_task_id: null,
            recurring_parent_id: null,
        },
    });
}

async function countTasksPendingOverMonth(visibleTasksWhere) {
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return await Task.count({
        where: {
            ...visibleTasksWhere,
            status: { [Op.ne]: Task.STATUS.DONE },
            created_at: { [Op.lt]: oneMonthAgo },
            parent_task_id: null,
            recurring_parent_id: null,
        },
    });
}

async function fetchTasksInProgress(visibleTasksWhere) {
    return await Task.findAll({
        where: {
            ...visibleTasksWhere,
            status: { [Op.in]: [Task.STATUS.IN_PROGRESS, 'in_progress'] },
            parent_task_id: null,
            recurring_parent_id: null,
        },
        include: getTaskIncludeConfig(),
        order: [['priority', 'DESC']],
    });
}

async function fetchTodayPlanTasks(visibleTasksWhere) {
    return await Task.findAll({
        where: {
            [Op.and]: [
                visibleTasksWhere,
                {
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
            ],
        },
        include: getTaskIncludeConfig(),
        order: [
            ['priority', 'DESC'],
            ['created_at', 'ASC'],
        ],
    });
}

async function fetchTasksDueToday(visibleTasksWhere, userTimezone) {
    const safeTimezone = getSafeTimezone(userTimezone);
    const todayBounds = getTodayBoundsInUTC(safeTimezone);

    return await Task.findAll({
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
                    today: { [Op.or]: [false, null] },
                    [Op.or]: [
                        {
                            due_date: {
                                [Op.and]: [
                                    { [Op.gte]: todayBounds.start },
                                    { [Op.lte]: todayBounds.end },
                                ],
                            },
                        },
                        sequelize.literal(`EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id = Task.project_id
          AND projects.due_date_at >= '${todayBounds.start.toISOString()}'
          AND projects.due_date_at <= '${todayBounds.end.toISOString()}'
        )`),
                    ],
                },
            ],
        },
        include: getTaskIncludeConfig(),
        order: [
            ['priority', 'DESC'],
            ['due_date', 'ASC'],
            ['project_id', 'ASC'],
        ],
    });
}

async function fetchOverdueTasks(visibleTasksWhere, userTimezone) {
    const safeTimezone = getSafeTimezone(userTimezone);
    const todayBounds = getTodayBoundsInUTC(safeTimezone);

    return await Task.findAll({
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
                    today: { [Op.or]: [false, null] },
                    [Op.or]: [
                        { due_date: { [Op.lt]: todayBounds.start } },
                        sequelize.literal(`EXISTS (
          SELECT 1 FROM projects
          WHERE projects.id = Task.project_id
          AND projects.due_date_at < '${todayBounds.start.toISOString()}'
        )`),
                    ],
                },
            ],
        },
        include: getTaskIncludeConfig(),
        order: [
            ['priority', 'DESC'],
            ['due_date', 'ASC'],
            ['project_id', 'ASC'],
        ],
    });
}

async function fetchSomedayTaskIds(userId) {
    return await sequelize
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
}

async function fetchNonProjectTasks(
    visibleTasksWhere,
    excludedTaskIds,
    somedayTaskIds
) {
    return await Task.findAll({
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
        include: getTaskIncludeConfig(),
        order: [
            ['priority', 'DESC'],
            ['due_date', 'ASC'],
            ['project_id', 'ASC'],
        ],
        limit: 6,
    });
}

async function fetchProjectTasks(
    visibleTasksWhere,
    excludedTaskIds,
    somedayTaskIds
) {
    return await Task.findAll({
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
        include: getTaskIncludeConfig(),
        order: [
            ['priority', 'DESC'],
            ['due_date', 'ASC'],
            ['project_id', 'ASC'],
        ],
        limit: 6,
    });
}

async function fetchSomedayFallbackTasks(
    userId,
    usedTaskIds,
    somedayTaskIds,
    limit
) {
    return await Task.findAll({
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
        include: getTaskIncludeConfig(),
        order: [
            ['priority', 'DESC'],
            ['due_date', 'ASC'],
            ['project_id', 'ASC'],
        ],
        limit: limit,
    });
}

async function fetchTasksCompletedToday(userId, userTimezone) {
    const safeTimezone = getSafeTimezone(userTimezone);
    const todayBounds = getTodayBoundsInUTC(safeTimezone);

    return await Task.findAll({
        where: {
            user_id: userId,
            status: Task.STATUS.DONE,
            parent_task_id: null,
            recurring_parent_id: null,
            completed_at: {
                [Op.gte]: todayBounds.start,
                [Op.lte]: todayBounds.end,
            },
        },
        include: getTaskIncludeConfig(),
        order: [['completed_at', 'DESC']],
    });
}

module.exports = {
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
};
