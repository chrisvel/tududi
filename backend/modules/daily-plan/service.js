'use strict';

const moment = require('moment-timezone');
const repository = require('./repository');
const permissionsService = require('../../services/permissionsService');
const { serializeTasks } = require('../tasks/core/serializers');
const { computeTaskMetrics } = require('../tasks/queries/metrics-computation');
const { GROUP_ORDER, rankCandidates } = require('./ranking');
const {
    getSafeTimezone,
    getCurrentDateInTimezone,
    getTodayBoundsInUTC,
} = require('../../utils/timezone-utils');
const { ValidationError, NotFoundError } = require('../../shared/errors');

const MAX_ITEMS = 100;
const MINUTES_PER_DAY = 24 * 60;
const MIN_DURATION = 5;
const MAX_DURATION = 12 * 60;
const DEFAULT_DURATION = 30;
const INBOX_LIMIT = 20;

function resolvePlanDate(date, timezone) {
    if (
        date === undefined ||
        date === null ||
        date === '' ||
        date === 'today'
    ) {
        return getCurrentDateInTimezone(getSafeTimezone(timezone));
    }
    if (
        typeof date !== 'string' ||
        !moment(date, 'YYYY-MM-DD', true).isValid()
    ) {
        throw new ValidationError('date must be a YYYY-MM-DD date');
    }
    return date;
}

function isWholeNumberInRange(value, min, max) {
    return Number.isInteger(value) && value >= min && value <= max;
}

// Checks the shape of each item and that no two time slots overlap.
// Positions come from array order, so the client only has to send the list.
function validateItems(items) {
    if (!Array.isArray(items)) {
        throw new ValidationError('items must be an array');
    }
    if (items.length > MAX_ITEMS) {
        throw new ValidationError(
            `A day plan holds at most ${MAX_ITEMS} tasks`
        );
    }

    const seen = new Set();
    const normalized = items.map((item) => {
        if (!item || typeof item.task_uid !== 'string' || !item.task_uid) {
            throw new ValidationError('Each item needs a task_uid');
        }
        if (seen.has(item.task_uid)) {
            throw new ValidationError('A task can only be planned once a day');
        }
        seen.add(item.task_uid);

        const start =
            item.start_minute === undefined || item.start_minute === null
                ? null
                : item.start_minute;
        if (
            start !== null &&
            !isWholeNumberInRange(start, 0, MINUTES_PER_DAY - MIN_DURATION)
        ) {
            throw new ValidationError(
                'start_minute must be a whole number of minutes within the day'
            );
        }

        const duration =
            item.duration_minutes === undefined ||
            item.duration_minutes === null
                ? null
                : item.duration_minutes;
        if (
            duration !== null &&
            !isWholeNumberInRange(duration, MIN_DURATION, MAX_DURATION)
        ) {
            throw new ValidationError(
                `duration_minutes must be between ${MIN_DURATION} and ${MAX_DURATION}`
            );
        }
        if (
            start !== null &&
            start + (duration ?? DEFAULT_DURATION) > MINUTES_PER_DAY
        ) {
            throw new ValidationError('A time slot cannot run past midnight');
        }

        return {
            task_uid: item.task_uid,
            start_minute: start,
            duration_minutes: duration,
        };
    });

    const scheduled = normalized
        .filter((item) => item.start_minute !== null)
        .map((item) => ({
            start: item.start_minute,
            end:
                item.start_minute + (item.duration_minutes ?? DEFAULT_DURATION),
        }))
        .sort((a, b) => a.start - b.start);
    for (let i = 1; i < scheduled.length; i++) {
        if (scheduled[i].start < scheduled[i - 1].end) {
            throw new ValidationError('Planned time slots cannot overlap');
        }
    }

    return normalized;
}

async function visibleTaskWhere(userId) {
    return permissionsService.ownershipOrPermissionWhere('task', userId);
}

async function serializePlan(plan, userId, timezone) {
    if (!plan) return null;

    const items = plan.Items || [];
    const visibleWhere = await visibleTaskWhere(userId);
    const tasks = await repository.findVisibleTasksByIds(
        visibleWhere,
        items.map((item) => item.task_id)
    );
    const serialized = await serializeTasks(tasks, timezone);
    const byId = new Map(tasks.map((task, i) => [task.id, serialized[i]]));

    return {
        uid: plan.uid,
        date: plan.plan_date,
        started_at: plan.started_at,
        ai_wrap_up: plan.ai_wrap_up || null,
        items: items
            .filter((item) => byId.has(item.task_id))
            .map((item) => ({
                task_uid: byId.get(item.task_id).uid,
                position: item.position,
                start_minute: item.start_minute,
                duration_minutes: item.duration_minutes,
                task: byId.get(item.task_id),
            })),
    };
}

