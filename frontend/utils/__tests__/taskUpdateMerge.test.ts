import { Task } from '../../entities/Task';
import { mergeUpdatedGroupedTasks, mergeUpdatedTask } from '../taskUpdateMerge';

const virtual = (day: string, index: number): Task =>
    ({
        id: 7,
        uid: 'parent-uid',
        name: 'Daily',
        original_name: 'Review Inbox',
        due_date: day,
        due_time: '00:00',
        due_has_time: true,
        is_virtual_occurrence: true,
        virtual_id: `7_occurrence_${index}`,
        occurrence_index: index,
        completed_at: null,
    }) as Task;

describe('mergeUpdatedTask', () => {
    it('keeps each Upcoming day and applies the saved due time', () => {
        const server = {
            id: 7,
            uid: 'parent-uid',
            name: 'Daily',
            original_name: 'Review Inbox',
            due_date: '2026-10-20',
            due_time: '06:00',
            due_has_time: true,
            completed_at: null,
        } as Task;

        const grouped = mergeUpdatedGroupedTasks(
            {
                Today: [virtual('2026-10-20', 0)],
                Tomorrow: [virtual('2026-10-21', 1)],
            },
            virtual('2026-10-20', 0),
            server
        );

        expect(grouped?.Today[0]).toEqual(
            expect.objectContaining({
                due_date: '2026-10-20',
                due_time: '06:00',
                due_has_time: true,
                virtual_id: '7_occurrence_0',
            })
        );
        expect(grouped?.Tomorrow[0]).toEqual(
            expect.objectContaining({
                due_date: '2026-10-21',
                due_time: '06:00',
                virtual_id: '7_occurrence_1',
            })
        );
    });

    it('replaces a non-virtual due date with the saved one', () => {
        const row = {
            id: 3,
            uid: 'one-off',
            due_date: '2026-10-20',
            due_time: '13:45',
            due_has_time: true,
            completed_at: null,
        } as Task;
        const server = {
            ...row,
            due_date: '2026-10-21',
        } as Task;

        expect(mergeUpdatedTask(row, server).due_date).toBe('2026-10-21');
        expect(mergeUpdatedTask(row, server).due_time).toBe('13:45');
    });
});
