'use strict';

// Server-side twin of frontend/components/DailyPlan/planUtils.ts: the same
// grid and the same notion of "busy" so an AI draft lands where the planner
// would put it.

const SLOT_MINUTES = 15;
const DEFAULT_DAY_START = 8 * 60;
const DEFAULT_DAY_END = 18 * 60;
const MINUTES_PER_DAY = 24 * 60;

const snapUp = (minute) => Math.ceil(minute / SLOT_MINUTES) * SLOT_MINUTES;
const snap = (minute) => Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES;

// [start, end) spans taken by timed plan items and busy calendar events.
function blockedSpans(items, events) {
    return [
        ...items
            .filter((item) => item.start_minute !== null)
            .map((item) => [
                item.start_minute,
                item.start_minute + item.duration_minutes,
            ]),
        ...events
            .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
            .map((e) => [e.start_minute, e.end_minute ?? e.start_minute]),
    ].sort((a, b) => a[0] - b[0]);
}

function dayRange(items, events) {
    let start = DEFAULT_DAY_START;
    let end = DEFAULT_DAY_END;
    for (const item of items) {
        if (item.start_minute === null) continue;
        start = Math.min(start, item.start_minute);
        end = Math.max(end, item.start_minute + item.duration_minutes);
    }
    for (const event of events) {
        if (event.all_day || event.start_minute === null) continue;
        start = Math.min(start, event.start_minute);
        end = Math.max(end, event.end_minute ?? event.start_minute);
    }
    return {
        start: Math.floor(start / 60) * 60,
        end: Math.min(MINUTES_PER_DAY, Math.ceil(end / 60) * 60),
    };
}

function overlaps(spans, start, duration) {
    return spans.some(([s, e]) => start < e && s < start + duration);
}

function findFreeSlot(spans, duration, range, from) {
    let candidate = Math.max(range.start, snapUp(from));
    while (candidate + duration <= range.end) {
        const clash = spans.find(
            ([s, e]) => candidate < e && s < candidate + duration
        );
        if (!clash) return candidate;
        candidate = snapUp(clash[1]);
    }
    return null;
}

function freeGaps(spans, range, from, minLength = 15) {
    const gaps = [];
    let cursor = Math.max(range.start, snapUp(from));
    for (const [s, e] of spans) {
        if (s - cursor >= minLength) gaps.push({ start: cursor, end: s });
        cursor = Math.max(cursor, e);
    }
    if (range.end - cursor >= minLength) {
        gaps.push({ start: cursor, end: range.end });
    }
    return gaps;
}

module.exports = {
    SLOT_MINUTES,
    MINUTES_PER_DAY,
    snap,
    snapUp,
    blockedSpans,
    dayRange,
    overlaps,
    findFreeSlot,
    freeGaps,
};
