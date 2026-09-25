const {
    DEFAULT_ORDER,
    normalizeOrder,
    orderCandidates,
    rankCandidates,
} = require('../../../modules/daily-plan/ranking');

describe('rankCandidates', () => {
    const names = (tasks) => rankCandidates(tasks).map((t) => t.name);

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

    it('breaks ties by due date, then age, then id', () => {
        expect(
            names([
                { id: 5, name: 'no due, newer', created_at: '2026-09-02' },
                { id: 4, name: 'no due, older', created_at: '2026-09-01' },
                { id: 3, name: 'due later', due_date: '2026-09-20' },
                { id: 2, name: 'due sooner', due_date: '2026-09-10' },
                { id: 1, name: 'same as older', created_at: '2026-09-01' },
            ])
        ).toEqual([
            'due sooner',
            'due later',
            'same as older',
            'no due, older',
            'no due, newer',
        ]);
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

    it('puts project tasks before loose ones by default, even at lower priority', () => {
        expect(names()).toEqual([
            'late project',
            'late loose',
            'idea project',
            'idea loose high',
            'idea loose low',
        ]);
    });

    it('follows a custom bucket order', () => {
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
            'late loose',
            'idea project',
            'late project',
        ]);
    });

    it('keeps the group each task came from', () => {
        expect(orderCandidates(groups)[0].group).toBe('overdue');
    });
});
