'use strict';
const {
    metricOutcome,
    weightedOutcome,
    habitActivity,
    project,
} = require('../../modules/ltd-progress/projection');
const {
    validateGraph,
    validatePeriod,
} = require('../../modules/ltd-progress/hierarchy');
const { defaultPeriod } = require('../../modules/ltd-progress/periods');
const cache = require('../../modules/ltd-progress/cache');

const NOW = new Date('2026-10-11T12:00:00Z');
const goal = (id, changes = {}) => ({
    id,
    uid: `g${id}`,
    title: `Goal ${id}`,
    horizon: 'season',
    status: 'active',
    parent_goal_id: null,
    period_start: '2026-10-01',
    period_end: '2026-10-31',
    ...changes,
});
function data(changes = {}) {
    return {
        goals: [goal(1)],
        tasks: [],
        projects: [],
        metrics: [],
        plans: [],
        planItems: [],
        completions: [],
        user: { timezone: 'UTC' },
        ...changes,
    };
}
const progress = (changes) => project(data(changes), NOW).progress.get(1);

describe('Phase 4 projections: activities never fabricate outcomes', () => {
    test.each([
        [30, 70, 50, 0.5],
        [70, 30, 50, 0.5],
        [70, 30, 90, 0],
        [30, 70, 100, 1],
        [30, 70, 0, 0],
        [30, 30, 30, null],
        [0, 100, null, null],
        [0, 100, Infinity, null],
    ])(
        'metric baseline %s target %s current %s yields %s',
        (baseline, target, current_value, expected) => {
            expect(metricOutcome({ baseline, target, current_value })).toBe(
                expected
            );
        }
    );
    it('ignores undefined and zero-weight outcomes in weighted averages', () => {
        expect(
            weightedOutcome([
                { baseline: 0, target: 100, current_value: 50, weight: 3 },
                { baseline: 100, target: 0, current_value: 100, weight: 1 },
                { baseline: 1, target: 1, current_value: 1, weight: 100 },
                { baseline: 0, target: 1, current_value: 1, weight: 0 },
                { baseline: 0, target: 1, current_value: 1, weight: Infinity },
            ])
        ).toEqual({ value: 0.375, weight: 4 });
        expect(
            weightedOutcome([{ baseline: 0, target: 1, current_value: 1 }])
        ).toEqual({ value: 1, weight: 1 });
    });
    it('counts a shared subtree task once and keeps A=1 O=.4 and active status', () => {
        const goals = [
            goal(1, { horizon: 'year' }),
            goal(2, { parent_goal_id: 1 }),
        ];
        const result = progress({
            goals,
            projects: [{ id: 4, goal_id: 1 }],
            tasks: [
                {
                    id: 9,
                    goal_id: 2,
                    project_id: 4,
                    due_date: '2026-10-10T12:00:00Z',
                    status: 2,
                    estimated_minutes: 120,
                    completed_at: '2026-10-10T12:00:00Z',
                },
            ],
            metrics: [
                {
                    goal_id: 2,
                    baseline: 0,
                    target: 100,
                    current_value: 40,
                    weight: 1,
                },
            ],
        });
        expect(result.A).toBe(1);
        expect(result.O).toBe(0.4);
        expect(goals[1].status).toBe('active');
        expect(result.health).toBe('on_track');
        expect(result.achievement_suggested).toBe(false);
    });
    it('uses duration, scheduled OR due membership, and ignores tasks outside period', () => {
        const result = progress({
            tasks: [
                {
                    id: 1,
                    goal_id: 1,
                    status: 2,
                    estimated_minutes: 120,
                    due_date: '2026-10-05',
                },
                { id: 2, goal_id: 1, status: 0, due_date: '2026-11-05' },
                {
                    id: 3,
                    goal_id: 1,
                    status: 2,
                    due_date: '2026-11-05',
                    estimated_minutes: 720,
                },
            ],
            plans: [{ id: 1, plan_date: '2026-10-05' }],
            planItems: [
                { task_id: 1, daily_plan_id: 1 },
                { task_id: 2, daily_plan_id: 1 },
                { task_id: 2, daily_plan_id: 1 },
            ],
        });
        expect(result.A).toBe(0.8);
        expect(result.O).toBeNull();
    });
    it('weights child outcomes by their defined metric weights', () => {
        const result = progress({
            goals: [
                goal(1, { horizon: 'year' }),
                goal(2, { parent_goal_id: 1 }),
                goal(3, { parent_goal_id: 1 }),
                goal(4, { parent_goal_id: 1 }),
            ],
            metrics: [
                {
                    goal_id: 2,
                    baseline: 0,
                    target: 100,
                    current_value: 50,
                    weight: 3,
                },
                {
                    goal_id: 3,
                    baseline: 0,
                    target: 1,
                    current_value: 0,
                    weight: 1,
                },
            ],
        });
        expect(result.O).toBe(0.375);
    });
    it('does not fall back to a child when own metric has zero range', () => {
        expect(
            progress({
                goals: [
                    goal(1, { horizon: 'year' }),
                    goal(2, { parent_goal_id: 1 }),
                ],
                metrics: [
                    { goal_id: 1, baseline: 1, target: 1, current_value: 1 },
                    { goal_id: 2, baseline: 0, target: 1, current_value: 1 },
                ],
            }).O
        ).toBeNull();
    });
    it('returns null on an empty or zero denominator rather than NaN', () => {
        expect(progress().A).toBeNull();
        expect(progress().O).toBeNull();
        expect(
            progress({
                tasks: [
                    {
                        id: 1,
                        goal_id: 1,
                        estimated_minutes: 0,
                        due_date: '2026-10-01',
                    },
                ],
            }).A
        ).toBeNull();
    });
    it('uses local dates on inclusive boundary days and supports unbounded vision', () => {
        const result = progress({
            user: { timezone: 'Asia/Tehran' },
            goals: [
                goal(1, {
                    period_start: '2026-10-11',
                    period_end: '2026-10-11',
                }),
            ],
            tasks: [
                {
                    id: 1,
                    goal_id: 1,
                    due_date: '2026-10-10T21:00:00Z',
                    status: 2,
                },
            ],
        });
        expect(result.A).toBe(1);
        expect(
            progress({
                goals: [
                    goal(1, {
                        horizon: 'vision',
                        period_start: null,
                        period_end: null,
                    }),
                ],
                tasks: [
                    { id: 1, goal_id: 1, due_date: '2030-01-01', status: 0 },
                ],
            })
        ).toMatchObject({ A: 0, O: null, expected: null });
    });
    it('uses outcome before activity for needs_love and offers achievement only by threshold/date', () => {
        const g = goal(1, { period_end: '2026-10-12', status: 'paused' });
        expect(
            progress({
                goals: [g],
                tasks: [
                    { id: 1, goal_id: 1, status: 2, due_date: '2026-10-05' },
                ],
                metrics: [
                    { goal_id: 1, baseline: 0, target: 1, current_value: 0.1 },
                ],
            }).health
        ).toBe('needs_love');
        expect(
            progress({ goals: [goal(1, { period_end: '2026-10-10' })] })
                .achievement_suggested
        ).toBe(true);
        expect(
            progress({
                metrics: [
                    { goal_id: 1, baseline: 0, target: 1, current_value: 1 },
                ],
            }).achievement_suggested
        ).toBe(true);
        expect(
            progress({ goals: [goal(1, { status: 'paused' })] }).health
        ).toBeNull();
        expect(progress().health).toBe('stalled');
    });
    it('activity determines health only when there is no defined outcome', () => {
        expect(
            progress({
                tasks: [
                    {
                        id: 1,
                        goal_id: 1,
                        due_date: '2026-10-05',
                        status: 2,
                        completed_at: NOW,
                    },
                ],
            }).health
        ).toBe('on_track');
        expect(
            progress({
                goals: [
                    goal(1, {
                        status: 'paused',
                        period_start: '2027-01-01',
                        period_end: '2027-01-02',
                    }),
                ],
            }).expected
        ).toBe(0);
    });
    it('chains ancestors once even with a corrupted legacy cycle', () => {
        const projected = project(
            data({
                goals: [
                    goal(1, { parent_goal_id: 2 }),
                    goal(2, { parent_goal_id: 1 }),
                ],
            }),
            NOW
        );
        expect(projected.chain(1).map((g) => g.uid)).toEqual(['g1', 'g2']);
        expect(projected.progress.get(1).O).toBeNull();
        expect(projected.chain(999)).toEqual([]);
    });
    it('blends habit periods with task duration and skips unscheduled habit days', () => {
        const task = {
            id: 1,
            goal_id: 1,
            habit_mode: true,
            estimated_minutes: 30,
            created_at: '2026-10-01T12:00:00Z',
            habit_frequency_period: 'daily',
            habit_schedule_days: '[1,2,3,4,5]',
        };
        const g = goal(1, {
            period_start: '2026-10-05',
            period_end: '2026-10-11',
        });
        const completions = [
            {
                task_id: 1,
                completed_at: '2026-10-05T12:00:00Z',
                skipped: false,
            },
            {
                task_id: 1,
                completed_at: '2026-10-06T12:00:00Z',
                skipped: false,
            },
            {
                task_id: 1,
                completed_at: '2026-10-12T12:00:00Z',
                skipped: false,
            },
        ];
        expect(habitActivity(task, completions, g, {}, NOW)).toEqual({
            done: 60,
            total: 150,
        });
        expect(
            progress({
                goals: [g],
                tasks: [
                    task,
                    {
                        id: 2,
                        goal_id: 1,
                        status: 2,
                        estimated_minutes: 150,
                        due_date: '2026-10-05',
                    },
                ],
                completions,
            }).A
        ).toBe(0.7);
    });
    it('respects weekly distinct-day targets, quantities, skips, and quit periods', () => {
        const t = {
            id: 1,
            created_at: '2026-10-01T12:00:00Z',
            habit_frequency_period: 'weekly',
            habit_target_count: 2,
        };
        const g = goal(1, {
            period_start: '2026-10-05',
            period_end: '2026-10-11',
        });
        expect(
            habitActivity(
                t,
                [
                    { completed_at: '2026-10-05T12:00:00Z' },
                    { completed_at: '2026-10-05T12:00:00Z' },
                ],
                g,
                {},
                NOW
            )
        ).toEqual({ done: 0, total: 30 });
        expect(
            habitActivity(
                { ...t, habit_target_value: 5 },
                [
                    { completed_at: '2026-10-05T12:00:00Z', value: 3 },
                    { completed_at: '2026-10-06T12:00:00Z', value: 2 },
                ],
                g,
                {},
                NOW
            )
        ).toEqual({ done: 30, total: 30 });
        expect(
            habitActivity(
                t,
                [{ completed_at: '2026-10-05T12:00:00Z', skipped: true }],
                g,
                {},
                NOW
            )
        ).toEqual({ done: 0, total: 0 });
        expect(
            habitActivity(
                { ...t, habit_polarity: 'quit' },
                [],
                g,
                {},
                new Date('2026-10-12')
            )
        ).toEqual({ done: 30, total: 30 });
        expect(
            habitActivity(
                { ...t, habit_polarity: 'quit' },
                [{ completed_at: '2026-10-06T12:00:00Z' }],
                g,
                {},
                NOW
            )
        ).toEqual({ done: 0, total: 30 });
        expect(
            habitActivity(t, [], { ...g, period_start: null }, {}, NOW)
        ).toEqual({ done: 0, total: 0 });
        expect(habitActivity({ ...t, status: 3 }, [], g, {}, NOW)).toEqual({
            done: 0,
            total: 0,
        });
        expect(
            progress({
                tasks: [{ ...t, goal_id: 1, habit_mode: true }],
                completions: [
                    { task_id: 1, completed_at: NOW, skipped: false },
                ],
            }).health
        ).toBe('needs_love');
    });
});

