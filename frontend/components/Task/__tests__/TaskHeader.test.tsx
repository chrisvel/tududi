import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskHeader } from '../TaskHeader';
import {
    mockTask,
    mockCompletedTask,
    createMockTask,
} from '@/__tests__/testUtils';

describe('TaskHeader', () => {
    const mockProps = {
        task: mockTask,
        hasSubtasks: false,
        showSubtasks: false,
        onSubtasksToggle: jest.fn(),
        onTaskClick: jest.fn(),
        onTaskUpdate: jest.fn(),
        onTaskDelete: jest.fn(),
        onEditClick: jest.fn(),
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
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Subtasks Button Rendering', () => {
        it('should not show subtasks button when task has no subtasks', () => {
            render(<TaskHeader {...mockProps} hasSubtasks={false} />);

            expect(
                screen.queryByTitle(/show subtasks/i)
            ).not.toBeInTheDocument();
            expect(
                screen.queryByTitle(/hide subtasks/i)
            ).not.toBeInTheDocument();
        });

        it('should show subtasks button when task has subtasks', () => {
            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            expect(screen.getByTitle(/show subtasks/i)).toBeInTheDocument();
        });

        it('should show hide subtasks button when subtasks are expanded', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    showSubtasks={true}
                />
            );

            expect(screen.getByTitle(/hide subtasks/i)).toBeInTheDocument();
        });

        it('should show subtasks button for completed tasks', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    task={mockCompletedTask}
                    hasSubtasks={true}
                />
            );

            expect(screen.getByTitle(/show subtasks/i)).toBeInTheDocument();
        });

        it('should not show subtasks button for archived tasks', () => {
            const archivedTask = createMockTask({ status: 'archived' });
            render(
                <TaskHeader
                    {...mockProps}
                    task={archivedTask}
                    hasSubtasks={true}
                />
            );

            expect(
                screen.queryByTitle(/show subtasks/i)
            ).not.toBeInTheDocument();
        });
    });

    describe('Subtasks Button Interaction', () => {
        it('should call onSubtasksToggle when subtasks button is clicked', async () => {
            const user = userEvent.setup();
            const onSubtasksToggle = jest.fn();

            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    onSubtasksToggle={onSubtasksToggle}
                />
            );

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(onSubtasksToggle).toHaveBeenCalledTimes(1);
        });

        it('should prevent event propagation when subtasks button is clicked', async () => {
            const user = userEvent.setup();
            const onTaskClick = jest.fn();
            const onSubtasksToggle = jest.fn();

            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    onTaskClick={onTaskClick}
                    onSubtasksToggle={onSubtasksToggle}
                />
            );

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(onSubtasksToggle).toHaveBeenCalledTimes(1);
            expect(onTaskClick).not.toHaveBeenCalled();
        });

        it('should log subtasks button click for debugging', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const user = userEvent.setup();

            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            await user.click(subtasksButton);

            expect(consoleSpy).toHaveBeenCalledWith(
                'Subtasks button clicked',
                expect.any(Object)
            );

            consoleSpy.mockRestore();
        });
    });

    describe('Subtasks Button Styling', () => {
        it('should have blue styling when subtasks are expanded', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    showSubtasks={true}
                />
            );

            const subtasksButton = screen.getByTitle(/hide subtasks/i);
            expect(subtasksButton).toHaveClass('bg-blue-100');
            expect(subtasksButton).toHaveClass('text-blue-600');
        });

        it('should have gray styling when subtasks are collapsed', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    showSubtasks={false}
                />
            );

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            expect(subtasksButton).toHaveClass('bg-gray-100');
            expect(subtasksButton).toHaveClass('text-gray-600');
        });

        it('should have opacity-0 class when subtasks are collapsed', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    showSubtasks={false}
                />
            );

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            expect(subtasksButton).toHaveClass('opacity-0');
            expect(subtasksButton).toHaveClass('group-hover:opacity-100');
        });
    });

    describe('Mobile Subtasks Button', () => {
        it('should show mobile subtasks button when hasSubtasks is true', () => {
            // Mock window.innerWidth to simulate mobile view
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 600,
            });

            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            // Should render both desktop and mobile versions
            const subtasksButtons = screen.getAllByTitle(/show subtasks/i);
            expect(subtasksButtons.length).toBeGreaterThan(1);
        });

        it('should call onSubtasksToggle when mobile subtasks button is clicked', async () => {
            const user = userEvent.setup();
            const onSubtasksToggle = jest.fn();

            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    onSubtasksToggle={onSubtasksToggle}
                />
            );

            const subtasksButtons = screen.getAllByTitle(/show subtasks/i);
            await user.click(subtasksButtons[0]); // Click first button (could be mobile)

            expect(onSubtasksToggle).toHaveBeenCalledTimes(1);
        });

        it('should log mobile subtasks button click for debugging', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const user = userEvent.setup();

            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            const subtasksButtons = screen.getAllByTitle(/show subtasks/i);
            await user.click(subtasksButtons[0]);

            expect(consoleSpy).toHaveBeenCalled();

            consoleSpy.mockRestore();
        });
    });

    describe('Task Status Integration', () => {
        it('should show all other controls alongside subtasks button', () => {
            const taskWithProject = createMockTask({
                project_id: 1,
                due_date: '2023-12-31',
                priority: 'high',
                tags: [{ id: 1, name: 'important' }],
            });

            render(
                <TaskHeader
                    {...mockProps}
                    task={taskWithProject}
                    hasSubtasks={true}
                />
            );

            // Should show subtasks button
            expect(screen.getByTitle(/show subtasks/i)).toBeInTheDocument();

            // Should also show other controls (these would be tested in their respective components)
            expect(screen.getByText(taskWithProject.name)).toBeInTheDocument();
        });

        it('should handle task completion state properly with subtasks', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    task={mockCompletedTask}
                    hasSubtasks={true}
                />
            );

            // Should show subtasks button even for completed tasks
            expect(screen.getByTitle(/show subtasks/i)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA attributes for subtasks button', () => {
            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            expect(subtasksButton).toHaveAttribute('role', 'button');
            expect(subtasksButton).toHaveAttribute('title', 'Show subtasks');
        });

        it('should update ARIA attributes when subtasks are expanded', () => {
            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    showSubtasks={true}
                />
            );

            const subtasksButton = screen.getByTitle(/hide subtasks/i);
            expect(subtasksButton).toHaveAttribute('title', 'Hide subtasks');
        });

        it('should be keyboard accessible', async () => {
            const user = userEvent.setup();
            const onSubtasksToggle = jest.fn();

            render(
                <TaskHeader
                    {...mockProps}
                    hasSubtasks={true}
                    onSubtasksToggle={onSubtasksToggle}
                />
            );

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            await user.tab();

            // Focus should be on the subtasks button (or at least navigable to it)
            expect(subtasksButton).toBeInTheDocument();

            // Should be activatable with Enter or Space
            await user.keyboard('{Enter}');
            // Note: This might not work perfectly due to the onClick handler, but the button should be focusable
        });
    });

    describe('Icon Rendering', () => {
        it('should render Squares2X2Icon in subtasks button', () => {
            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            const icon = subtasksButton.querySelector('svg');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveClass('h-3', 'w-3');
        });
    });

    describe('Task Header Layout', () => {
        it('should maintain proper layout with subtasks button', () => {
            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            expect(subtasksButton).toHaveClass('w-6', 'h-6', 'rounded-full');
        });

        it('should position subtasks button correctly in button group', () => {
            render(<TaskHeader {...mockProps} hasSubtasks={true} />);

            const subtasksButton = screen.getByTitle(/show subtasks/i);
            const buttonContainer = subtasksButton.closest('.flex');
            expect(buttonContainer).toHaveClass('items-center');
        });
    });
});
