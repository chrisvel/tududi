import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Task } from '@/entities/Task';

// Mock task data for testing
export const mockTask: Task = {
    id: 1,
    name: 'Test Task',
    status: 'not_started',
    priority: 'medium',
    due_date: null,
    note: null,
    project_id: null,
    parent_task_id: null,
    user_id: 1,
    tags: [],
    today: false,
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-01T00:00:00.000Z',
    completed_at: null,
    recurrence_type: 'none',
    recurrence_interval: null,
    recurrence_end_date: null,
    recurrence_weekday: null,
    recurrence_month_day: null,
    recurrence_week_of_month: null,
    completion_based: false,
    uuid: 'test-uuid-123',
    today_move_count: 0,
};

export const mockParentTask: Task = {
    ...mockTask,
    id: 1,
    name: 'Parent Task',
    status: 'not_started',
};

export const mockSubtask1: Task = {
    ...mockTask,
    id: 2,
    name: 'Subtask 1',
    parent_task_id: 1,
    status: 'not_started',
};

export const mockSubtask2: Task = {
    ...mockTask,
    id: 3,
    name: 'Subtask 2',
    parent_task_id: 1,
    status: 'done',
    completed_at: '2023-01-01T12:00:00.000Z',
};

export const mockCompletedTask: Task = {
    ...mockTask,
    id: 4,
    name: 'Completed Task',
    status: 'done',
    completed_at: '2023-01-01T12:00:00.000Z',
};

export const mockSubtasks: Task[] = [mockSubtask1, mockSubtask2];

// Custom render function with providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return <div>{children}</div>;
};

const customRender = (
    ui: React.ReactElement,
    options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender as render };

// Helper function to create mock task with specific properties
export const createMockTask = (overrides: Partial<Task> = {}): Task => ({
    ...mockTask,
    ...overrides,
});

// Helper function to create mock subtasks for a parent task
export const createMockSubtasks = (
    parentTaskId: number,
    count: number = 2
): Task[] => {
    return Array.from({ length: count }, (_, index) => ({
        ...mockTask,
        id: parentTaskId + index + 1,
        name: `Subtask ${index + 1}`,
        parent_task_id: parentTaskId,
        status: index % 2 === 0 ? 'not_started' : 'done',
        completed_at: index % 2 === 0 ? null : '2023-01-01T12:00:00.000Z',
    }));
};
