'use strict';

const moment = require('moment-timezone');

// Pure habit maths. Everything works on local day keys ('YYYY-MM-DD') in the
// user's timezone so a check-in at 23:30 never lands on the next day.

const PERIODS = ['daily', 'weekly', 'monthly', 'interval'];
const DAY_FORMAT = 'YYYY-MM-DD';
// Loop Habit Tracker's decay: a daily habit loses half its strength in about
// 13 missed days, slower-period habits proportionally slower.
const STRENGTH_HALF_LIFE = 13;

function toDayKey(date, timezone) {
    return moment(date)
        .tz(timezone || 'UTC')
        .format(DAY_FORMAT);
}

function parseDay(key) {
    return moment.utc(key, DAY_FORMAT);
}

function addDays(key, days) {
    return parseDay(key).add(days, 'days').format(DAY_FORMAT);
}

function daysBetween(fromKey, toKey) {
    return parseDay(toKey).diff(parseDay(fromKey), 'days');
}

function weekday(key) {
    return parseDay(key).day();
}

function normalizeConfig(task, { timezone, firstDayOfWeek = 1 } = {}) {
    const period = PERIODS.includes(task.habit_frequency_period)
        ? task.habit_frequency_period
        : 'daily';
    const polarity = task.habit_polarity === 'quit' ? 'quit' : 'build';
    const targetValue = Number(task.habit_target_value);
    const measurable =
        polarity === 'build' && Number.isFinite(targetValue) && targetValue > 0;
    const scheduleDays =
        period === 'daily' &&
        Array.isArray(task.habit_schedule_days) &&
        task.habit_schedule_days.length > 0 &&
        task.habit_schedule_days.length < 7
            ? task.habit_schedule_days.map(Number)
            : null;
    const intervalDays =
        period === 'interval'
            ? Math.max(2, parseInt(task.habit_interval_days, 10) || 2)
            : null;

    return {
        period,
        polarity,
        measurable,
        goal: measurable
            ? targetValue
            : Math.max(1, parseInt(task.habit_target_count, 10) || 1),
        scheduleDays,
        intervalDays,
        timezone: timezone || 'UTC',
        firstDayOfWeek: Number.isInteger(firstDayOfWeek) ? firstDayOfWeek : 1,
        anchorKey: toDayKey(task.created_at || new Date(), timezone),
    };
}

function periodStart(key, cfg) {
    if (cfg.period === 'weekly') {
        const back = (weekday(key) - cfg.firstDayOfWeek + 7) % 7;
        return addDays(key, -back);
    }
    if (cfg.period === 'monthly') {
        return `${key.slice(0, 7)}-01`;
    }
    if (cfg.period === 'interval') {
        const offset = daysBetween(cfg.anchorKey, key);
        const index = Math.floor(offset / cfg.intervalDays);
        return addDays(cfg.anchorKey, index * cfg.intervalDays);
    }
    return key;
}

function nextPeriodStart(startKey, cfg) {
    if (cfg.period === 'weekly') return addDays(startKey, 7);
    if (cfg.period === 'monthly') {
        return parseDay(startKey).add(1, 'month').format(DAY_FORMAT);
    }
    if (cfg.period === 'interval') return addDays(startKey, cfg.intervalDays);
    return addDays(startKey, 1);
}

function periodEnd(startKey, cfg) {
    return addDays(nextPeriodStart(startKey, cfg), -1);
}

function periodLengthDays(startKey, cfg) {
    return daysBetween(startKey, nextPeriodStart(startKey, cfg));
}

// Several check-ins per day only make sense when the goal is an amount or
// more than one per day. Weekly "3 times" habits count distinct days.
function allowsMultiplePerDay(cfg) {
    if (cfg.polarity === 'quit') return false;
    return cfg.measurable || (cfg.period === 'daily' && cfg.goal > 1);
}

function isScheduledDay(key, cfg) {
    return !cfg.scheduleDays || cfg.scheduleDays.includes(weekday(key));
}

function entryAmount(entry, cfg) {
    if (!cfg.measurable) return 1;
    const value = Number(entry.value);
    return Number.isFinite(value) && value > 0 ? value : 0;
}

// Buckets check-ins (and skips) by period start.
function bucketEntries(entries, cfg) {
    const buckets = new Map();
    for (const entry of entries) {
        const key = periodStart(
            toDayKey(entry.completed_at, cfg.timezone),
            cfg
        );
        if (!buckets.has(key)) {
            buckets.set(key, { progress: 0, checkIns: 0, skipped: false });
        }
        const bucket = buckets.get(key);
        if (entry.skipped) {
            bucket.skipped = true;
        } else {
            bucket.checkIns += 1;
            bucket.progress += entryAmount(entry, cfg);
        }
    }
    return buckets;
}

