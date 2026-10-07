import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskList from '../TaskList';
import { Task } from '../../../entities/Task';

jest.mock('../TaskItem', () => ({
    __esModule: true,
    default: ({ task }: { task: Task }) => <div>{task.name}</div>,
}));

const makeTask = (overrides: Partial<Task>): Task =>
    ({
        id: 1,
        uid: 'uid-1',
        name: 'Task',
        status: 'not_started',
        priority: 'low',
        ...overrides,
    }) as Task;

describe('TaskList', () => {
    it('excludes cancelled tasks, matching done/archived, when showCompletedTasks is false', () => {
        const tasks = [
            makeTask({ id: 1, uid: 'a', name: 'Cancelled task', status: 'cancelled' }),
            makeTask({ id: 2, uid: 'b', name: 'Done task', status: 'done' }),
            makeTask({ id: 3, uid: 'c', name: 'Archived task', status: 'archived' }),
        ];

        render(
            <TaskList
                tasks={tasks}
                onTaskUpdate={jest.fn()}
                onTaskDelete={jest.fn()}
                projects={[]}
                showCompletedTasks={false}
            />
        );

        expect(screen.queryByText('Cancelled task')).not.toBeInTheDocument();
        expect(screen.queryByText('Done task')).not.toBeInTheDocument();
        expect(screen.queryByText('Archived task')).not.toBeInTheDocument();
        expect(screen.getByText('No tasks available.')).toBeInTheDocument();
    });

    it('keeps active tasks visible and does not show the empty state', () => {
        const tasks = [
            makeTask({ id: 1, uid: 'a', name: 'Active task', status: 'not_started' }),
            makeTask({ id: 2, uid: 'b', name: 'Cancelled task', status: 'cancelled' }),
        ];

        render(
            <TaskList
                tasks={tasks}
                onTaskUpdate={jest.fn()}
                onTaskDelete={jest.fn()}
                projects={[]}
                showCompletedTasks={false}
            />
        );

        expect(screen.getByText('Active task')).toBeInTheDocument();
        expect(screen.queryByText('Cancelled task')).not.toBeInTheDocument();
        expect(
            screen.queryByText('No tasks available.')
        ).not.toBeInTheDocument();
    });
});
