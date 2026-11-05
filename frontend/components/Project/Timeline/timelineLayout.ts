import { Task } from '../../../entities/Task';
import { isTaskDone } from '../../../constants/taskStatus';

export interface TaskLink {
    from_uid: string;
    to_uid: string;
}

export interface TimelineItem {
    task: Task;
    // Day numbers (days since 1970-01-01, local calendar days)
    start: number | null;
    due: number | null;
    // First and last day the bar covers
    from: number;
    to: number;
    kind: 'range' | 'due' | 'start';
    done: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar day number for a YYYY-MM-DD string (or an ISO value's date part).
export const toDay = (value: string | null | undefined): number | null => {
    if (!value) return null;
    const [y, m, d] = String(value).split('T')[0].split('-').map(Number);
    if (!y || !m || !d) return null;
    return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
};

export const fromDay = (day: number): string => {
    const date = new Date(day * DAY_MS);
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const todayDay = (now: Date = new Date()): number =>
    Math.round(
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS
    );

// Weekday (0 = Sunday) of a day number.
export const weekdayOf = (day: number): number =>
    new Date(day * DAY_MS).getUTCDay();

export const dateOf = (day: number): Date => {
    const date = new Date(day * DAY_MS);
    return new Date(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate()
    );
};

// Splits tasks into ones with a start or due date (sorted by when they
// begin) and ones without any date.
export const buildItems = (
    tasks: Task[]
): { items: TimelineItem[]; undated: Task[] } => {
    const items: TimelineItem[] = [];
    const undated: Task[] = [];

    tasks.forEach((task) => {
        const start = toDay(task.start_date);
        const due = toDay(task.due_date);
        const done = isTaskDone(task.status);
        if (start === null && due === null) {
            undated.push(task);
            return;
        }
        if (start !== null && due !== null) {
            items.push({
                task,
                start,
                due,
                from: Math.min(start, due),
                to: Math.max(start, due),
                kind: 'range',
                done,
            });
        } else if (due !== null) {
            items.push({
                task,
                start,
                due,
                from: due,
                to: due,
                kind: 'due',
                done,
            });
        } else {
            items.push({
                task,
                start,
                due,
                from: start as number,
                to: start as number,
                kind: 'start',
                done,
            });
        }
    });

    items.sort(
        (a, b) =>
            a.from - b.from ||
            a.to - b.to ||
            (a.task.name || '').localeCompare(b.task.name || '')
    );
    return { items, undated };
};

// First and last day shown: every bar, today and the project's own dates,
// with some room either side and at least `minDays` wide.
export const buildRange = (
    items: TimelineItem[],
    extraDays: (number | null)[],
    today: number,
    minDays = 35
): { first: number; last: number } => {
    const days = [today, ...extraDays.filter((d): d is number => d !== null)];
    items.forEach((item) => days.push(item.from, item.to));
    let first = Math.min(...days) - 3;
    let last = Math.max(...days) + 10;
    if (last - first + 1 < minDays) last = first + minDays - 1;
    // Start on a Monday so week labels line up
    while (weekdayOf(first) !== 1) first -= 1;
    return { first, last };
};

// The chain of blocking tasks that sets the finish: start from the dated
// task that ends last among linked tasks and keep stepping to the blocker
// that ends latest. Returns the uids on that chain.
export const findPath = (
    items: TimelineItem[],
    links: TaskLink[]
): Set<string> => {
    const byUid = new Map(items.map((item) => [item.task.uid, item]));
    const usable = links.filter(
        (link) => byUid.has(link.from_uid) && byUid.has(link.to_uid)
    );
    const path = new Set<string>();
    if (usable.length === 0) return path;

    const blockersOf = new Map<string, string[]>();
    usable.forEach((link) => {
        const list = blockersOf.get(link.to_uid) || [];
        list.push(link.from_uid);
        blockersOf.set(link.to_uid, list);
    });

    const linked = new Set<string>();
    usable.forEach((link) => {
        linked.add(link.from_uid);
        linked.add(link.to_uid);
    });

    let current: string | undefined;
    let latest = -Infinity;
    linked.forEach((uid) => {
        const item = byUid.get(uid)!;
        if (item.to > latest) {
            latest = item.to;
            current = uid;
        }
    });

    while (current && !path.has(current)) {
        path.add(current);
        const blockers = blockersOf.get(current) || [];
        let next: string | undefined;
        let nextEnd = -Infinity;
        blockers.forEach((uid) => {
            const item = byUid.get(uid)!;
            if (item.to > nextEnd) {
                nextEnd = item.to;
                next = uid;
            }
        });
        current = next;
    }
    return path;
};

// Days a task can slip before it holds up what it blocks (or the project's
// due date when it blocks nothing). Only open tasks off the path get one.
export const spareDays = (
    items: TimelineItem[],
    links: TaskLink[],
    path: Set<string>,
    projectDue: number | null
): Map<string, number> => {
    const byUid = new Map(items.map((item) => [item.task.uid, item]));
    const spare = new Map<string, number>();
    items.forEach((item) => {
        const uid = item.task.uid;
        if (!uid || item.done || path.has(uid)) return;
        const nextStarts = links
            .filter((link) => link.from_uid === uid && byUid.has(link.to_uid))
            .map((link) => byUid.get(link.to_uid)!.from);
        const limit = nextStarts.length
            ? Math.min(...nextStarts) - 1
            : projectDue;
        if (limit === null) return;
        const days = limit - item.to;
        if (days > 0) spare.set(uid, days);
    });
    return spare;
};

// New start/due after dragging a bar by `delta` days. `edge` picks which
// end moves; a plain move shifts both.
export const shiftDates = (
    item: TimelineItem,
    delta: number,
    edge: 'move' | 'start' | 'end'
): { start_date?: string; due_date?: string } => {
    if (item.kind === 'due') {
        return { due_date: fromDay((item.due as number) + delta) };
    }
    if (item.kind === 'start') {
        return { start_date: fromDay((item.start as number) + delta) };
    }
    const start = item.start as number;
    const due = item.due as number;
    if (edge === 'start') {
        return { start_date: fromDay(Math.min(start + delta, due)) };
    }
    if (edge === 'end') {
        return { due_date: fromDay(Math.max(due + delta, start)) };
    }
    return {
        start_date: fromDay(start + delta),
        due_date: fromDay(due + delta),
    };
};
