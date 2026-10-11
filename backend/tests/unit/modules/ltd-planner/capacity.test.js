'use strict';
const {
    busyMinutes,
    planningFactor,
    computeCapacity,
    recoveryCapacity,
    blockWarnings,
    DEFAULT_WINDOW,
} = require('../../../../modules/ltd-planner/capacity');

const event = (start, end, extra = {}) => ({
    all_day: false,
    busy: true,
    start_minute: start,
    end_minute: end,
    ...extra,
});
const item = (uid, minutes, extra = {}) => ({
    task_uid: uid,
    duration_minutes: minutes,
    start_minute: null,
    priority: 1,
    done: false,
    ...extra,
});
const sessions = (n, ratio) =>
    Array.from({ length: n }, () => ({
        planned_minutes: 20,
        actual_minutes: 20 * ratio,
    }));

describe('ltd-planner capacity (blueprint 14.5)', () => {
    it('defaults to a 09:00-17:00 window', () => {
        expect(DEFAULT_WINDOW).toEqual({ start: 540, end: 1020 });
        expect(computeCapacity({}).capacity_minutes).toBe(480);
    });

    it('capacity = window - busy - blocks x 5 minutes', () => {
        const result = computeCapacity({
            events: [event(600, 660)],
            items: [item('a', 30), item('b', 30), item('c', 30)],
        });
        expect(result.busy_minutes).toBe(60);
        expect(result.buffer_minutes).toBe(15);
        expect(result.capacity_minutes).toBe(480 - 60 - 15);
    });

    it('counts overlapping events once and clips them to the window', () => {
        expect(
            busyMinutes(
                [event(480, 600), event(570, 630), event(1000, 1100)],
                540,
                1020
            )
        ).toBe(90 + 20);
    });

    it('ignores all-day and free events', () => {
        const allDay = {
            all_day: true,
            busy: false,
            start_minute: null,
            end_minute: null,
        };
        expect(
            busyMinutes([allDay, event(600, 700, { busy: false })], 540, 1020)
        ).toBe(0);
    });

    it('handles a window ending at midnight with an event clipped there', () => {
        // icsEvents clips an event crossing midnight to end_minute 1440.
        const window = { start: 1200, end: 1440 };
        const result = computeCapacity({
            window,
            events: [event(1380, 1440)],
            items: [],
        });
        expect(result.busy_minutes).toBe(60);
        expect(result.capacity_minutes).toBe(180);
        // The next day's part starts at minute 0 and lies outside the window.
        expect(busyMinutes([event(0, 60)], 1200, 1440)).toBe(0);
    });

    it('excludes done items from load and buffers', () => {
        const result = computeCapacity({
            items: [item('a', 60, { done: true }), item('b', 60)],
        });
        expect(result.buffer_minutes).toBe(5);
        expect(result.planned_minutes).toBe(60);
    });

    describe('f', () => {
        it('is 1.3 until 30 finished sessions exist', () => {
            expect(planningFactor([])).toBe(1.3);
            expect(planningFactor(sessions(29, 1.8))).toBe(1.3);
        });
        it('uses the median of actual/planned from the 30th session', () => {
            expect(planningFactor(sessions(30, 1.5))).toBe(1.5);
            const mixed = [...sessions(15, 1.2), ...sessions(15, 1.6)];
            expect(planningFactor(mixed)).toBeCloseTo(1.4);
        });
        it('only reads the latest 30 sessions', () => {
            expect(
                planningFactor([...sessions(30, 1.1), ...sessions(30, 1.9)])
            ).toBeCloseTo(1.1);
        });
        it('clamps to [1.0, 2.0]', () => {
            expect(planningFactor(sessions(30, 0.5))).toBe(1);
            expect(planningFactor(sessions(30, 3))).toBe(2);
        });
    });

    describe('unrealistic warning', () => {
        it('F12: 4h capacity and 5h of tasks x 1.3 is over 85%', () => {
            // window 4h + 2 buffers so capacity is exactly 240 minutes.
            const result = computeCapacity({
                window: { start: 540, end: 540 + 240 + 10 },
                items: [
                    item('a', 150, { priority: 2 }),
                    item('b', 150, { priority: 0 }),
                ],
                factor: 1.3,
            });
            expect(result.capacity_minutes).toBe(240);
            expect(result.load).toBeCloseTo(1.63, 2);
            expect(result.unrealistic).toBe(true);
            expect(result.move_suggestions).toEqual(['b']);
        });
        it('85% exactly is not unrealistic, just above is', () => {
            const at = computeCapacity({
                window: { start: 0, end: 105 },
                items: [item('a', 85)],
                factor: 1,
            });
            expect(at.capacity_minutes).toBe(100);
            expect(at.load).toBe(0.85);
            expect(at.unrealistic).toBe(false);
            const over = computeCapacity({
                window: { start: 0, end: 105 },
                items: [item('a', 86)],
                factor: 1,
            });
            expect(over.unrealistic).toBe(true);
        });
        it('no capacity with work left is unrealistic, not a division by zero', () => {
            const result = computeCapacity({
                window: { start: 540, end: 600 },
                events: [event(540, 600)],
                items: [item('a', 30)],
            });
            expect(result.capacity_minutes).toBe(0);
            expect(result.load).toBeNull();
            expect(result.unrealistic).toBe(true);
        });
        it('an empty day has zero load', () => {
            expect(computeCapacity({ items: [] }).load).toBe(0);
        });
    });

    it('Recovery: capacity_rest is 60% of the rest of the day', () => {
        expect(recoveryCapacity({ now: 840 })).toBe(Math.floor(0.6 * 180));
        expect(recoveryCapacity({ now: 300 })).toBe(Math.floor(0.6 * 480));
        expect(recoveryCapacity({ now: 1100 })).toBe(0);
        expect(recoveryCapacity({ now: 840, events: [event(900, 960)] })).toBe(
            Math.floor(0.6 * 120)
        );
    });

    describe('block warnings', () => {
        const timed = [
            item('a', 30, { start_minute: 600 }),
            item('b', 30, { start_minute: 630 }),
            item('c', 30, { start_minute: 700 }),
        ];
        it('flags blocks without the 5-minute buffer', () => {
            expect(blockWarnings(timed, []).missing_buffer).toEqual(['b']);
        });
        it('flags overlap with an iCal event only when there is one', () => {
            expect(blockWarnings(timed, []).event_overlaps).toEqual([]);
            expect(
                blockWarnings(timed, [event(710, 740)]).event_overlaps
            ).toEqual(['c']);
            expect(
                blockWarnings(timed, [
                    { all_day: true, busy: false, start_minute: null },
                ]).event_overlaps
            ).toEqual([]);
        });
    });
});
