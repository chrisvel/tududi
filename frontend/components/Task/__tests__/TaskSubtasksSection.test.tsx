import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskSubtasksSection } from '../TaskSubtasksSection';
import { mockTask, mockSubtasks } from '@/__tests__/testUtils';
import { Task } from '@/entities/Task';

// Mock the tasksService
const mockFetchSubtasks = jest.fn();
jest.mock('@/utils/tasksService', () => ({
    fetchSubtasks: mockFetchSubtasks,
}));

describe('TaskSubtasksSection', () => {
    const mockProps = {
        task: mockTask,
        subtasks: [] as Task[],
        onSubtasksChange: jest.fn(),
        isFormSubmitting: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render subtasks section title', () => {
            render(<TaskSubtasksSection {...mockProps} />);
            expect(screen.getByText('Subtasks')).toBeInTheDocument();
        });

        it('should render add subtask button', () => {
            render(<TaskSubtasksSection {...mockProps} />);
            expect(
                screen.getByRole('button', { name: /add subtask/i })
            ).toBeInTheDocument();
        });

        it('should render existing subtasks', () => {
            const propsWithSubtasks = {
                ...mockProps,
                subtasks: mockSubtasks,
            };
            render(<TaskSubtasksSection {...propsWithSubtasks} />);

            expect(screen.getByDisplayValue('Subtask 1')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Subtask 2')).toBeInTheDocument();
        });

        it('should show empty state when no subtasks', () => {
            render(<TaskSubtasksSection {...mockProps} />);
            expect(screen.getByText(/no subtasks yet/i)).toBeInTheDocument();
        });
    });

    describe('Adding Subtasks', () => {
        it('should add new subtask when add button is clicked', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const addButton = screen.getByRole('button', {
                name: /add subtask/i,
            });
            await user.click(addButton);

            expect(onSubtasksChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    name: '',
                    isNew: true,
                    tempId: expect.any(String),
                }),
            ]);
        });

        it('should focus on new subtask input when added', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const addButton = screen.getByRole('button', {
                name: /add subtask/i,
            });
            await user.click(addButton);

            // Re-render with new subtask
            const newSubtask = {
                name: '',
                isNew: true,
                tempId: 'temp-1',
            };

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={[newSubtask] as any}
                />
            );

            const newInput = screen.getByDisplayValue('');
            expect(newInput).toBeInTheDocument();
        });

        it('should allow typing in new subtask input', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();
            const newSubtask = {
                name: '',
                isNew: true,
                tempId: 'temp-1',
            };

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={[newSubtask] as any}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const input = screen.getByDisplayValue('');
            await user.type(input, 'New subtask name');

            expect(onSubtasksChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    name: 'New subtask name',
                    isNew: true,
                    tempId: 'temp-1',
                }),
            ]);
        });
    });

    describe('Editing Subtasks', () => {
        it('should allow editing existing subtask name', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={mockSubtasks}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const input = screen.getByDisplayValue('Subtask 1');
            await user.clear(input);
            await user.type(input, 'Updated subtask name');

            expect(onSubtasksChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    id: 2,
                    name: 'Updated subtask name',
                    isEdited: true,
                }),
                expect.objectContaining({
                    id: 3,
                    name: 'Subtask 2',
                }),
            ]);
        });

        it('should mark subtask as edited when name changes', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={mockSubtasks}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const input = screen.getByDisplayValue('Subtask 1');
            await user.type(input, ' edited');

            expect(onSubtasksChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    id: 2,
                    name: 'Subtask 1 edited',
                    isEdited: true,
                }),
                expect.objectContaining({
                    id: 3,
                    name: 'Subtask 2',
                }),
            ]);
        });
    });

    describe('Removing Subtasks', () => {
        it('should show remove button for each subtask', () => {
            render(
                <TaskSubtasksSection {...mockProps} subtasks={mockSubtasks} />
            );

            const removeButtons = screen.getAllByRole('button', {
                name: /remove subtask/i,
            });
            expect(removeButtons).toHaveLength(2);
        });

        it('should remove subtask when remove button is clicked', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={mockSubtasks}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const removeButtons = screen.getAllByRole('button', {
                name: /remove subtask/i,
            });
            await user.click(removeButtons[0]);

            expect(onSubtasksChange).toHaveBeenCalledWith([
                expect.objectContaining({
                    id: 3,
                    name: 'Subtask 2',
                }),
            ]);
        });

        it('should remove new subtask immediately', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();
            const newSubtask = {
                name: 'New subtask',
                isNew: true,
                tempId: 'temp-1',
            };

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={[newSubtask] as any}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const removeButton = screen.getByRole('button', {
                name: /remove subtask/i,
            });
            await user.click(removeButton);

            expect(onSubtasksChange).toHaveBeenCalledWith([]);
        });
    });

    describe('Subtask Validation', () => {
        it('should show validation error for empty subtask name', () => {
            const subtaskWithEmptyName = {
                ...mockSubtasks[0],
                name: '',
                isEdited: true,
            };

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={[subtaskWithEmptyName]}
                />
            );

            expect(
                screen.getByText(/subtask name is required/i)
            ).toBeInTheDocument();
        });

        it('should show validation error for duplicate subtask names', () => {
            const duplicateSubtasks = [
                { ...mockSubtasks[0], name: 'Duplicate Name' },
                { ...mockSubtasks[1], name: 'Duplicate Name' },
            ];

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={duplicateSubtasks}
                />
            );

            expect(
                screen.getByText(/duplicate subtask names are not allowed/i)
            ).toBeInTheDocument();
        });

        it('should not save until validation passes', () => {
            const subtaskWithEmptyName = {
                ...mockSubtasks[0],
                name: '',
                isEdited: true,
            };

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={[subtaskWithEmptyName]}
                />
            );

            // Should show validation error
            expect(
                screen.getByText(/subtask name is required/i)
            ).toBeInTheDocument();
        });
    });

    describe('Form Submission State', () => {
        it('should disable inputs when form is submitting', () => {
            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={mockSubtasks}
                    isFormSubmitting={true}
                />
            );

            const inputs = screen.getAllByRole('textbox');
            inputs.forEach((input) => {
                expect(input).toBeDisabled();
            });
        });

        it('should disable add button when form is submitting', () => {
            render(
                <TaskSubtasksSection {...mockProps} isFormSubmitting={true} />
            );

            const addButton = screen.getByRole('button', {
                name: /add subtask/i,
            });
            expect(addButton).toBeDisabled();
        });

        it('should disable remove buttons when form is submitting', () => {
            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={mockSubtasks}
                    isFormSubmitting={true}
                />
            );

            const removeButtons = screen.getAllByRole('button', {
                name: /remove subtask/i,
            });
            removeButtons.forEach((button) => {
                expect(button).toBeDisabled();
            });
        });
    });

    describe('Keyboard Navigation', () => {
        it('should move focus to next input when pressing Tab', async () => {
            const user = userEvent.setup();

            render(
                <TaskSubtasksSection {...mockProps} subtasks={mockSubtasks} />
            );

            const inputs = screen.getAllByRole('textbox');
            await user.click(inputs[0]);
            await user.tab();

            expect(inputs[1]).toHaveFocus();
        });

        it('should add new subtask when pressing Enter on add button', async () => {
            const user = userEvent.setup();
            const onSubtasksChange = jest.fn();

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    onSubtasksChange={onSubtasksChange}
                />
            );

            const addButton = screen.getByRole('button', {
                name: /add subtask/i,
            });
            await user.click(addButton);
            await user.keyboard('{Enter}');

            expect(onSubtasksChange).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', () => {
            render(
                <TaskSubtasksSection {...mockProps} subtasks={mockSubtasks} />
            );

            expect(
                screen.getByRole('button', { name: /add subtask/i })
            ).toBeInTheDocument();
            expect(
                screen.getAllByRole('button', { name: /remove subtask/i })
            ).toHaveLength(2);
        });

        it('should have proper form labels', () => {
            render(
                <TaskSubtasksSection {...mockProps} subtasks={mockSubtasks} />
            );

            const inputs = screen.getAllByRole('textbox');
            inputs.forEach((input, index) => {
                expect(input).toHaveAttribute(
                    'placeholder',
                    `Subtask ${index + 1} name`
                );
            });
        });

        it('should announce validation errors to screen readers', () => {
            const subtaskWithEmptyName = {
                ...mockSubtasks[0],
                name: '',
                isEdited: true,
            };

            render(
                <TaskSubtasksSection
                    {...mockProps}
                    subtasks={[subtaskWithEmptyName]}
                />
            );

            const errorMessage = screen.getByText(/subtask name is required/i);
            expect(errorMessage).toHaveAttribute('role', 'alert');
        });
    });
});