describe('Hierarchy and default periods', () => {
    it('accepts optional horizons and the complete six-level tree', () => {
        const horizons = [
            'vision',
            'five_year',
            'year',
            'season',
            'month',
            'week',
        ];
        const nodes = horizons.map((horizon, i) =>
            goal(i + 1, { horizon, parent_goal_id: i || null })
        );
        expect(() => validateGraph(nodes, 6, {})).not.toThrow();
        expect(() => validateGraph([], null, {})).not.toThrow();
        expect(() =>
            validateGraph([goal(1, { horizon: 'year' })], null, {
                parent_goal_id: 1,
            })
        ).not.toThrow();
    });
    test.each([
        [[goal(1)], 1, { parent_goal_id: 1 }, /cycle/],
        [
            [goal(1), goal(2, { parent_goal_id: 1, horizon: 'month' })],
            1,
            { parent_goal_id: 2 },
            /cycle/,
        ],
        [
            [goal(1, { horizon: 'week' })],
            null,
            { parent_goal_id: 1, horizon: 'year' },
            /longer/,
        ],
        [[goal(1)], null, { parent_goal_id: 1 }, /longer/],
        [[goal(1)], null, { parent_goal_id: 99 }, /Invalid parent/],
        [[], null, { horizon: 'decade' }, /Invalid goal horizon/],
        [
            [goal(1, { horizon: 'year' }), goal(2, { parent_goal_id: 1 })],
            1,
            { horizon: 'week' },
            /longer/,
        ],
        [
            Array.from({ length: 7 }, (_, i) =>
                goal(i + 1, { parent_goal_id: i || null })
            ),
            7,
            {},
            /six levels/,
        ],
    ])('rejects invalid graph %#', (nodes, id, fields, error) =>
        expect(() => validateGraph(nodes, id, fields)).toThrow(error)
    );
    it('checks ISO dates and order without disallowing a one-day period', () => {
        expect(() => validatePeriod({ period_start: '2026-02-30' })).toThrow(
            /valid ISO/
        );
        expect(() => validatePeriod({ period_end: 1 })).toThrow(/valid ISO/);
        expect(() =>
            validatePeriod({
                period_start: '2026-10-12',
                period_end: '2026-10-11',
            })
        ).toThrow(/on or after/);
        expect(() => validatePeriod({ period_start: null })).not.toThrow();
        expect(() =>
            validatePeriod({
                period_start: '2026-10-11',
                period_end: '2026-10-11',
            })
        ).not.toThrow();
    });
    it('defaults Gregorian periods and keeps season the same three-month horizon', () => {
        const user = { timezone: 'UTC', first_day_of_week: 1 };
        expect(defaultPeriod('vision', user, NOW)).toEqual({
            period_start: null,
            period_end: null,
        });
        expect(defaultPeriod('season', user, NOW)).toEqual({
            period_start: '2026-10-01',
            period_end: '2026-12-31',
        });
        expect(defaultPeriod('month', user, NOW)).toEqual({
            period_start: '2026-10-01',
            period_end: '2026-10-31',
        });
        expect(defaultPeriod('year', user, NOW)).toEqual({
            period_start: '2026-01-01',
            period_end: '2026-12-31',
        });
        expect(defaultPeriod('five_year', user, NOW)).toEqual({
            period_start: '2026-01-01',
            period_end: '2030-12-31',
        });
        expect(defaultPeriod('week', user, NOW)).toEqual({
            period_start: '2026-10-05',
            period_end: '2026-10-11',
        });
    });
    it('uses Persian year/season/week defaults independently from UI language', () => {
        const user = {
            timezone: 'Asia/Tehran',
            language: 'en',
            ui_settings: JSON.stringify({
                locale: { calendarSystem: 'persian' },
            }),
        };
        expect(defaultPeriod('season', user, NOW)).toEqual({
            period_start: '2026-09-23',
            period_end: '2026-12-21',
        });
        expect(defaultPeriod('year', { language: 'fa' }, NOW)).toEqual({
            period_start: '2026-03-21',
            period_end: '2027-03-20',
        });
        expect(defaultPeriod('week', user, NOW)).toEqual({
            period_start: '2026-10-10',
            period_end: '2026-10-16',
        });
    });
});

describe('Disposable projection cache', () => {
    beforeEach(() => cache.invalidate());
    it('expires, invalidates one user or all users, and bounds memory', () => {
        jest.spyOn(Date, 'now').mockReturnValue(1000);
        expect(cache.get(1)).toBeNull();
        cache.set(1, 'first');
        cache.set(2, 'second');
        cache.invalidate(1);
        expect(cache.get(1)).toBeNull();
        expect(cache.get(2)).toBe('second');
        Date.now.mockReturnValue(6001);
        expect(cache.get(2)).toBeNull();
        for (let id = 0; id < 101; id++) cache.set(id, id);
        expect(cache.get(0)).toBeNull();
        expect(cache.get(100)).toBe(100);
        cache.invalidate();
        expect(cache.get(100)).toBeNull();
    });
});
