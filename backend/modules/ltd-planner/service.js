'use strict';

// Life-to-Day (T-501, T-504, T-505): capacity, Recovery, Overwhelmed and the
// daily contribution report. Deterministic (ADR-006); nothing derived is
// stored, Recovery writes go through the Journal.
const moment = require('moment-timezone');
const capacityModel = require('./capacity');
const repository = require('./repository');
const dailyPlanService = require('../daily-plan/service');
const dailyPlanRepository = require('../daily-plan/repository');
const calendarFeeds = require('../calendar-feeds/service');
const progress = require('../ltd-progress/service');
const { withJournal } = require('../ltd-journal/service');
const { Task } = require('../../models');
const { ValidationError } = require('../../shared/errors');
const {
    getSafeTimezone,
    getDayBoundsInUTC,
} = require('../../utils/timezone-utils');

const HOURS_STEP = 15;
const MAX_KEPT = 3;
const CLOSED = [Task.STATUS.DONE, Task.STATUS.ARCHIVED, Task.STATUS.CANCELLED];

const isValidHours = (h) =>
    !!h &&
    Number.isInteger(h.start) &&
    Number.isInteger(h.end) &&
    h.start >= 0 &&
    h.end <= 24 * 60 &&
    h.start < h.end &&
    h.start % HOURS_STEP === 0 &&
    h.end % HOURS_STEP === 0;

async function getWorkHours(user) {
    const settings = await dailyPlanRepository.findUiSettings(user.id);
    const saved = settings.planning?.workHours;
    return isValidHours(saved)
        ? { start: saved.start, end: saved.end }
        : { ...capacityModel.DEFAULT_WINDOW };
}

async function saveWorkHours(user, body) {
    const next = { start: body?.start, end: body?.end };
    if (!isValidHours(next)) {
        throw new ValidationError(
            `start and end must be minutes of the day in steps of ${HOURS_STEP}, with start before end`
        );
    }
    const settings = await dailyPlanRepository.findUiSettings(user.id);
    await dailyPlanRepository.saveUiSettings(user.id, {
        ...settings,
        planning: { ...(settings.planning || {}), workHours: next },
    });
    return next;
}

// Busy time comes only from the existing iCal feeds; no feed means no
// events and therefore no event warnings.
async function dayEvents(user, date) {
    try {
        return (await calendarFeeds.eventsForDay(user, date)).events;
    } catch {
        return [];
    }
}

const isDone = (item) =>
    item.occurrence_done || CLOSED.includes(item.task?.status);

async function factorFor(userId) {
    return capacityModel.planningFactor(
        await repository.finishedSessions(userId, capacityModel.FACTOR_SAMPLE)
    );
}

async function getCapacity(user, date) {
    const { date: planDate, plan } = await dailyPlanService.getPlan(user, date);
    const [window, events, factor] = await Promise.all([
        getWorkHours(user),
        dayEvents(user, planDate),
        factorFor(user.id),
    ]);
    const items = (plan?.items || []).map((item) => ({
        task_uid: item.task_uid,
        start_minute: item.start_minute,
        duration_minutes: item.duration_minutes,
        priority: item.task?.priority ?? 0,
        done: isDone(item),
    }));
    return {
        date: planDate,
        ...capacityModel.computeCapacity({ window, events, items, factor }),
        ...capacityModel.blockWarnings(
            items.filter((i) => !i.done),
            events
        ),
    };
}

const minuteNow = (timezone) => {
    const now = moment.tz(timezone);
    return now.hours() * 60 + now.minutes();
};

