import { Task } from '../../entities/Task';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import {
    SLOT_MINUTES,
    busyMinutes,
    findFreeSlot,
    freeGaps,
    isItemDone,
    itemEnd,
    plannedMinutes,
} from './planUtils';

// Tips are worked out locally from the plan, the calendar and the candidate
// list: instant and free. Each one is data; the component words it.
export type PlanTip =
    | { kind: 'missed'; count: number }
    | { kind: 'overbooked'; planned: number; free: number }
    | {
          kind: 'gapFit';
          start: number;
          gapMinutes: number;
          task: Task;
          duration: number;
      }
    | { kind: 'noBreak'; start: number; end: number };

const MAX_TIPS = 3;
const LONG_STRETCH = 3 * 60;
const SHORT_BREAK = 10;

export const lateItems = (items: DailyPlanItem[], now: number) =>
    items.filter(
        (item) =>
            item.start_minute !== null &&
            itemEnd(item) <= now &&
            !isItemDone(item)
    );

// Busy stretches (planned tasks and busy meetings) with no real break.
const longestStretch = (
    items: DailyPlanItem[],
    events: CalendarEvent[],
    now: number
): { start: number; end: number } | null => {
    const spans = [
        ...items
            .filter((i) => i.start_minute !== null && !isItemDone(i))
            .map((i) => [i.start_minute as number, itemEnd(i)]),
        ...events
            .filter((e) => !e.all_day && e.busy && e.start_minute !== null)
            .map((e) => [
                e.start_minute as number,
                e.end_minute ?? (e.start_minute as number),
            ]),
    ]
        .filter(([, end]) => end > now)
        .sort((a, b) => a[0] - b[0]);

    let best: { start: number; end: number } | null = null;
    let current: { start: number; end: number } | null = null;
    for (const [s, e] of spans) {
        if (current && s - current.end < SHORT_BREAK) {
            current.end = Math.max(current.end, e);
        } else {
            current = { start: s, end: e };
        }
        if (current.end - current.start >= LONG_STRETCH) {
            if (!best || current.end - current.start > best.end - best.start) {
                best = { ...current };
            }
        }
    }
    return best;
};

interface TipInput {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    candidates: Task[];
    range: { start: number; end: number };
    now: number;
    durationFor: (task: Task) => number;
    include?: PlanTip['kind'][];
}

export const buildTips = ({
    items,
    events,
    candidates,
    range,
    now,
    durationFor,
    include,
}: TipInput): PlanTip[] => {
    const wanted = (kind: PlanTip['kind']) =>
        !include || include.includes(kind);
    const tips: PlanTip[] = [];

    const late = lateItems(items, now);
    if (wanted('missed') && late.length > 0) {
        tips.push({ kind: 'missed', count: late.length });
    }

    const free = Math.max(
        0,
        range.end - range.start - busyMinutes(events, range)
    );
    const planned = plannedMinutes(items);
    if (wanted('overbooked') && planned > free && free > 0) {
        tips.push({ kind: 'overbooked', planned, free });
    }

    if (wanted('gapFit')) {
        const plannedUids = new Set(items.map((i) => i.task_uid));
        const open = candidates.filter(
            (task) => task.uid && !plannedUids.has(task.uid)
        );
        const used = new Set<string>();
        const from = Math.max(now, range.start);
        const gaps = freeGaps(items, events, range, SLOT_MINUTES).filter(
            (gap) => gap.end > from
        );
        for (const gap of gaps) {
            const start =
                Math.ceil(Math.max(gap.start, from) / SLOT_MINUTES) *
                SLOT_MINUTES;
            const length = gap.end - start;
            if (length < SLOT_MINUTES) continue;
            const fit = open.find(
                (task) =>
                    !used.has(task.uid as string) && durationFor(task) <= length
            );
            if (!fit) continue;
            used.add(fit.uid as string);
            tips.push({
                kind: 'gapFit',
                start,
                gapMinutes: length,
                task: fit,
                duration: durationFor(fit),
            });
            if (tips.filter((t) => t.kind === 'gapFit').length >= 2) break;
        }
    }

    if (wanted('noBreak')) {
        const stretch = longestStretch(items, events, now);
        if (stretch) tips.push({ kind: 'noBreak', ...stretch });
    }

    return tips.slice(0, MAX_TIPS);
};

// Moves every missed block to the next free slot after now, one after the
// other; a block with no room left keeps its place in the list, untimed.
export const rescheduleMissed = (
    items: DailyPlanItem[],
    events: CalendarEvent[],
    range: { start: number; end: number },
    now: number
): DailyPlanItem[] => {
    const late = new Set(lateItems(items, now).map((i) => i.task_uid));
    let next = items.map((item) =>
        late.has(item.task_uid) ? { ...item, start_minute: null } : item
    );
    for (const uid of late) {
        const item = next.find((i) => i.task_uid === uid) as DailyPlanItem;
        const others = next.filter((i) => i.task_uid !== uid);
        const start = findFreeSlot(
            others,
            events,
            item.duration_minutes,
            { start: range.start, end: Math.max(range.end, 22 * 60) },
            now
        );
        next = next.map((i) =>
            i.task_uid === uid ? { ...i, start_minute: start } : i
        );
    }
    return next;
};
