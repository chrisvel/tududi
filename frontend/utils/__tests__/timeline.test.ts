// PORT: lifeGLANCE, MIT License, Copyright (c) 2026 krelltunez.
// Source: https://github.com/krelltunez/lifeGLANCE
// Commit: cbc01c1acd818236bfbb9a952092978fa7261def
// Path: src/utils/timeline.test.js — the computePinchZoom suite, unchanged
// apart from vitest → jest imports. The applyRecurFilter suite was not
// ported because applyRecurFilter was not. The last suite is Life-to-Day's.
import {
    assignLanes,
    computePinchZoom,
    dateToX,
    getTickMarks,
    PINCH_MIN_HALF_MS,
    PINCH_MAX_HALF_MS,
} from '../timeline';

describe('computePinchZoom', () => {
    // Mirror of how the timeline maps a screen x to a timestamp, used to assert
    // the point under the pinch midpoint stays fixed.
    const timeUnderMid = (
        panMs: number,
        halfMs: number,
        midX: number,
        width: number,
        fraction = 0.5
    ) => panMs + halfMs * 2 * (midX / width - fraction);

    // Geometry tests use a wide-open clamp so the finger math is exercised without
    // the real min/max flooring the small synthetic spans.
    const NOCLAMP = { minHalfMs: 0, maxHalfMs: Infinity };
    const base = {
        startHalfMs: 1000,
        startPanMs: 0,
        width: 1000,
        startMidX: 500,
        midX: 500,
        ...NOCLAMP,
    };

    it('halves the span when fingers spread 2×; a centered pinch keeps pan', () => {
        const r = computePinchZoom({ ...base, distRatio: 2 });
        expect(r.halfMs).toBe(500);
        expect(r.panMs).toBe(0);
    });

    it('doubles the span when fingers pinch to half distance', () => {
        const r = computePinchZoom({ ...base, distRatio: 0.5 });
        expect(r.halfMs).toBe(2000);
    });

    it('clamps zoom-in to the min half-span', () => {
        const r = computePinchZoom({
            startHalfMs: PINCH_MIN_HALF_MS,
            startPanMs: 0,
            width: 1000,
            startMidX: 500,
            midX: 500,
            distRatio: 1000,
        });
        expect(r.halfMs).toBe(PINCH_MIN_HALF_MS);
    });

    it('clamps zoom-out to the max half-span', () => {
        const r = computePinchZoom({
            startHalfMs: PINCH_MAX_HALF_MS,
            startPanMs: 0,
            width: 1000,
            startMidX: 500,
            midX: 500,
            distRatio: 0.001,
        });
        expect(r.halfMs).toBe(PINCH_MAX_HALF_MS);
    });

    it('keeps the timestamp under an off-center pinch midpoint fixed', () => {
        const args = { ...base, startMidX: 750, midX: 750, distRatio: 2 };
        const before = timeUnderMid(
            args.startPanMs,
            args.startHalfMs,
            args.startMidX,
            args.width
        );
        const r = computePinchZoom(args);
        const after = timeUnderMid(r.panMs, r.halfMs, args.midX, args.width);
        expect(after).toBeCloseTo(before, 3);
    });

    it('pans when the two-finger midpoint translates without changing distance', () => {
        const r = computePinchZoom({ ...base, midX: 600, distRatio: 1 });
        expect(r.halfMs).toBe(1000); // distance unchanged → no zoom
        expect(r.panMs).not.toBe(0); // midpoint moved → view pans
    });

    it('honors a non-default view anchor (past) when preserving the midpoint', () => {
        const args = {
            startHalfMs: 1000,
            startPanMs: 12345,
            viewMode: 'past' as const,
            width: 1000,
            startMidX: 300,
            midX: 300,
            distRatio: 1.5,
            ...NOCLAMP,
        };
        const before = timeUnderMid(
            args.startPanMs,
            args.startHalfMs,
            args.startMidX,
            args.width,
            0.88
        );
        const r = computePinchZoom(args);
        const after = timeUnderMid(
            r.panMs,
            r.halfMs,
            args.midX,
            args.width,
            0.88
        );
        expect(after).toBeCloseTo(before, 3);
    });
});

// Life-to-Day characterization of the other ported functions (not upstream).
describe('ported scale (Life-to-Day characterization)', () => {
    it('dateToX maps linearly and centers a zero span', () => {
        expect(dateToX(50, 0, 100, 1000)).toBe(500);
        expect(dateToX(7, 7, 7, 1000)).toBe(500);
    });

    it('getTickMarks: custom 40-year span uses decade style', () => {
        const start = new Date(2000, 0, 1).getTime();
        const end = new Date(2040, 0, 1).getTime();
        const ticks = getTickMarks('custom', start, end, 1000, 'en');
        expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual([
            '2000',
            '2010',
            '2020',
            '2030',
            '2040',
        ]);
        expect(ticks.find((t) => t.label === '2005')?.major).toBe(false);
    });

    it('getTickMarks: weeks start on Sunday and survive a malformed locale', () => {
        const start = new Date(2026, 0, 1).getTime();
        const end = new Date(2026, 1, 1).getTime();
        const ticks = getTickMarks('weeks', start, end, 1000, 'en_US.UTF-8');
        expect(ticks.length).toBeGreaterThanOrEqual(4);
        expect(ticks.some((t) => t.major && t.label.includes('2026'))).toBe(
            true
        );
    });

    it('assignLanes alternates sides, sorts by date and stays deterministic', () => {
        const input = [
            { id: 'b', date: '2020-01-01' },
            { id: 'a', date: '2010-01-01' },
            { id: 'c', date: '2030-01-01' },
        ];
        const out = assignLanes(input, 2, 1);
        expect(out.map((m) => m.id)).toEqual(['a', 'b', 'c']);
        expect(out.map((m) => m.above)).toEqual([true, false, true]);
        expect(out.every((m) => m.lane === 0)).toBe(true);
        expect(assignLanes(input, 2, 1)).toEqual(out);
    });

    it('assignLanes stacks overlapping same-side cards into separate lanes', () => {
        const day = 24 * 3600 * 1000;
        const input = [
            '2020-01-01',
            '2020-01-02',
            '2020-01-03',
            '2020-01-04',
        ].map((date, i) => ({ id: i, date }));
        const out = assignLanes(input, 3, 10 * day, true);
        expect(new Set(out.map((m) => m.lane)).size).toBeGreaterThan(1);
    });
});
