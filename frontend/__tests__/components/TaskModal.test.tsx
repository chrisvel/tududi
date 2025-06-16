import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TaskModal from '../../components/Task/TaskModal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';

const mockTask: Task = {
  id: 1,
  name: 'Test Task',
  status: 'not_started',
  priority: 'medium',
  due_date: '2024-12-25',
  note: 'Test note',
  created_at: '2024-01-01T00:00:00.000Z',
  tags: [
    { id: 1, name: 'work' },
    { id: 2, name: 'urgent' }
  ]
};

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Test Project',
    active: true
  }
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  task: mockTask,
  onSave: jest.fn(),
  onDelete: jest.fn(),
  projects: mockProjects,
  onCreateProject: jest.fn()
};

// Mock fetch for tags service
global.fetch = jest.fn();

const renderTaskModal = (props = defaultProps) => {
  return render(
    <BrowserRouter>
      <TaskModal {...props} />
    </BrowserRouter>
  );
};

describe('TaskModal Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] })
    });
  });

  it('renders modal when open', () => {
    renderTaskModal();
    
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test note')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    renderTaskModal({
      ...defaultProps,
      isOpen: false
    });
    
    expect(screen.queryByDisplayValue('Test Task')).not.toBeInTheDocument();
  });

  it('displays task information correctly', () => {
    renderTaskModal();
    
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test note')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-12-25')).toBeInTheDocument();
  });

  it('allows editing task name', async () => {
    const user = userEvent.setup();
    renderTaskModal();
    
    const nameInput = screen.getByDisplayValue('Test Task');
    
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated Task Name');
    });
    
    expect(screen.getByDisplayValue('Updated Task Name')).toBeInTheDocument();
  });

  it('allows editing task note', async () => {
    const user = userEvent.setup();
    renderTaskModal();
    
    const noteInput = screen.getByDisplayValue('Test note');
    
    await act(async () => {
      await user.clear(noteInput);
      await user.type(noteInput, 'Updated note content');
    });
    
    expect(screen.getByDisplayValue('Updated note content')).toBeInTheDocument();
  });

  it('allows editing due date', async () => {
    const user = userEvent.setup();
    renderTaskModal();
    
    const dueDateInput = screen.getByDisplayValue('2024-12-25');
    
    await act(async () => {
      await user.clear(dueDateInput);
      await user.type(dueDateInput, '2024-12-31');
    });
    
    expect(screen.getByDisplayValue('2024-12-31')).toBeInTheDocument();
  });

  it('calls onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnSave = jest.fn();
    
    renderTaskModal({
      ...defaultProps,
      onSave: mockOnSave
    });
    
    const saveButton = screen.getByText(/save/i);
    
    await act(async () => {
      await user.click(saveButton);
    });
    
    expect(mockOnSave).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    
    renderTaskModal({
      ...defaultProps,
      onClose: mockOnClose
    });
    
    const cancelButton = screen.getByText(/cancel/i);
    
    await act(async () => {
      await user.click(cancelButton);
    });
    
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup();
    renderTaskModal();
    
    const deleteButton = screen.getByText(/delete/i);
    
    await act(async () => {
      await user.click(deleteButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it('calls onDelete when delete is confirmed', async () => {
    const user = userEvent.setup();
    const mockOnDelete = jest.fn();
    
    renderTaskModal({
      ...defaultProps,
      onDelete: mockOnDelete
    });
    
    const deleteButton = screen.getByText(/delete/i);
    
    await act(async () => {
      await user.click(deleteButton);
    });
    
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByText(/confirm/i);
    
    await act(async () => {
      await user.click(confirmButton);
    });
    
    expect(mockOnDelete).toHaveBeenCalledWith(mockTask.id);
  });

  it('handles task without tags', () => {
    const taskWithoutTags = {
      ...mockTask,
      tags: undefined
    };
    
    renderTaskModal({
      ...defaultProps,
      task: taskWithoutTags
    });
    
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
  });

  it('handles task without due date', () => {
    const taskWithoutDueDate = {
      ...mockTask,
      due_date: undefined
    };
    
    renderTaskModal({
      ...defaultProps,
      task: taskWithoutDueDate
    });
    
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
  });

  it('renders priority dropdown', () => {
    renderTaskModal();
    
    // Priority dropdown should be rendered (medium priority)
    expect(screen.getByText(/priority/i)).toBeInTheDocument();
  });

  it('renders status dropdown', () => {
    renderTaskModal();
    
    // Status dropdown should be rendered (not_started status)
    expect(screen.getByText(/status/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    const mockOnSave = jest.fn();
    
    renderTaskModal({
      ...defaultProps,
      onSave: mockOnSave
    });
    
    const nameInput = screen.getByDisplayValue('Test Task');
    
    await act(async () => {
      await user.clear(nameInput);
    });
    
    const saveButton = screen.getByText(/save/i);
    
    await act(async () => {
      await user.click(saveButton);
    });
    
    // Should not call onSave with empty name
    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup();
    const mockOnClose = jest.fn();
    
    renderTaskModal({
      ...defaultProps,
      onClose: mockOnClose
    });
    
    // Test Escape key
    await act(async () => {
      await user.keyboard('{Escape}');
    });
    
    expect(mockOnClose).toHaveBeenCalled();
  });
});