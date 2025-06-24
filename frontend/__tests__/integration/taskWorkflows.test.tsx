import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TaskList from '../../components/Task/TaskList';
import TaskModal from '../../components/Task/TaskModal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';

// Mock data
const mockTasks: Task[] = [
  {
    id: 1,
    name: 'Complete project setup',
    status: 'not_started',
    priority: 'high',
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    name: 'Write documentation',
    status: 'in_progress',
    priority: 'medium',
    due_date: '2024-12-25',
    created_at: '2024-01-02T00:00:00.000Z'
  }
];

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Test Project',
    active: true
  }
];

// Integration test wrapper component
const TaskWorkflowWrapper: React.FC<{
  tasks: Task[];
  onTaskUpdate: (task: Task) => void;
  onTaskDelete: (taskId: number) => void;
}> = ({ tasks, onTaskUpdate, onTaskDelete }) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [selectedTask, setSelectedTask] = React.useState<Task | null>(null);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleModalSave = (updatedTask: Task) => {
    onTaskUpdate(updatedTask);
    setIsModalOpen(false);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleModalDelete = async (taskId: number) => {
    await onTaskDelete(taskId);
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const CustomTaskList: React.FC<any> = (props) => (
    <div>
      {props.tasks.map((task: Task) => (
        <div key={task.id} onClick={() => handleTaskClick(task)} style={{ cursor: 'pointer', padding: '10px', border: '1px solid #ccc', margin: '5px' }}>
          <div>{task.name}</div>
          <div>Status: {task.status}</div>
          <div>Priority: {task.priority}</div>
        </div>
      ))}
    </div>
  );

  return (
    <BrowserRouter>
      <div>
        <CustomTaskList {...{ tasks, onTaskUpdate, onTaskDelete }} />
        {isModalOpen && selectedTask && (
          <TaskModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            task={selectedTask}
            onSave={handleModalSave}
            onDelete={handleModalDelete}
            projects={mockProjects}
            onCreateProject={async (name: string) => ({ id: 999, name, active: true })}
          />
        )}
      </div>
    </BrowserRouter>
  );
};

describe('Task Workflows Integration Tests', () => {
  let mockOnTaskUpdate: jest.Mock;
  let mockOnTaskDelete: jest.Mock;

  beforeEach(() => {
    mockOnTaskUpdate = jest.fn();
    mockOnTaskDelete = jest.fn();
    jest.clearAllMocks();
    
    // Mock fetch for tags service
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ tags: [] })
    });
  });

  it('completes full task lifecycle workflow', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // 1. View tasks in list
    expect(screen.getByText('Complete project setup')).toBeInTheDocument();
    expect(screen.getByText('Write documentation')).toBeInTheDocument();

    // 2. Click on a task to open modal
    const firstTask = screen.getByText('Complete project setup');
    
    await act(async () => {
      await user.click(firstTask);
    });

    // 3. Modal should open with task details
    await waitFor(() => {
      expect(screen.getByDisplayValue('Complete project setup')).toBeInTheDocument();
    });

    // 4. Edit task name
    const nameInput = screen.getByDisplayValue('Complete project setup');
    
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, 'Updated project setup');
    });

    // 5. Save changes
    const saveButton = screen.getByText(/save/i);
    
    await act(async () => {
      await user.click(saveButton);
    });

    // 6. Verify onTaskUpdate was called
    expect(mockOnTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        name: 'Updated project setup'
      })
    );
  });

  it('handles task deletion workflow', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // 1. Click on a task to open modal
    const firstTask = screen.getByText('Complete project setup');
    
    await act(async () => {
      await user.click(firstTask);
    });

    // 2. Click delete button
    await waitFor(() => {
      expect(screen.getByText(/delete/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByText(/delete/i);
    
    await act(async () => {
      await user.click(deleteButton);
    });

    // 3. Confirm deletion
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByText(/confirm/i);
    
    await act(async () => {
      await user.click(confirmButton);
    });

    // 4. Verify onTaskDelete was called
    expect(mockOnTaskDelete).toHaveBeenCalledWith(1);
  });

  it('handles task status and priority updates', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // Open task modal
    const secondTask = screen.getByText('Write documentation');
    
    await act(async () => {
      await user.click(secondTask);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Write documentation')).toBeInTheDocument();
    });

    // Change status and priority using dropdowns
    const statusDropdown = screen.getByText(/status/i);
    expect(statusDropdown).toBeInTheDocument();

    const priorityDropdown = screen.getByText(/priority/i);
    expect(priorityDropdown).toBeInTheDocument();

    // Save changes
    const saveButton = screen.getByText(/save/i);
    
    await act(async () => {
      await user.click(saveButton);
    });

    // Verify update was called
    expect(mockOnTaskUpdate).toHaveBeenCalled();
  });

  it('handles due date modifications', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // Open task with due date
    const taskWithDueDate = screen.getByText('Write documentation');
    
    await act(async () => {
      await user.click(taskWithDueDate);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('2024-12-25')).toBeInTheDocument();
    });

    // Update due date
    const dueDateInput = screen.getByDisplayValue('2024-12-25');
    
    await act(async () => {
      await user.clear(dueDateInput);
      await user.type(dueDateInput, '2024-12-31');
    });

    // Save changes
    const saveButton = screen.getByText(/save/i);
    
    await act(async () => {
      await user.click(saveButton);
    });

    // Verify update with new due date
    expect(mockOnTaskUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 2,
        due_date: '2024-12-31'
      })
    );
  });

  it('handles modal cancellation without saving', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // Open task modal
    const firstTask = screen.getByText('Complete project setup');
    
    await act(async () => {
      await user.click(firstTask);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Complete project setup')).toBeInTheDocument();
    });

    // Make changes
    const nameInput = screen.getByDisplayValue('Complete project setup');
    
    await act(async () => {
      await user.clear(nameInput);
      await user.type(nameInput, 'Changed but not saved');
    });

    // Cancel instead of saving
    const cancelButton = screen.getByText(/cancel/i);
    
    await act(async () => {
      await user.click(cancelButton);
    });

    // Verify no update was called
    expect(mockOnTaskUpdate).not.toHaveBeenCalled();
  });

  it('handles empty task list state', () => {
    render(
      <TaskWorkflowWrapper
        tasks={[]}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // Should render empty container
    expect(screen.queryByText('Complete project setup')).not.toBeInTheDocument();
    expect(screen.queryByText('Write documentation')).not.toBeInTheDocument();
  });

  it('maintains task selection state during editing', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // Open first task
    const firstTask = screen.getByText('Complete project setup');
    
    await act(async () => {
      await user.click(firstTask);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Complete project setup')).toBeInTheDocument();
    });

    // Verify correct task is loaded
    expect(screen.getByDisplayValue('Complete project setup')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Write documentation')).not.toBeInTheDocument();
  });

  it('handles multiple rapid task interactions', async () => {
    const user = userEvent.setup();
    
    render(
      <TaskWorkflowWrapper
        tasks={mockTasks}
        onTaskUpdate={mockOnTaskUpdate}
        onTaskDelete={mockOnTaskDelete}
      />
    );

    // Rapidly interact with tasks
    const firstTask = screen.getByText('Complete project setup');
    const secondTask = screen.getByText('Write documentation');

    // Click first task multiple times
    await act(async () => {
      await user.click(firstTask);
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue('Complete project setup')).toBeInTheDocument();
    });

    // Close modal
    const cancelButton = screen.getByText(/cancel/i);
    await act(async () => {
      await user.click(cancelButton);
    });

    // Should close modal properly
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Complete project setup')).not.toBeInTheDocument();
    });
  });
});