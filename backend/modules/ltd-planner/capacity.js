'use strict';

// Life-to-Day (T-501): the deterministic capacity model of blueprint 14.5.
// Pure functions only (ADR-006): no LLM, no storage, load is never saved.

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_WINDOW = Object.freeze({ start: 9 * 60, end: 17 * 60 });
const BUFFER_MINUTES = 5;
const DEFAULT_FACTOR = 1.3;
const FACTOR_SAMPLE = 30;
const FACTOR_MIN = 1.0;
const FACTOR_MAX = 2.0;
const UNREALISTIC_LOAD = 0.85;
const RECOVERY_SHARE = 0.6;

const clampMinute = (m) => Math.min(MINUTES_PER_DAY, Math.max(0, m));

// Busy minutes of timed, busy calendar events inside [start, end). All-day
// and free (transparent) events never count; overlapping events count once.
function busyMinutes(events, start, end) {
    const spans = (events || [])
        .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
        .map((e) => [
            Math.max(start, clampMinute(e.start_minute)),
            Math.min(end, clampMinute(e.end_minute ?? e.start_minute)),
        ])
        .filter(([s, e]) => e > s)
        .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let cursor = start;
    for (const [s, e] of spans) {
        const from = Math.max(s, cursor);
        if (e > from) total += e - from;
        cursor = Math.max(cursor, e);
    }
    return total;
}

// f = median(actual / planned) over the last 30 finished sessions, clamped
// to [1, 2]. Until 30 exist the default 1.3 holds (A-10).
function planningFactor(sessions) {
    const ratios = (sessions || [])
        .filter((s) => s.planned_minutes > 0 && s.actual_minutes != null)
        .slice(0, FACTOR_SAMPLE)
        .map((s) => s.actual_minutes / s.planned_minutes);
    if (ratios.length < FACTOR_SAMPLE) return DEFAULT_FACTOR;
    ratios.sort((a, b) => a - b);
    const mid = ratios.length / 2;
    const median =
        ratios.length % 2
            ? ratios[Math.floor(mid)]
            : (ratios[mid - 1] + ratios[mid]) / 2;
    return Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, median));
}

const round2 = (n) => Math.round(n * 100) / 100;

// items: [{ task_uid, duration_minutes, start_minute, priority, done }]
function computeCapacity({
    window = DEFAULT_WINDOW,
    events = [],
    items = [],
    factor = DEFAULT_FACTOR,
    bufferMinutes = BUFFER_MINUTES,
}) {
    const windowMinutes = Math.max(0, window.end - window.start);
    const busy = busyMinutes(events, window.start, window.end);
    const open = items.filter((item) => !item.done);
    const buffers = open.length * bufferMinutes;
    const capacity = Math.max(0, windowMinutes - busy - buffers);
    const plannedMinutes = open.reduce(
        (sum, item) => sum + (item.duration_minutes || 0),
        0
    );
    const demand = plannedMinutes * factor;
    // No capacity with work left is over capacity, never a division by zero.
    const load =
        capacity > 0 ? round2(demand / capacity) : demand > 0 ? null : 0;
    const unrealistic = load === null || load > UNREALISTIC_LOAD;
    return {
        window,
        window_minutes: windowMinutes,
        busy_minutes: busy,
        buffer_minutes: buffers,
        capacity_minutes: capacity,
        planned_minutes: plannedMinutes,
        factor,
        load,
        unrealistic,
        move_suggestions: unrealistic
            ? suggestMoves(open, factor, capacity)
            : [],
    };
}

// Lowest priority first, then the latest in the list, until the rest fits
// under the threshold.
function suggestMoves(open, factor, capacity) {
    const ranked = open
        .map((item, index) => ({ item, index }))
        .sort(
            (a, b) =>
                (a.item.priority ?? 0) - (b.item.priority ?? 0) ||
                b.index - a.index
        );
    let demand =
        open.reduce((s, i) => s + (i.duration_minutes || 0), 0) * factor;
    const moves = [];
    for (const { item } of ranked) {
        if (capacity > 0 && demand / capacity <= UNREALISTIC_LOAD) break;
        moves.push(item.task_uid);
        demand -= (item.duration_minutes || 0) * factor;
    }
    return moves;
}

// Recovery: capacity_rest = 0.6 x the rest of the working day after now.
function recoveryCapacity({ window = DEFAULT_WINDOW, events = [], now }) {
    const from = Math.min(window.end, Math.max(window.start, now));
    const rest = window.end - from - busyMinutes(events, from, window.end);
    return Math.max(0, Math.floor(RECOVERY_SHARE * rest));
}

// Timed blocks that overlap a busy calendar event, and neighbours closer
// than the buffer. Without events there is nothing to warn about.
function blockWarnings(items, events, bufferMinutes = BUFFER_MINUTES) {
    const timed = items
        .filter((i) => i.start_minute !== null && i.start_minute !== undefined)
        .map((i) => ({
            uid: i.task_uid,
            start: i.start_minute,
            end: i.start_minute + (i.duration_minutes || 0),
        }))
        .sort((a, b) => a.start - b.start);
    const busy = (events || []).filter(
        (e) => !e.all_day && e.busy && e.start_minute !== null
    );
    const overlaps = timed
        .filter((b) =>
            busy.some(
                (e) =>
                    b.start < (e.end_minute ?? e.start_minute) &&
                    e.start_minute < b.end
            )
        )
        .map((b) => b.uid);
    const tight = [];
    for (let i = 1; i < timed.length; i++) {
        if (timed[i].start - timed[i - 1].end < bufferMinutes) {
            tight.push(timed[i].uid);
        }
    }
    return { event_overlaps: overlaps, missing_buffer: tight };
}

module.exports = {
    DEFAULT_WINDOW,
    BUFFER_MINUTES,
    DEFAULT_FACTOR,
    FACTOR_SAMPLE,
    UNREALISTIC_LOAD,
    RECOVERY_SHARE,
    busyMinutes,
    planningFactor,
    computeCapacity,
    recoveryCapacity,
    blockWarnings,
};
