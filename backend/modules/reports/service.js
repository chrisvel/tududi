'use strict';

const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { Task, Project, Area, InboxItem } = require('../../models');

const STALE_DAYS = 14;

async function getGtdReport(userId, userTimezone = 'UTC') {
    const [
        inboxCount,
        stalledProjects,
        waitingFor,
        actionDebt,
        completionTrends,
        areaBalance,
    ] = await Promise.all([
        computeInboxCount(userId),
        computeStalledProjects(userId),
        computeWaitingFor(userId),
        computeActionDebt(userId),
        computeCompletionTrends(userId, userTimezone),
        computeAreaBalance(userId, userTimezone),
    ]);

    return {
        weekly_review: {
            inbox_count: inboxCount,
            stalled_projects: stalledProjects,
            waiting_for: waitingFor,
        },
        project_health: {
            action_debt: actionDebt,
            total_active: actionDebt.length,
        },
        completion_trends: completionTrends,
        area_balance: areaBalance,
    };
}

async function computeInboxCount(userId) {
    return InboxItem.count({
        where: { user_id: userId, status: 'added' },
    });
}

async function computeStalledProjects(userId) {
    const staleThreshold = moment().subtract(STALE_DAYS, 'days').toDate();

    const projects = await Project.findAll({
        where: {
            user_id: userId,
            status: 'in_progress',
        },
        include: [{ model: Area, attributes: ['name'], required: false }],
        attributes: ['id', 'name', 'status', 'updated_at', 'area_id'],
        order: [['updated_at', 'ASC']],
    });

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return [];

    const recentTaskUpdates = await Task.findAll({
        where: {
            project_id: { [Op.in]: projectIds },
            status: {
                [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.IN_PROGRESS],
            },
            updated_at: { [Op.gte]: staleThreshold },
        },
        attributes: ['project_id'],
        raw: true,
    });

    const recentlyActiveProjectIds = new Set(
        recentTaskUpdates.map((t) => t.project_id)
    );

    return projects
        .filter((p) => !recentlyActiveProjectIds.has(p.id))
        .map((p) => ({
            id: p.id,
            name: p.name,
            area: p.Area ? p.Area.name : null,
            last_activity: p.updated_at,
            days_stale: moment().diff(moment(p.updated_at), 'days'),
        }));
}

async function computeWaitingFor(userId) {
    const projects = await Project.findAll({
        where: { user_id: userId, status: 'waiting' },
        include: [{ model: Area, attributes: ['name'], required: false }],
        attributes: ['id', 'name', 'updated_at', 'area_id'],
        order: [['updated_at', 'ASC']],
    });

    return projects.map((p) => ({
        id: p.id,
        name: p.name,
        area: p.Area ? p.Area.name : null,
        waiting_since: p.updated_at,
        days_waiting: moment().diff(moment(p.updated_at), 'days'),
    }));
}

async function computeActionDebt(userId) {
    const projects = await Project.findAll({
        where: {
            user_id: userId,
            status: { [Op.in]: ['in_progress', 'not_started', 'planned'] },
        },
        include: [{ model: Area, attributes: ['name'], required: false }],
        attributes: ['id', 'name', 'status', 'updated_at', 'area_id'],
        order: [['name', 'ASC']],
    });

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return [];

    const openTasks = await Task.findAll({
        where: {
            project_id: { [Op.in]: projectIds },
            status: {
                [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.IN_PROGRESS],
            },
        },
        attributes: ['project_id'],
        raw: true,
    });

    const projectsWithTasks = new Set(openTasks.map((t) => t.project_id));

    return projects
        .filter((p) => !projectsWithTasks.has(p.id))
        .map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            area: p.Area ? p.Area.name : null,
        }));
}

async function computeCompletionTrends(userId, userTimezone) {
    const WEEKS = 8;
    const now = moment.tz(userTimezone);
    const rangeStart = now
        .clone()
        .subtract(WEEKS, 'weeks')
        .startOf('isoWeek')
        .utc()
        .toDate();
    const rangeEnd = now.clone().endOf('day').utc().toDate();

    const completedTasks = await Task.findAll({
        where: {
            user_id: userId,
            status: Task.STATUS.DONE,
            completed_at: { [Op.between]: [rangeStart, rangeEnd] },
        },
        attributes: ['completed_at'],
        raw: true,
    });

    const weekMap = {};
    completedTasks.forEach((t) => {
        const weekKey = moment(t.completed_at)
            .tz(userTimezone)
            .startOf('isoWeek')
            .format('YYYY-MM-DD');
        weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
    });

    const weeks = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
        const weekStart = now.clone().subtract(i, 'weeks').startOf('isoWeek');
        const weekKey = weekStart.format('YYYY-MM-DD');
        const isCurrentWeek = i === 0;
        const label = isCurrentWeek
            ? 'This week'
            : i === 1
              ? 'Last week'
              : `${i}w ago`;
        weeks.push({
            week: weekKey,
            label,
            count: weekMap[weekKey] || 0,
        });
    }

    return { weeks };
}

async function computeAreaBalance(userId, userTimezone) {
    const DAYS = 30;
    const now = moment.tz(userTimezone);
    const rangeStart = now
        .clone()
        .subtract(DAYS, 'days')
        .startOf('day')
        .utc()
        .toDate();

    const areas = await Area.findAll({
        where: { user_id: userId },
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
    });

    const areaIds = areas.map((a) => a.id);
    if (areaIds.length === 0) return [];

    const [completedTasks, openTasks] = await Promise.all([
        Task.findAll({
            where: {
                user_id: userId,
                area_id: { [Op.in]: areaIds },
                status: Task.STATUS.DONE,
                completed_at: { [Op.gte]: rangeStart },
            },
            attributes: ['area_id'],
            raw: true,
        }),
        Task.findAll({
            where: {
                user_id: userId,
                area_id: { [Op.in]: areaIds },
                status: {
                    [Op.in]: [Task.STATUS.NOT_STARTED, Task.STATUS.IN_PROGRESS],
                },
            },
            attributes: ['area_id'],
            raw: true,
        }),
    ]);

    const completedByArea = {};
    completedTasks.forEach((t) => {
        completedByArea[t.area_id] = (completedByArea[t.area_id] || 0) + 1;
    });

    const openByArea = {};
    openTasks.forEach((t) => {
        openByArea[t.area_id] = (openByArea[t.area_id] || 0) + 1;
    });

    return areas
        .filter(
            (a) => (completedByArea[a.id] || 0) + (openByArea[a.id] || 0) > 0
        )
        .map((a) => ({
            id: a.id,
            name: a.name,
            completed: completedByArea[a.id] || 0,
            open: openByArea[a.id] || 0,
        }));
}

module.exports = { getGtdReport };