async function getPlan(user, date) {
    const timezone = getSafeTimezone(user.timezone);
    const planDate = resolvePlanDate(date, timezone);
    const plan = await repository.findPlan(user.id, planDate);
    return {
        date: planDate,
        plan: await serializePlan(plan, user.id, timezone),
    };
}

async function replaceItems(user, date, items) {
    const timezone = getSafeTimezone(user.timezone);
    const planDate = resolvePlanDate(date, timezone);
    const normalized = validateItems(items);

    const visibleWhere = await visibleTaskWhere(user.id);
    const tasks = await repository.findVisibleTasksByUids(
        visibleWhere,
        normalized.map((item) => item.task_uid)
    );
    const byUid = new Map(tasks.map((task) => [task.uid, task]));
    const missing = normalized.find((item) => !byUid.has(item.task_uid));
    if (missing) {
        throw new NotFoundError(`Task ${missing.task_uid} not found`);
    }

    const rows = normalized.map((item, index) => {
        const task = byUid.get(item.task_uid);
        return {
            task_id: task.id,
            position: index,
            start_minute: item.start_minute,
            duration_minutes:
                item.duration_minutes ??
                task.estimated_minutes ??
                DEFAULT_DURATION,
        };
    });

    await repository.replaceItems(user.id, planDate, rows);
    return getPlan(user, planDate);
}

async function startPlan(user, date) {
    const timezone = getSafeTimezone(user.timezone);
    const planDate = resolvePlanDate(date, timezone);
    await repository.markStarted(user.id, planDate);
    return getPlan(user, planDate);
}

// Appends tasks to a day's plan without a time, skipping ones already on
// it. Used to move unfinished work to tomorrow.
async function carryOver(user, date, taskUids) {
    if (
        !Array.isArray(taskUids) ||
        taskUids.some((uid) => typeof uid !== 'string' || !uid)
    ) {
        throw new ValidationError('task_uids must be a list of task uids');
    }
    const timezone = getSafeTimezone(user.timezone);
    const planDate = resolvePlanDate(date, timezone);
    const { plan } = await getPlan(user, planDate);
    const current = (plan?.items || []).map((item) => ({
        task_uid: item.task_uid,
        start_minute: item.start_minute,
        duration_minutes: item.duration_minutes,
    }));
    const already = new Set(current.map((item) => item.task_uid));
    const added = [...new Set(taskUids)]
        .filter((uid) => !already.has(uid))
        .map((uid) => ({ task_uid: uid, start_minute: null }));
    if (added.length === 0) return getPlan(user, planDate);
    return replaceItems(user, planDate, [...current, ...added]);
}

async function clearPlan(user, date) {
    const timezone = getSafeTimezone(user.timezone);
    const planDate = resolvePlanDate(date, timezone);
    await repository.deletePlan(user.id, planDate);
    return { date: planDate, plan: null };
}

// The planner's left column: the same lists the classic Today page shows,
// deduplicated so a task appears in the first group it belongs to, and
// ranked by the rules in ranking.js.
async function getCandidates(user) {
    const timezone = getSafeTimezone(user.timezone);
    const metrics = await computeTaskMetrics(user.id, timezone);

    // Started tasks that are past due count as overdue here, so late work
    // is never ranked below fresh work.
    const todayStart = new Date(getTodayBoundsInUTC(timezone).start).getTime();
    const started = [...metrics.tasks_in_progress, ...metrics.today_plan_tasks];
    const isLate = (task) =>
        task.due_date && new Date(task.due_date).getTime() < todayStart;

    const groupTasks = {
        overdue: [...metrics.tasks_overdue, ...started.filter(isLate)],
        due_today: metrics.tasks_due_today,
        in_progress: started,
        suggested: metrics.suggested_tasks,
    };

    const seen = new Set();
    const result = {};
    for (const key of GROUP_ORDER) {
        const unique = (groupTasks[key] || []).filter((task) => {
            if (seen.has(task.id)) return false;
            seen.add(task.id);
            return true;
        });
        result[key] = await serializeTasks(rankCandidates(unique), timezone);
    }

    const inbox = await repository.findOpenInboxItems(user.id, INBOX_LIMIT);
    result.inbox = inbox.items.map((item) => ({
        uid: item.uid,
        title: item.title,
        content: item.content,
        created_at: item.created_at,
    }));
    result.inbox_count = inbox.count;

    return result;
}

module.exports = {
    resolvePlanDate,
    validateItems,
    getPlan,
    replaceItems,
    startPlan,
    clearPlan,
    carryOver,
    getCandidates,
};
