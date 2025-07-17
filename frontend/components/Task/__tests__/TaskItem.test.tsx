import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskItem } from '../TaskItem';
import {
    mockTask,
    mockParentTask,
    mockSubtasks,
    createMockTask,
} from '@/__tests__/testUtils';

// Mock the fetchSubtasks function
const mockFetchSubtasks = jest.fn();
jest.mock('@/utils/tasksService', () => ({
    fetchSubtasks: mockFetchSubtasks,
}));

describe('TaskItem', () => {
    const mockProps = {
        task: mockTask,
        onTaskClick: jest.fn(),
        onTaskUpdate: jest.fn(),
        onTaskDelete: jest.fn(),
        isSelected: false,
        showTaskOptions: true,
        showProjectInfo: true,
        showTags: true,
        showDueDate: true,
        showPriority: true,
        showTodayToggle: true,
        showPlayButton: true,
        allowEdit: true,
        allowDelete: true,
        className: '',
        priorityIconSize: 'sm' as const,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetchSubtasks.mockResolvedValue([]);
    });

    describe('Subtasks Display', () => {
        it('should not show subtasks by default', () => {
            render(<TaskItem {...mockProps} />);

            expect(
                screen.queryByTestId('subtasks-display')
            ).not.toBeInTheDocument();
        });

        it('should show subtasks when showSubtasks is true and task has subtasks', async () => {
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            // Wait for subtasks to load
            await screen.findByText('Subtask 1');

            // Click subtasks button to expand
            const subtasksButton = screen.getByTitle(/show subtasks/i);
            await userEvent.click(subtasksButton);

            expect(screen.getByTestId('subtasks-display')).toBeInTheDocument();
        });

        it('should hide subtasks for archived tasks', () => {
            const archivedTask = createMockTask({ status: 'archived' });
            render(<TaskItem {...mockProps} task={archivedTask} />);

            expect(
                screen.queryByTestId('subtasks-display')
            ).not.toBeInTheDocument();
        });

        it('should show subtasks for completed tasks', async () => {
            const completedTask = createMockTask({ status: 'done' });
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={completedTask} />);

            // Should show subtasks button for completed tasks
            expect(screen.getByTitle(/show subtasks/i)).toBeInTheDocument();
        });
    });

    describe('Subtasks Loading', () => {
        it('should fetch subtasks on component mount', async () => {
            render(<TaskItem {...mockProps} task={mockParentTask} />);

            expect(mockFetchSubtasks).toHaveBeenCalledWith(mockParentTask.id);
        });

        it('should show loading state while fetching subtasks', async () => {
            mockFetchSubtasks.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 100))
            );

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });

        it('should handle subtasks fetch error gracefully', async () => {
            mockFetchSubtasks.mockRejectedValue(new Error('Failed to fetch'));

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            await screen.findByText(/error loading subtasks/i);
        });

        it('should update hasSubtasks state based on fetched data', async () => {
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            // Should show subtasks button after loading
            await screen.findByTitle(/show subtasks/i);
        });
    });

    describe('Subtasks Toggle', () => {
        it('should toggle subtasks visibility when button is clicked', async () => {
            const user = userEvent.setup();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(screen.getByTestId('subtasks-display')).toBeInTheDocument();

            // Click again to hide
            const hideButton = screen.getByTitle(/hide subtasks/i);
            await user.click(hideButton);

            expect(
                screen.queryByTestId('subtasks-display')
            ).not.toBeInTheDocument();
        });

        it('should persist subtasks visibility state', async () => {
            const user = userEvent.setup();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(screen.getByTestId('subtasks-display')).toBeInTheDocument();

            // Re-render component - subtasks should still be visible
            render(<TaskItem {...mockProps} task={mockParentTask} />);

            expect(screen.getByTestId('subtasks-display')).toBeInTheDocument();
        });
    });

    describe('Subtasks Progress Bar', () => {
        it('should show progress bar when subtasks are expanded', async () => {
            const user = userEvent.setup();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(screen.getByTestId('subtasks-progress')).toBeInTheDocument();
        });

        it('should not show progress bar when subtasks are collapsed', async () => {
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            expect(
                screen.queryByTestId('subtasks-progress')
            ).not.toBeInTheDocument();
        });

        it('should calculate progress correctly', async () => {
            const user = userEvent.setup();
            const subtasksWithProgress = [
                createMockTask({
                    id: 2,
                    name: 'Subtask 1',
                    parent_task_id: 1,
                    status: 'done',
                }),
                createMockTask({
                    id: 3,
                    name: 'Subtask 2',
                    parent_task_id: 1,
                    status: 'not_started',
                }),
                createMockTask({
                    id: 4,
                    name: 'Subtask 3',
                    parent_task_id: 1,
                    status: 'done',
                }),
            ];
            mockFetchSubtasks.mockResolvedValue(subtasksWithProgress);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            // 2 out of 3 subtasks are done = 66.67%
            expect(screen.getByText('2 of 3 completed')).toBeInTheDocument();
        });
    });

    describe('Subtasks Interaction', () => {
        it('should handle subtask click events', async () => {
            const user = userEvent.setup();
            const onTaskUpdate = jest.fn();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(
                <TaskItem
                    {...mockProps}
                    task={mockParentTask}
                    onTaskUpdate={onTaskUpdate}
                />
            );

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            const subtaskItem = screen.getByText('Subtask 1');
            await user.click(subtaskItem);

            // Should handle subtask click appropriately
            expect(onTaskUpdate).toHaveBeenCalled();
        });

        it('should prevent task selection when clicking on subtasks area', async () => {
            const user = userEvent.setup();
            const onTaskClick = jest.fn();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(
                <TaskItem
                    {...mockProps}
                    task={mockParentTask}
                    onTaskClick={onTaskClick}
                />
            );

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            const subtasksDisplay = screen.getByTestId('subtasks-display');
            await user.click(subtasksDisplay);

            // Should not trigger task selection
            expect(onTaskClick).not.toHaveBeenCalled();
        });

        it('should update parent task when subtask is completed', async () => {
            const user = userEvent.setup();
            const onTaskUpdate = jest.fn();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(
                <TaskItem
                    {...mockProps}
                    task={mockParentTask}
                    onTaskUpdate={onTaskUpdate}
                />
            );

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            const subtaskCheckbox = screen.getByTestId('subtask-checkbox-2');
            await user.click(subtaskCheckbox);

            expect(onTaskUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: mockParentTask.id,
                    status: 'done', // Parent should be completed when all subtasks are done
                })
            );
        });
    });

    describe('Subtasks Layout', () => {
        it('should render subtasks with proper indentation', async () => {
            const user = userEvent.setup();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            const subtasksDisplay = screen.getByTestId('subtasks-display');
            expect(subtasksDisplay).toHaveClass('ml-6'); // Indented subtasks
        });

        it('should not show task options for subtasks', async () => {
            const user = userEvent.setup();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            // Subtasks should not have the same options as parent tasks
            const subtaskItems = screen.getAllByText(/subtask/i);
            expect(subtaskItems).toHaveLength(2);

            // Should not show edit/delete options for subtasks
            expect(
                screen.queryByTestId('subtask-edit-button')
            ).not.toBeInTheDocument();
        });
    });

    describe('Task Modal Integration', () => {
        it('should show subtasks section in task modal', async () => {
            const user = userEvent.setup();
            mockFetchSubtasks.mockResolvedValue(mockSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            // Click on task to open modal
            const taskHeader = screen.getByText(mockParentTask.name);
            await user.click(taskHeader);

            // Modal should contain subtasks section
            expect(screen.getByText('Subtasks')).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty subtasks array', async () => {
            mockFetchSubtasks.mockResolvedValue([]);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            // Should not show subtasks button if no subtasks
            await screen.findByText(mockParentTask.name);
            expect(
                screen.queryByTitle(/show subtasks/i)
            ).not.toBeInTheDocument();
        });

        it('should handle subtasks with null parent_task_id', async () => {
            const invalidSubtasks = [
                createMockTask({
                    id: 2,
                    name: 'Invalid Subtask',
                    parent_task_id: null,
                }),
            ];
            mockFetchSubtasks.mockResolvedValue(invalidSubtasks);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            // Should handle gracefully and not crash
            await screen.findByText(mockParentTask.name);
        });

        it('should handle very long subtask names', async () => {
            const user = userEvent.setup();
            const longSubtask = createMockTask({
                id: 2,
                name: 'This is a very long subtask name that should be handled properly without breaking the layout',
                parent_task_id: 1,
            });
            mockFetchSubtasks.mockResolvedValue([longSubtask]);

            render(<TaskItem {...mockProps} task={mockParentTask} />);

            const subtasksButton = await screen.findByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(screen.getByText(longSubtask.name)).toBeInTheDocument();
        });
    });
});
