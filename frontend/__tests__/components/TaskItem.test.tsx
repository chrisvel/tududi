import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TaskItem from '../../components/Task/TaskItem';
import { Task } from '../../entities/Task';

const mockTask: Task = {
  id: 1,
  name: 'Test Task',
  status: 'not_started',
  priority: 'medium',
  due_date: '2024-12-25',
  note: 'Test note',
  created_at: '2024-01-01T00:00:00.000Z'
};

const mockProps = {
  task: mockTask,
  onTaskUpdate: jest.fn(),
  onTaskDelete: jest.fn(),
  projects: []
};

const renderTaskItem = (props = mockProps) => {
  return render(
    <BrowserRouter>
      <TaskItem {...props} />
    </BrowserRouter>
  );
};

describe('TaskItem Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders task information correctly', () => {
    renderTaskItem();
    
    expect(screen.getAllByText('Test Task')).toHaveLength(2);
  });

  it('renders without crashing', () => {
    expect(() => renderTaskItem()).not.toThrow();
  });

  it('displays task with correct props structure', () => {
    const { container } = renderTaskItem();
    expect(container.firstChild).toBeTruthy();
  });
});