// success | fail | neutral (skipped or an unscheduled day) | pending (the
// current period while it can still be met).
function periodStatus(startKey, bucket, cfg, isCurrent) {
    const progress = bucket ? bucket.progress : 0;
    const met =
        cfg.polarity === 'quit'
            ? !bucket || bucket.checkIns === 0
            : progress >= cfg.goal;

    if (met) return 'success';
    if (cfg.polarity === 'quit') return 'fail';
    if (bucket && bucket.skipped) return 'neutral';
    if (cfg.scheduleDays && !isScheduledDay(startKey, cfg)) return 'neutral';
    if (isCurrent) return 'pending';
    return 'fail';
}

function periodFraction(bucket, cfg) {
    if (cfg.polarity === 'quit') return bucket && bucket.checkIns > 0 ? 0 : 1;
    const progress = bucket ? bucket.progress : 0;
    return Math.min(1, progress / cfg.goal);
}

// Walks every period from the habit's start up to the current one and returns
// streaks, the strength score (0-100) and the current period's progress.
function evaluate(task, entries, options = {}) {
    const cfg = normalizeConfig(task, options);
    const todayKey = toDayKey(options.now || new Date(), cfg.timezone);
    const currentStart = periodStart(todayKey, cfg);
    const buckets = bucketEntries(entries, cfg);

    const checkIns = entries.filter((e) => !e.skipped);
    let firstKey = cfg.anchorKey;
    for (const entry of entries) {
        const key = toDayKey(entry.completed_at, cfg.timezone);
        if (key < firstKey) firstKey = key;
    }
    if (firstKey > todayKey) firstKey = todayKey;

    const statuses = [];
    let strength = 0;
    let cursor = periodStart(firstKey, cfg);
    while (cursor <= currentStart) {
        const isCurrent = cursor === currentStart;
        const bucket = buckets.get(cursor);
        const status = periodStatus(cursor, bucket, cfg, isCurrent);
        statuses.push({
            start: cursor,
            status,
            progress: bucket ? bucket.progress : 0,
        });

        if (status === 'success' || status === 'fail') {
            const multiplier = Math.pow(
                0.5,
                Math.sqrt(periodLengthDays(cursor, cfg)) / STRENGTH_HALF_LIFE
            );
            strength =
                strength * multiplier +
                periodFraction(bucket, cfg) * (1 - multiplier);
        }
        cursor = nextPeriodStart(cursor, cfg);
    }

    let currentStreak = 0;
    for (let i = statuses.length - 1; i >= 0; i--) {
        if (statuses[i].status === 'fail') break;
        if (statuses[i].status === 'success') currentStreak++;
    }

    let bestStreak = 0;
    let run = 0;
    for (const { status } of statuses) {
        if (status === 'fail') run = 0;
        else if (status === 'success') run++;
        bestStreak = Math.max(bestStreak, run);
    }

    let lastCompletionAt = null;
    for (const entry of checkIns) {
        const at = new Date(entry.completed_at);
        if (!lastCompletionAt || at > lastCompletionAt) lastCompletionAt = at;
    }

    const currentBucket = buckets.get(currentStart);
    const todayCheckIns = checkIns.filter(
        (e) => toDayKey(e.completed_at, cfg.timezone) === todayKey
    ).length;
    const currentStatus = statuses[statuses.length - 1].status;

    return {
        currentStreak,
        bestStreak,
        strength: Math.round(strength * 1000) / 10,
        totalCompletions: checkIns.length,
        lastCompletionAt,
        periods: statuses,
        progress: {
            period_start: currentStart,
            period_end: periodEnd(currentStart, cfg),
            today: todayKey,
            first_day: firstKey,
            progress: currentBucket ? currentBucket.progress : 0,
            check_ins: currentBucket ? currentBucket.checkIns : 0,
            today_check_ins: todayCheckIns,
            goal: cfg.goal,
            met: currentStatus === 'success',
            skipped: !!(currentBucket && currentBucket.skipped),
            scheduled_today: isScheduledDay(todayKey, cfg),
            multiple_per_day: allowsMultiplePerDay(cfg),
        },
    };
}

// Whether a build habit still asks for a check-in on a day: the day is
// scheduled and not skipped, the period goal is not met yet, and, unless
// several check-ins a day count, the day has no check-in. Quit habits are
// avoided rather than done, so they never ask.
function isDueOn(task, entries, dayKey, options = {}) {
    const cfg = normalizeConfig(task, options);
    if (cfg.polarity === 'quit' || !isScheduledDay(dayKey, cfg)) return false;

    const start = periodStart(dayKey, cfg);
    const multiple = allowsMultiplePerDay(cfg);
    let progress = 0;
    for (const entry of entries) {
        const key = toDayKey(entry.completed_at, cfg.timezone);
        if (entry.skipped) {
            if (key === dayKey) return false;
            continue;
        }
        if (key === dayKey && !multiple) return false;
        if (periodStart(key, cfg) === start) {
            progress += entryAmount(entry, cfg);
        }
    }
    return progress < cfg.goal;
}

module.exports = {
    PERIODS,
    toDayKey,
    addDays,
    normalizeConfig,
    periodStart,
    periodEnd,
    nextPeriodStart,
    allowsMultiplePerDay,
    isScheduledDay,
    isDueOn,
    evaluate,
};
