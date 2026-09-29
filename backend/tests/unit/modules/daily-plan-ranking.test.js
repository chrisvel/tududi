const {
    DEFAULT_ORDER,
    normalizeOrder,
    orderCandidates,
    rankCandidates,
} = require('../../../modules/daily-plan/ranking');

describe('rankCandidates', () => {
    const names = (tasks, tieBreak) =>
        rankCandidates(tasks, tieBreak).map((t) => t.name);

    it('puts higher priority first, with no priority last', () => {
        expect(
            names([
                { id: 1, name: 'none', priority: null },
                { id: 2, name: 'low', priority: 0 },
                { id: 3, name: 'high', priority: 2 },
                { id: 4, name: 'medium', priority: 'medium' },
            ])
        ).toEqual(['high', 'medium', 'low', 'none']);
    });

    it('breaks ties by due date, then age when asked for oldest, then id', () => {
        expect(
            names(
                [
                    { id: 5, name: 'no due, newer', created_at: '2026-09-02' },
                    { id: 4, name: 'no due, older', created_at: '2026-09-01' },
                    { id: 3, name: 'due later', due_date: '2026-09-20' },
                    { id: 2, name: 'due sooner', due_date: '2026-09-10' },
                    { id: 1, name: 'same as older', created_at: '2026-09-01' },
                ],
                'oldest'
            )
        ).toEqual([
            'due sooner',
            'due later',
            'same as older',
            'no due, older',
            'no due, newer',
        ]);
    });

    describe('tie-break modes', () => {
        const tasks = [
            {
                id: 1,
                name: 'old, touched today',
                created_at: '2026-01-01',
                updated_at: '2026-09-28',
            },
            {
                id: 2,
                name: 'new, touched last week',
                created_at: '2026-09-01',
                updated_at: '2026-09-21',
            },
            {
                id: 3,
                name: 'middle, untouched',
                created_at: '2026-05-01',
                updated_at: '2026-05-01',
            },
            { id: 4, name: 'no dates' },
        ];

        it('puts the most recently changed task first by default', () => {
            expect(names(tasks)).toEqual([
                'old, touched today',
                'new, touched last week',
                'middle, untouched',
                'no dates',
            ]);
            expect(names(tasks, 'recently_touched')).toEqual(names(tasks));
        });

        it('puts the newest task first', () => {
            expect(names(tasks, 'newest')).toEqual([
                'new, touched last week',
                'middle, untouched',
                'old, touched today',
                'no dates',
            ]);
        });

        it('puts the oldest task first', () => {
            expect(names(tasks, 'oldest')).toEqual([
                'old, touched today',
                'middle, untouched',
                'new, touched last week',
                'no dates',
            ]);
        });

        it('still ranks priority and due date above the tie-break', () => {
            const ranked = names(
                [
                    ...tasks,
                    { id: 5, name: 'due soon', due_date: '2026-09-29' },
                    { id: 6, name: 'high', priority: 2 },
                ],
                'newest'
            );
            expect(ranked.slice(0, 2)).toEqual(['high', 'due soon']);
        });
    });

    it('does not change the list it was given', () => {
        const tasks = [
            { id: 1, name: 'b', priority: 0 },
            { id: 2, name: 'a', priority: 2 },
        ];
        rankCandidates(tasks);
        expect(tasks.map((t) => t.name)).toEqual(['b', 'a']);
    });
});

describe('normalizeOrder', () => {
    it('starts with project tasks before loose ones in each group', () => {
        expect(DEFAULT_ORDER).toEqual([
            'overdue:project',
            'overdue:none',
            'due_today:project',
            'due_today:none',
            'in_progress:project',
            'in_progress:none',
            'suggested:project',
            'suggested:none',
        ]);
    });

    it('falls back to the default for anything that is not a list', () => {
        expect(normalizeOrder(undefined)).toEqual(DEFAULT_ORDER);
        expect(normalizeOrder('overdue')).toEqual(DEFAULT_ORDER);
    });

    it('drops unknown and repeated keys and appends missing ones', () => {
        expect(
            normalizeOrder(['suggested:none', 'nope', 'suggested:none'])
        ).toEqual([
            'suggested:none',
            ...DEFAULT_ORDER.filter((key) => key !== 'suggested:none'),
        ]);
    });
});

describe('orderCandidates', () => {
    const groups = {
        overdue: [
            { id: 1, name: 'late loose', priority: 2 },
            { id: 2, name: 'late project', priority: 0, project_id: 9 },
        ],
        due_today: [],
        in_progress: [],
        suggested: [
            { id: 3, name: 'idea loose high', priority: 2 },
            { id: 4, name: 'idea loose low', priority: 0 },
            { id: 5, name: 'idea project', project_id: 9 },
        ],
    };
    const names = (order) =>
        orderCandidates(groups, order).map(({ task }) => task.name);

    it('puts higher priority first inside a group, whatever the project split', () => {
        expect(names()).toEqual([
            'late loose',
            'late project',
            'idea loose high',
            'idea loose low',
            'idea project',
        ]);
    });

    it('uses the bucket order to break priority ties', () => {
        const tied = {
            suggested: [
                { id: 1, name: 'loose' },
                { id: 2, name: 'project', project_id: 9 },
            ],
        };
        const order = (buckets) =>
            orderCandidates(tied, buckets).map(({ task }) => task.name);
        expect(order()).toEqual(['project', 'loose']);
        expect(order(['suggested:none', 'suggested:project'])).toEqual([
            'loose',
            'project',
        ]);
    });

    it('never ranks a project task without priority above a high one in the same group', () => {
        const tasks = {
            suggested: [
                ...Array.from({ length: 30 }, (_, i) => ({
                    id: i + 10,
                    name: `project ${i}`,
                    project_id: 9,
                })),
                { id: 1, name: 'loose high', priority: 2 },
            ],
        };
        expect(orderCandidates(tasks)[0].task.name).toBe('loose high');
    });

    it('places each group where its first bucket is in a custom order', () => {
        expect(
            names([
                'suggested:none',
                'overdue:none',
                'suggested:project',
                'overdue:project',
            ])
        ).toEqual([
            'idea loose high',
            'idea loose low',
            'idea project',
            'late loose',
            'late project',
        ]);
    });

    it('keeps the group each task came from', () => {
        expect(orderCandidates(groups)[0].group).toBe('overdue');
    });
});