// "Lighten up": keep at most three short open tasks that fit 60% of the
// rest of the day, move the other open tasks to tomorrow's plan. One
// journal entry, undone through the existing Journal path.
async function recover(user, date, actor, { nowMinute } = {}) {
    const timezone = getSafeTimezone(user.timezone);
    const { date: planDate, plan } = await dailyPlanService.getPlan(user, date);
    const tomorrow = moment(planDate).add(1, 'day').format('YYYY-MM-DD');
    const [window, events] = await Promise.all([
        getWorkHours(user),
        dayEvents(user, planDate),
    ]);
    const budget = capacityModel.recoveryCapacity({
        window,
        events,
        now: nowMinute ?? minuteNow(timezone),
    });
    const open = (plan?.items || []).filter((item) => !isDone(item));
    const byDuration = [...open].sort(
        (a, b) => a.duration_minutes - b.duration_minutes
    );
    const kept = new Set();
    let used = 0;
    for (const item of byDuration) {
        if (kept.size >= MAX_KEPT) break;
        if (used + item.duration_minutes > budget) continue;
        kept.add(item.task_uid);
        used += item.duration_minutes;
    }
    // Nothing fits: still leave the shortest one as a five-minute start.
    if (!kept.size && byDuration.length) kept.add(byDuration[0].task_uid);
    const moved = open.filter((item) => !kept.has(item.task_uid));
    // Nothing to move: no write and no journal entry.
    if (!moved.length) {
        return {
            journal_uid: null,
            date: planDate,
            moved_to: tomorrow,
            moved: [],
            kept: [...kept],
            capacity_rest_minutes: budget,
        };
    }

    const result = await withJournal(actor, async (transaction, record) => {
        const today = await repository.planRows(user.id, planDate, transaction);
        const next = await repository.planRows(user.id, tomorrow, transaction);
        const movedIds = new Set(moved.map((item) => item.task.id));
        const todayRows = today.rows.filter(
            (row) => !movedIds.has(row.task_id)
        );
        const nextIds = new Set(next.rows.map((row) => row.task_id));
        const nextRows = [
            ...next.rows,
            ...today.rows
                .filter((row) => movedIds.has(row.task_id))
                .filter((row) => !nextIds.has(row.task_id))
                .map((row) => ({ ...row, start_minute: null })),
        ];
        const todayPlan = await repository.writeRows(
            user.id,
            planDate,
            todayRows,
            transaction
        );
        await repository.writeRows(user.id, tomorrow, nextRows, transaction);
        const entry = await record({
            op: 'recovery',
            entity_type: 'daily_plan',
            entity_uid: todayPlan.uid,
            before: {
                days: [
                    { date: planDate, rows: today.rows },
                    { date: tomorrow, rows: next.rows },
                ],
            },
            after: {
                days: [
                    { date: planDate, rows: todayRows },
                    { date: tomorrow, rows: nextRows },
                ],
            },
        });
        return { journal_uid: entry.uid };
    });
    return {
        ...result,
        date: planDate,
        moved_to: tomorrow,
        moved: moved.map((item) => item.task_uid),
        kept: [...kept],
        capacity_rest_minutes: budget,
    };
}

// Overwhelmed lasts until switched off or until the end of the local day,
// so a forgotten switch never mutes notifications for good.
async function setOverwhelmed(user, on) {
    if (typeof on !== 'boolean') {
        throw new ValidationError('on must be true or false');
    }
    const timezone = getSafeTimezone(user.timezone);
    const settings = await dailyPlanRepository.findUiSettings(user.id);
    const next = { ...settings };
    if (on) {
        next.overwhelmed = {
            until: moment.tz(timezone).endOf('day').toISOString(),
        };
    } else {
        delete next.overwhelmed;
    }
    await dailyPlanRepository.saveUiSettings(user.id, next);
    return getOverwhelmed(user);
}

function overwhelmedActive(settings, now = Date.now()) {
    const until = settings?.overwhelmed?.until;
    return !!until && new Date(until).getTime() > now;
}

async function getOverwhelmed(user) {
    const settings = await dailyPlanRepository.findUiSettings(user.id);
    const active = overwhelmedActive(settings);
    return { on: active, until: active ? settings.overwhelmed.until : null };
}

async function chainFor(userId, uid) {
    try {
        return await progress.whyChain(userId, uid);
    } catch {
        return [];
    }
}

// "Today helped these goals": minutes per direct goal of the whyChain.
// Focus minutes count first; a task finished without Focus counts its
// estimate. Work without a goal is listed as normal work, not an error.
async function getContribution(user, date) {
    const timezone = getSafeTimezone(user.timezone);
    const planDate = dailyPlanService.resolvePlanDate(date, timezone);
    const bounds = getDayBoundsInUTC(planDate, timezone);
    const [sessions, completed] = await Promise.all([
        repository.sessionsBetween(user.id, bounds.start, bounds.end),
        repository.tasksCompletedBetween(user.id, bounds.start, bounds.end),
    ]);
    const focusMinutes = new Map();
    for (const s of sessions) {
        if (!s.task_id || !s.actual_minutes) continue;
        focusMinutes.set(
            s.task_id,
            (focusMinutes.get(s.task_id) || 0) + s.actual_minutes
        );
    }
    const known = new Set(completed.map((t) => t.id));
    const focusedOnly = await repository.tasksByIds(
        user.id,
        [...focusMinutes.keys()].filter((id) => !known.has(id))
    );
    const groups = new Map();
    let unaligned = 0;
    for (const task of [...completed, ...focusedOnly]) {
        const minutes =
            focusMinutes.get(task.id) ??
            (known.has(task.id) ? task.estimated_minutes || 0 : 0);
        const chain = await chainFor(user.id, task.uid);
        if (!chain.length) {
            unaligned += minutes;
            continue;
        }
        const goal = chain[0];
        const group = groups.get(goal.uid) || {
            goal_uid: goal.uid,
            title: goal.title,
            horizon: goal.horizon,
            chain,
            minutes: 0,
            tasks: 0,
        };
        group.minutes += minutes;
        group.tasks += 1;
        groups.set(goal.uid, group);
    }
    return {
        date: planDate,
        goals: [...groups.values()].sort((a, b) => b.minutes - a.minutes),
        unaligned_minutes: unaligned,
    };
}

module.exports = {
    getWorkHours,
    saveWorkHours,
    getCapacity,
    recover,
    setOverwhelmed,
    getOverwhelmed,
    overwhelmedActive,
    getContribution,
};
