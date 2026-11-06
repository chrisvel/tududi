import { toDay } from '../../Project/Timeline/timelineLayout';
import { RoadmapArea, RoadmapGoal } from '../../../utils/roadmapService';
import {
    allKeys,
    barPosition,
    buildRows,
    dayCenter,
    monthTicks,
    parseQuarter,
    percentOf,
    placeGoals,
    quarterBounds,
    quarterKey,
    quarterOfDay,
    shiftQuarter,
    weekTicks,
} from '../roadmapLayout';

const day = (value: string) => toDay(value) as number;
const q4 = quarterBounds({ year: 2026, quarter: 4 });

const goal = (uid: string, target_date: string): RoadmapGoal => ({
    uid,
    title: uid,
    target_date,
    status: 'active',
    area_uid: null,
});

const areas: RoadmapArea[] = [
    {
        uid: 'a1',
        name: 'DST',
        color: null,
        start: '2026-10-01',
        end: '2026-11-01',
        projects: [
            {
                uid: 'p1',
                name: 'BIM',
                status: 'in_progress',
                start: '2026-10-01',
                end: '2026-11-01',
                dated_from_tasks: true,
                task_count: 1,
                tasks: [
                    {
                        uid: 't1',
                        name: 'Review',
                        status: 0,
                        start_date: null,
                        due_date: '2026-11-01',
                        kind: 'due',
                    },
                ],
            },
        ],
    },
];

describe('quarters', () => {
    it('finds the quarter of a day', () => {
        expect(quarterOfDay(day('2026-11-06'))).toEqual({
            year: 2026,
            quarter: 4,
        });
        expect(quarterOfDay(day('2027-01-01'))).toEqual({
            year: 2027,
            quarter: 1,
        });
    });

    it('reads and writes a quarter key, refusing anything else', () => {
        expect(parseQuarter('2026-Q4')).toEqual({ year: 2026, quarter: 4 });
        expect(quarterKey({ year: 2026, quarter: 4 })).toBe('2026-Q4');
        expect(parseQuarter('2026-Q5')).toBeNull();
        expect(parseQuarter('soon')).toBeNull();
        expect(parseQuarter(null)).toBeNull();
    });

    it('moves across year ends in both directions', () => {
        expect(shiftQuarter({ year: 2026, quarter: 4 }, 1)).toEqual({
            year: 2027,
            quarter: 1,
        });
        expect(shiftQuarter({ year: 2027, quarter: 1 }, -1)).toEqual({
            year: 2026,
            quarter: 4,
        });
    });

    it('gives the first and last day, including a leap February', () => {
        expect(q4.first).toBe(day('2026-10-01'));
        expect(q4.last).toBe(day('2026-12-31'));
        expect(quarterBounds({ year: 2028, quarter: 1 }).last).toBe(
            day('2028-03-31')
        );
    });
});

describe('positions', () => {
    it('places a span inside the quarter', () => {
        const position = barPosition(
            day('2026-10-01'),
            day('2026-10-01'),
            q4.first,
            q4.last
        );
        expect(position?.left).toBe(0);
        expect(position?.width).toBeCloseTo(100 / 92);
    });

    it('clips a span that crosses the quarter edge', () => {
        const position = barPosition(
            day('2026-12-20'),
            day('2027-01-15'),
            q4.first,
            q4.last
        );
        expect(position?.left).toBeCloseTo(
            percentOf(day('2026-12-20'), q4.first, q4.last)
        );
        expect((position?.left ?? 0) + (position?.width ?? 0)).toBeCloseTo(100);
    });

    it('returns nothing for a span or day outside', () => {
        expect(
            barPosition(day('2027-01-01'), day('2027-01-05'), q4.first, q4.last)
        ).toBeNull();
        expect(dayCenter(day('2027-01-01'), q4.first, q4.last)).toBeNull();
    });

    it('ticks each month and each Monday', () => {
        expect(monthTicks(q4.first, q4.last)).toHaveLength(3);
        const weeks = weekTicks(q4.first, q4.last);
        expect(weeks[0].day).toBe(day('2026-10-05'));
        expect(weeks).toHaveLength(13);
    });
});

describe('placeGoals', () => {
    it('keeps far-apart goals on one line and drops those outside', () => {
        const { placed, lanes } = placeGoals(
            [
                goal('later', '2026-12-01'),
                goal('first', '2026-10-05'),
                goal('outside', '2027-01-29'),
            ],
            q4.first,
            q4.last
        );
        expect(placed.map((item) => item.goal.uid)).toEqual(['first', 'later']);
        expect(lanes).toBe(1);
    });

    it('moves close goals to another line and flips labels at the edge', () => {
        const { placed, lanes } = placeGoals(
            [goal('a', '2026-12-25'), goal('b', '2026-12-28')],
            q4.first,
            q4.last
        );
        expect(lanes).toBe(2);
        expect(placed.map((item) => item.lane)).toEqual([0, 1]);
        expect(placed.every((item) => item.flip)).toBe(true);
    });

    it('still has one line with no goals', () => {
        expect(placeGoals([], q4.first, q4.last).lanes).toBe(1);
    });
});

describe('buildRows', () => {
    const kinds = (open: string[]) =>
        buildRows(areas, new Set(open)).map((row) => row.kind);

    it('shows only areas when nothing is open', () => {
        expect(kinds([])).toEqual(['area']);
    });

    it('opens an area to its projects and a project to its tasks', () => {
        expect(kinds(['area:a1'])).toEqual(['area', 'project']);
        expect(kinds(['area:a1', 'project:p1'])).toEqual([
            'area',
            'project',
            'task',
        ]);
    });

    it('hides tasks of an open project inside a closed area', () => {
        expect(kinds(['project:p1'])).toEqual(['area']);
    });

    it('lists every row that opens', () => {
        expect(allKeys(areas)).toEqual(['area:a1', 'project:p1']);
    });
});
