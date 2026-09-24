import { buildTips, rescheduleMissed } from '../tips';
import { DailyPlanItem } from '../../../utils/dailyPlanService';
import { CalendarEvent } from '../../../utils/calendarFeedsService';
import { Task } from '../../../entities/Task';

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

const event = (start: number, end: number): CalendarEvent => ({
    uid: `e${start}`,
    title: 'Meeting',
    all_day: false,
    busy: true,
    start: '',
    end: '',
    start_minute: start,
    end_minute: end,
    feed_uid: 'f',
    feed_name: 'Work',
    color: null,
});

const task = (uid: string, estimate?: number): Task => ({
    uid,
    name: uid,
    status: 0,
    completed_at: null,
    estimated_minutes: estimate,
});

const range = { start: 480, end: 1080 };
const durationFor = (t: Task) => t.estimated_minutes || 30;

describe('buildTips', () => {
    it('flags blocks whose time has passed', () => {
        const tips = buildTips({
            items: [item('a', 480), item('b', 510, 30, 2), item('c', 900)],
            events: [],
            candidates: [],
            range,
            now: 600,
            durationFor,
            include: ['missed'],
        });
        expect(tips).toEqual([{ kind: 'missed', count: 1 }]);
    });

    it('warns when more is planned than the free time', () => {
        const tips = buildTips({
            items: [item('a', null, 120), item('b', null, 120)],
            events: [event(480, 1020)],
            candidates: [],
            range,
            now: 480,
            durationFor,
            include: ['overbooked'],
        });
        expect(tips).toEqual([{ kind: 'overbooked', planned: 240, free: 60 }]);
    });

    it('suggests the first unplanned task that fits the next free gap', () => {
        const tips = buildTips({
            items: [item('planned', 480, 60)],
            events: [event(570, 1080)],
            candidates: [
                task('planned', 15),
                task('long', 60),
                task('short', 15),
            ],
            range,
            now: 480,
            durationFor,
            include: ['gapFit'],
        });
        expect(tips).toHaveLength(1);
        expect(tips[0]).toMatchObject({
            kind: 'gapFit',
            start: 540,
            gapMinutes: 30,
            duration: 15,
            task: { uid: 'short' },
        });
    });

    it('notices a long stretch without a break', () => {
        const tips = buildTips({
            items: [item('a', 780, 60), item('b', 845, 120)],
            events: [event(965, 1020)],
            candidates: [],
            range,
            now: 600,
            durationFor,
            include: ['noBreak'],
        });
        expect(tips).toEqual([{ kind: 'noBreak', start: 780, end: 1020 }]);
    });

    it('shows at most three tips', () => {
        const tips = buildTips({
            items: [item('late', 480, 60), item('x', null, 600)],
            events: [],
            candidates: [task('t1', 15), task('t2', 15), task('t3', 15)],
            range,
            now: 600,
            durationFor,
        });
        expect(tips.length).toBeLessThanOrEqual(3);
        expect(tips[0].kind).toBe('missed');
    });
});

describe('rescheduleMissed', () => {
    it('moves missed blocks to the next free slots after now', () => {
        const next = rescheduleMissed(
            [item('a', 480, 30), item('b', 510, 30), item('c', 660, 60)],
            [event(600, 630)],
            range,
            590
        );
        const starts = Object.fromEntries(
            next.map((i) => [i.task_uid, i.start_minute])
        );
        expect(starts).toEqual({ a: 630, b: 720, c: 660 });
    });
});
