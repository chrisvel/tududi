import { Metrics } from '../entities/Metrics';
import { Task } from '../entities/Task';
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeaders,
} from './authUtils';

export interface GroupedTasks {
    [groupName: string]: Task[];
}

export const fetchTasks = async (
    query = ''
): Promise<{
    tasks: Task[];
    metrics: Metrics;
    groupedTasks?: GroupedTasks;
}> => {
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

    return {
        tasks: result.tasks,
        metrics: result.metrics,
        groupedTasks: result.groupedTasks,
    };
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

export const updateTask = async (
    taskId: number,
    taskData: Task
): Promise<Task> => {
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

export const fetchTaskByUid = async (uid: string): Promise<Task> => {
    const response = await fetch(`/api/task?uid=${encodeURIComponent(uid)}`, {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch task.');
    return await response.json();
};

export const fetchSubtasks = async (parentTaskId: number): Promise<Task[]> => {
    const response = await fetch(`/api/task/${parentTaskId}/subtasks`, {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch subtasks.');
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

export interface TaskIteration {
    date: string;
    utc_date: string;
}

export const fetchTaskNextIterations = async (
    taskId: number,
    startFromDate?: string
): Promise<TaskIteration[]> => {
    const url = startFromDate
        ? `/api/task/${taskId}/next-iterations?startFromDate=${startFromDate}`
        : `/api/task/${taskId}/next-iterations`;

    const response = await fetch(url, {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch task iterations.');
    const result = await response.json();
    return result.iterations || [];
};
