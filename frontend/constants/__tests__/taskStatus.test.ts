import {
    isTaskCompleted,
    matchesTaskStatusFilter,
    TASK_STATUS,
} from '../taskStatus';

describe('matchesTaskStatusFilter', () => {
    it('keeps every status that still needs work under the open filter', () => {
        const open = [
            'not_started',
            'in_progress',
            'waiting',
            'planned',
            TASK_STATUS.NOT_STARTED,
            TASK_STATUS.IN_PROGRESS,
            TASK_STATUS.WAITING,
            TASK_STATUS.PLANNED,
        ] as const;
        open.forEach((status) => {
            expect(matchesTaskStatusFilter(status, 'active')).toBe(true);
        });
    });

    it('hides finished and cancelled tasks from the open filter', () => {
        const closed = [
            'done',
            'archived',
            'cancelled',
            TASK_STATUS.DONE,
            TASK_STATUS.ARCHIVED,
            TASK_STATUS.CANCELLED,
        ] as const;
        closed.forEach((status) => {
            expect(matchesTaskStatusFilter(status, 'active')).toBe(false);
        });
    });

    it('shows only done and archived tasks under the completed filter', () => {
        expect(matchesTaskStatusFilter('done', 'completed')).toBe(true);
        expect(matchesTaskStatusFilter(TASK_STATUS.ARCHIVED, 'completed')).toBe(
            true
        );
        expect(matchesTaskStatusFilter('planned', 'completed')).toBe(false);
        expect(matchesTaskStatusFilter('waiting', 'completed')).toBe(false);
        expect(matchesTaskStatusFilter('not_started', 'completed')).toBe(false);
    });

    it('matches everything under the all filter', () => {
        (
            ['planned', 'done', 'cancelled', 'waiting', undefined] as const
        ).forEach((status) => {
            expect(matchesTaskStatusFilter(status, 'all')).toBe(true);
        });
    });
});

describe('isTaskCompleted', () => {
    it('treats done and archived as completed and nothing else', () => {
        expect(isTaskCompleted('done')).toBe(true);
        expect(isTaskCompleted(TASK_STATUS.ARCHIVED)).toBe(true);
        expect(isTaskCompleted('cancelled')).toBe(false);
        expect(isTaskCompleted('planned')).toBe(false);
        expect(isTaskCompleted(null)).toBe(false);
    });
});
