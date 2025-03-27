import { Metrics } from "../entities/Metrics";
import { Task } from "../entities/Task";

export const fetchTasks = async (query = ''): Promise<{ tasks: Task[]; metrics: Metrics }> => {
  const response = await fetch(`/api/tasks${query}`);
  
  if (!response.ok) throw new Error('Failed to fetch tasks.');

  const result = await response.json();
  
  if (!Array.isArray(result.tasks)) {
    throw new Error('Resulting tasks are not an array.');
  }
  
  if (!result.metrics) {
    throw new Error('Metrics data is not included.');
  }

  return { tasks: result.tasks, metrics: result.metrics };
};

export const createTask = async (taskData: Task): Promise<Task> => {
  const response = await fetch('/api/task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) throw new Error('Failed to create task.');

  return await response.json();
};

export const updateTask = async (taskId: number, taskData: Task): Promise<Task> => {
  const response = await fetch(`/api/task/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(taskData),
  });

  if (!response.ok) throw new Error('Failed to update task.');

  return await response.json();
};

export const deleteTask = async (taskId: number): Promise<void> => {
  const response = await fetch(`/api/task/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) throw new Error('Failed to delete task.');
};
