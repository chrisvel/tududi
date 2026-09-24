import { isTaskDone } from '../../constants/taskStatus';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import { DailyPlanItem } from '../../utils/dailyPlanService';

export const DURATION_OPTIONS = [15, 30, 60, 120];
export const DEFAULT_DURATION = 30;
export const SLOT_MINUTES = 15;
export const DEFAULT_DAY_START = 8 * 60;
export const DEFAULT_DAY_END = 18 * 60;
const MINUTES_PER_DAY = 24 * 60;

export const formatMinute = (minute: number): string => {
    const clamped = Math.max(0, Math.min(MINUTES_PER_DAY, minute));
    const hours = Math.floor(clamped / 60);
    const minutes = clamped % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export const snapToSlot = (minute: number): number =>
    Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES;

// Minutes since local midnight in the given IANA zone.
export const minuteOfDay = (now: Date, timezone?: string): number => {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZone: timezone,
        }).formatToParts(now);
        const hour = Number(parts.find((p) => p.type === 'hour')?.value);
        const minute = Number(parts.find((p) => p.type === 'minute')?.value);
        return hour * 60 + minute;
    } catch {
        return now.getHours() * 60 + now.getMinutes();
    }
};

export const itemEnd = (item: DailyPlanItem): number =>
    (item.start_minute ?? 0) + item.duration_minutes;

export const isItemDone = (item: DailyPlanItem): boolean =>
    isTaskDone(item.task?.status);

