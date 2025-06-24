import { Metrics } from "../entities/Metrics";
import { Task } from "../entities/Task";
import { handleAuthResponse, getDefaultHeaders, getPostHeaders } from "./authUtils";

export const fetchTasks = async (query = ''): Promise<{ tasks: Task[]; metrics: Metrics }> => {
  const response = await fetch(`/api/tasks${query}`, {
    credentials: 'include',
    headers: getDefaultHeaders(),
  });
  await handleAuthResponse(response, 'Failed to fetch tasks.');

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
    credentials: 'include',
    headers: getPostHeaders(),
    body: JSON.stringify(taskData),
  });

  await handleAuthResponse(response, 'Failed to create task.');
  return await response.json();
};

export const updateTask = async (taskId: number, taskData: Task): Promise<Task> => {
  const response = await fetch(`/api/task/${taskId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getPostHeaders(),
    body: JSON.stringify(taskData),
  });

  await handleAuthResponse(response, 'Failed to update task.');
  return await response.json();
};

export const toggleTaskCompletion = async (taskId: number): Promise<Task> => {
  const response = await fetch(`/api/task/${taskId}/toggle_completion`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getPostHeaders(),
  });

  await handleAuthResponse(response, 'Failed to toggle task completion.');
  const result = await response.json();
  return result;
};

export const deleteTask = async (taskId: number): Promise<void> => {
  const response = await fetch(`/api/task/${taskId}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getDefaultHeaders(),
  });

  await handleAuthResponse(response, 'Failed to delete task.');
};

export const fetchTaskById = async (taskId: number): Promise<Task> => {
  const response = await fetch(`/api/task/${taskId}`, {
    credentials: 'include',
    headers: getDefaultHeaders(),
  });

  await handleAuthResponse(response, 'Failed to fetch task.');
  return await response.json();
};

export const fetchTaskByUuid = async (uuid: string): Promise<Task> => {
  const response = await fetch(`/api/task/uuid/${uuid}`, {
    credentials: 'include',
    headers: getDefaultHeaders(),
  });

  await handleAuthResponse(response, 'Failed to fetch task.');
  return await response.json();
};

export const toggleTaskToday = async (taskId: number): Promise<Task> => {
  const response = await fetch(`/api/task/${taskId}/toggle-today`, {
    method: 'PATCH',
    credentials: 'include',
    headers: getPostHeaders(),
  });

  await handleAuthResponse(response, 'Failed to toggle task today status.');
  return await response.json();
};
