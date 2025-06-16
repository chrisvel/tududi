import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TaskList from '../../components/Task/TaskList';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';

const mockTasks: Task[] = [
  {
    id: 1,
    name: 'First Task',
    status: 'not_started',
    priority: 'high',
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    name: 'Second Task',
    status: 'in_progress',
    priority: 'medium',
    due_date: '2024-12-25',
    created_at: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 3,
    name: 'Third Task',
    status: 'done',
    priority: 'low',
    note: 'Completed task',
    created_at: '2024-01-01T00:00:00.000Z'
  }
];

const mockProjects: Project[] = [
  {
    id: 1,
    name: 'Test Project',
    active: true
  }
];

const mockProps = {
  tasks: mockTasks,
  onTaskUpdate: jest.fn(),
  onTaskDelete: jest.fn(),
  projects: mockProjects
};

const renderTaskList = (props = mockProps) => {
  return render(
    <BrowserRouter>
      <TaskList {...props} />
    </BrowserRouter>
  );
};

describe('TaskList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all tasks when tasks are provided', () => {
    renderTaskList();
    
    expect(screen.getAllByText(/First Task|Second Task|Third Task/)).toHaveLength(6); // Each task appears twice in TaskItem
  });

  it('renders individual task items with correct props', () => {
    renderTaskList();
    
    // Check that all task names are rendered
    expect(screen.getAllByText('First Task')).toHaveLength(2);
    expect(screen.getAllByText('Second Task')).toHaveLength(2);
    expect(screen.getAllByText('Third Task')).toHaveLength(2);
  });

  it('displays empty state when no tasks are provided', () => {
    renderTaskList({
      ...mockProps,
      tasks: []
    });
    
    expect(screen.getByText('No tasks available.')).toBeInTheDocument();
  });

  it('renders with different task statuses', () => {
    renderTaskList();
    
    // Tasks with different statuses should all be rendered
    const taskElements = screen.getAllByText(/First Task|Second Task|Third Task/);
    expect(taskElements.length).toBeGreaterThan(0);
  });

  it('passes correct props to TaskItem components', () => {
    const customProps = {
      tasks: [mockTasks[0]],
      onTaskUpdate: jest.fn(),
      onTaskDelete: jest.fn(),
      projects: mockProjects
    };
    
    renderTaskList(customProps);
    
    // Should render the task
    expect(screen.getAllByText('First Task')).toHaveLength(2);
  });

  it('handles tasks with different priorities', () => {
    const tasksWithDifferentPriorities: Task[] = [
      { ...mockTasks[0], priority: 'high' },
      { ...mockTasks[1], priority: 'medium' },
      { ...mockTasks[2], priority: 'low' }
    ];
    
    renderTaskList({
      ...mockProps,
      tasks: tasksWithDifferentPriorities
    });
    
    // All tasks should be rendered regardless of priority
    expect(screen.getAllByText(/First Task|Second Task|Third Task/)).toHaveLength(6);
  });

  it('handles tasks with and without due dates', () => {
    const tasksWithMixedDueDates: Task[] = [
      { ...mockTasks[0] }, // No due date
      { ...mockTasks[1], due_date: '2024-12-25' }, // With due date
      { ...mockTasks[2], due_date: undefined } // Explicitly no due date
    ];
    
    renderTaskList({
      ...mockProps,
      tasks: tasksWithMixedDueDates
    });
    
    // All tasks should render
    expect(screen.getAllByText(/First Task|Second Task|Third Task/)).toHaveLength(6);
  });

  it('renders without crashing when projects array is empty', () => {
    renderTaskList({
      ...mockProps,
      projects: []
    });
    
    expect(screen.getAllByText(/First Task|Second Task|Third Task/)).toHaveLength(6);
  });

  it('maintains component structure with single task', () => {
    renderTaskList({
      ...mockProps,
      tasks: [mockTasks[0]]
    });
    
    expect(screen.getAllByText('First Task')).toHaveLength(2);
    expect(screen.queryByText('No tasks available.')).not.toBeInTheDocument();
  });

  it('renders correctly with large number of tasks', () => {
    const manyTasks: Task[] = Array.from({ length: 50 }, (_, index) => ({
      id: index + 1,
      name: `Task ${index + 1}`,
      status: 'not_started' as const,
      priority: 'medium' as const,
      created_at: '2024-01-01T00:00:00.000Z'
    }));
    
    renderTaskList({
      ...mockProps,
      tasks: manyTasks
    });
    
    // Should render all tasks
    expect(screen.getAllByText(/Task \d+/)).toHaveLength(100); // Each task appears twice
  });
});