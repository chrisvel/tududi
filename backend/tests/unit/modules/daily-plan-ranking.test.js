const {
    GROUP_ORDER,
    rankCandidates,
} = require('../../../modules/daily-plan/ranking');

describe('rankCandidates', () => {
    const names = (tasks) => rankCandidates(tasks).map((t) => t.name);

    it('keeps the groups in the documented order', () => {
        expect(GROUP_ORDER).toEqual([
            'overdue',
            'due_today',
            'in_progress',
            'suggested',
        ]);
    });

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

    it('puts project tasks before loose ones at the same priority', () => {
        expect(
            names([
                { id: 1, name: 'loose high', priority: 2 },
                { id: 2, name: 'project high', priority: 2, project_id: 7 },
                { id: 3, name: 'project low', priority: 0, project_id: 7 },
            ])
        ).toEqual(['project high', 'loose high', 'project low']);
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
