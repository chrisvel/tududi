import {
    buildAgenda,
    busyMinutes,
    dayRange,
    findFreeSlot,
    formatDuration,
    formatMinute,
    freeGaps,
    pickCurrentItem,
} from '../planUtils';
import { DailyPlanItem } from '../../../utils/dailyPlanService';
import { CalendarEvent } from '../../../utils/calendarFeedsService';

const item = (
    uid: string,
    start: number | null,
    duration = 30,
    status = 0
): DailyPlanItem => ({
    task_uid: uid,
    position: 0,
    start_minute: start,
    duration_minutes: duration,
    task: { uid, name: uid, status, completed_at: null },
});

const event = (
    title: string,
    start: number,
    end: number,
    extra: Partial<CalendarEvent> = {}
): CalendarEvent => ({
    uid: title,
    title,
    all_day: false,
    busy: true,
    start: '',
    end: '',
    start_minute: start,
    end_minute: end,
    feed_uid: 'f',
    feed_name: 'Google',
    color: null,
    ...extra,
});

describe('formatting', () => {
    it('formats minutes and durations', () => {
        expect(formatMinute(8 * 60 + 5)).toBe('08:05');
        expect(formatDuration(45)).toBe('45m');
        expect(formatDuration(60)).toBe('1h');
        expect(formatDuration(90)).toBe('1h 30m');
    });
});

describe('dayRange', () => {
    it('defaults to 08:00-18:00 and widens to whole hours', () => {
        expect(dayRange([], [])).toEqual({ start: 480, end: 1080 });
        expect(
            dayRange([item('a', 7 * 60 + 30)], [event('late', 1140, 1170)])
        ).toEqual({ start: 420, end: 1200 });
    });
});

describe('busyMinutes', () => {
    it('merges overlapping meetings and ignores free or all-day ones', () => {
        const events = [
            event('a', 540, 600),
            event('b', 570, 630),
            event('free', 700, 760, { busy: false }),
            event('holiday', 0, 0, { all_day: true, start_minute: null }),
        ];
        expect(busyMinutes(events, { start: 480, end: 1080 })).toBe(90);
    });
});

describe('findFreeSlot', () => {
    const range = { start: 480, end: 1080 };

    it('skips meetings and planned tasks', () => {
        const items = [item('a', 480, 60)];
        const events = [event('standup', 540, 570)];
        expect(findFreeSlot(items, events, 30, range, 480)).toBe(570);
    });

    it('starts from the given minute, rounded up to the grid', () => {
        expect(findFreeSlot([], [], 30, range, 601)).toBe(615);
    });

    it('returns null when nothing fits', () => {
        const items = [item('a', 480, 600)];
        expect(findFreeSlot(items, [], 30, range, 480)).toBeNull();
    });
});

describe('freeGaps', () => {
    it('lists gaps of at least 30 minutes', () => {
        const gaps = freeGaps(
            [item('a', 480, 60)],
            [event('call', 660, 690)],
            { start: 480, end: 720 }
        );
        expect(gaps).toEqual([
            { start: 540, end: 660 },
            { start: 690, end: 720 },
        ]);
    });
});

describe('pickCurrentItem', () => {
    it('prefers the running block, then the next one, then untimed tasks', () => {
        const items = [
            item('done', 480, 60, 2),
            item('running', 600, 60),
            item('later', 780, 30),
            item('anytime', null),
        ];
        expect(pickCurrentItem(items, 620)).toMatchObject({
            state: 'now',
            item: { task_uid: 'running' },
        });
        expect(pickCurrentItem(items, 700)).toMatchObject({
            state: 'next',
            item: { task_uid: 'later' },
        });
        expect(pickCurrentItem(items, 900)).toMatchObject({
            state: 'anytime',
            item: { task_uid: 'anytime' },
        });
        expect(pickCurrentItem([item('x', 480, 30, 2)], 600)).toBeNull();
    });
});

describe('buildAgenda', () => {
    it('merges tasks and meetings by time and keeps untimed tasks last', () => {
        const agenda = buildAgenda(
            [item('b', 600), item('c', null), item('a', 480)],
            [event('call', 540, 570)]
        );
        expect(
            agenda.map((entry) =>
                entry.kind === 'task' ? entry.item.task_uid : entry.event.title
            )
        ).toEqual(['a', 'call', 'b', 'c']);
    });
});