// The visible range of the timeline: 08:00-18:00, widened to whole hours
// around anything planned or on the calendar outside it.
export const dayRange = (
    items: DailyPlanItem[],
    events: CalendarEvent[]
): { start: number; end: number } => {
    let start = DEFAULT_DAY_START;
    let end = DEFAULT_DAY_END;
    for (const item of items) {
        if (item.start_minute === null) continue;
        start = Math.min(start, item.start_minute);
        end = Math.max(end, itemEnd(item));
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
};

// Busy time from meetings inside the range, overlapping events merged.
export const busyMinutes = (
    events: CalendarEvent[],
    range: { start: number; end: number }
): number => {
    const spans = events
        .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
        .map((e) => [
            Math.max(range.start, e.start_minute as number),
            Math.min(range.end, e.end_minute ?? (e.start_minute as number)),
        ])
        .filter(([s, e]) => e > s)
        .sort((a, b) => a[0] - b[0]);
    let total = 0;
    let cursorStart = -1;
    let cursorEnd = -1;
    for (const [s, e] of spans) {
        if (s > cursorEnd) {
            if (cursorEnd > cursorStart) total += cursorEnd - cursorStart;
            cursorStart = s;
            cursorEnd = e;
        } else {
            cursorEnd = Math.max(cursorEnd, e);
        }
    }
    if (cursorEnd > cursorStart) total += cursorEnd - cursorStart;
    return total;
};

export const plannedMinutes = (items: DailyPlanItem[]): number =>
    items.reduce((sum, item) => sum + item.duration_minutes, 0);

export const overlapsItems = (
    items: DailyPlanItem[],
    start: number,
    duration: number,
    ignoreUid?: string
): boolean =>
    items.some(
        (item) =>
            item.task_uid !== ignoreUid &&
            item.start_minute !== null &&
            start < itemEnd(item) &&
            item.start_minute < start + duration
    );

// The first gap that fits `duration`, avoiding planned tasks and busy
// meetings, starting no earlier than `from`. Null when the day is full.
export const findFreeSlot = (
    items: DailyPlanItem[],
    events: CalendarEvent[],
    duration: number,
    range: { start: number; end: number },
    from: number
): number | null => {
    const blocked = [
        ...items
            .filter((item) => item.start_minute !== null)
            .map((item) => [item.start_minute as number, itemEnd(item)]),
        ...events
            .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
            .map((e) => [
                e.start_minute as number,
                e.end_minute ?? (e.start_minute as number),
            ]),
    ];
    let candidate = Math.max(
        range.start,
        Math.ceil(from / SLOT_MINUTES) * SLOT_MINUTES
    );
    while (candidate + duration <= range.end) {
        const clash = blocked.find(
            ([s, e]) => candidate < e && s < candidate + duration
        );
        if (!clash) return candidate;
        candidate = Math.ceil(clash[1] / SLOT_MINUTES) * SLOT_MINUTES;
    }
    return null;
};

// Gaps of at least `minLength` minutes with nothing planned and no busy
// meeting, used to hint where tasks can go.
export const freeGaps = (
    items: DailyPlanItem[],
    events: CalendarEvent[],
    range: { start: number; end: number },
    minLength = 30
): { start: number; end: number }[] => {
    const blocked = [
        ...items
            .filter((item) => item.start_minute !== null)
            .map((item) => [item.start_minute as number, itemEnd(item)]),
        ...events
            .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
            .map((e) => [
                e.start_minute as number,
                e.end_minute ?? (e.start_minute as number),
            ]),
    ].sort((a, b) => a[0] - b[0]);
    const gaps: { start: number; end: number }[] = [];
    let cursor = range.start;
    for (const [s, e] of blocked) {
        if (s - cursor >= minLength) gaps.push({ start: cursor, end: s });
        cursor = Math.max(cursor, e);
    }
    if (range.end - cursor >= minLength) {
        gaps.push({ start: cursor, end: range.end });
    }
    return gaps;
};

export type AgendaEntry =
    | { kind: 'task'; start: number | null; item: DailyPlanItem }
    | { kind: 'event'; start: number; event: CalendarEvent };

// Tasks and meetings in time order; tasks without a slot follow at the end
// in the order they were planned.
export const buildAgenda = (
    items: DailyPlanItem[],
    events: CalendarEvent[]
): AgendaEntry[] => {
    const timed: AgendaEntry[] = [
        ...items
            .filter((item) => item.start_minute !== null)
            .map((item) => ({
                kind: 'task' as const,
                start: item.start_minute as number,
                item,
            })),
        ...events
            .filter((e) => !e.all_day && e.start_minute !== null)
            .map((event) => ({
                kind: 'event' as const,
                start: event.start_minute as number,
                event,
            })),
    ].sort((a, b) => (a.start as number) - (b.start as number));
    const untimed: AgendaEntry[] = items
        .filter((item) => item.start_minute === null)
        .map((item) => ({ kind: 'task' as const, start: null, item }));
    return [...timed, ...untimed];
};

// What the "Now" card shows: the block running right now, else the next
// planned block, else the first unfinished task without a time.
export const pickCurrentItem = (
    items: DailyPlanItem[],
    now: number
): { item: DailyPlanItem; state: 'now' | 'next' | 'anytime' } | null => {
    const open = items.filter((item) => !isItemDone(item));
    const running = open.find(
        (item) =>
            item.start_minute !== null &&
            item.start_minute <= now &&
            now < itemEnd(item)
    );
    if (running) return { item: running, state: 'now' };
    const upcoming = open
        .filter((item) => item.start_minute !== null && item.start_minute > now)
        .sort(
            (a, b) => (a.start_minute as number) - (b.start_minute as number)
        )[0];
    if (upcoming) return { item: upcoming, state: 'next' };
    const anytime = open.find((item) => item.start_minute === null);
    if (anytime) return { item: anytime, state: 'anytime' };
    const late = open.find((item) => item.start_minute !== null);
    return late ? { item: late, state: 'anytime' } : null;
};

// A soft tint of a calendar's colour (#rrggbb) for event backgrounds.
export const tint = (
    color: string | null | undefined,
    alpha: number
): string | undefined => {
    const match = color ? /^#([0-9a-f]{6})$/i.exec(color) : null;
    if (!match) return undefined;
    const value = parseInt(match[1], 16);
    return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};
