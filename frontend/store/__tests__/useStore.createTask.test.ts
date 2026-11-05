import { useStore } from '../useStore';
import { createTask } from '../../utils/tasksService';

jest.mock('../../utils/tasksService', () => ({
    createTask: jest.fn(),
}));

describe('tasksStore.createTask', () => {
    it('announces the new task so pages with their own list can show it', async () => {
        const newTask = { uid: 'abc123', name: 'Call the bank' };
        (createTask as jest.Mock).mockResolvedValue(newTask);
        const listener = jest.fn();
        window.addEventListener('taskCreated', listener);

        await useStore
            .getState()
            .tasksStore.createTask({ name: 'Call the bank' } as any);

        window.removeEventListener('taskCreated', listener);
        expect(listener).toHaveBeenCalledTimes(1);
        expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual(
            newTask
        );
        expect(useStore.getState().tasksStore.tasks[0]).toEqual(newTask);
    });
});
