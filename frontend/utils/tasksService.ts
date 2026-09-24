import { Metrics } from '../entities/Metrics';
import { Task, TaskRelation, TaskRelationType } from '../entities/Task';
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';
import { isTaskDone, TASK_STATUS } from '../constants/taskStatus';
import { refreshTagCountsIfTagsChanged } from './tagsService';

export interface GroupedTasks {
    [groupName: string]: Task[];
}

export const fetchTasks = async (
    query = ''
): Promise<{
    tasks: Task[];
    metrics: Metrics;
    groupedTasks?: GroupedTasks;
    tasks_in_progress?: Task[];
    tasks_today_plan?: Task[];
    tasks_due_today?: Task[];
    tasks_overdue?: Task[];
    suggested_tasks?: Task[];
    tasks_completed_today?: Task[];
    pagination?: {
        total: number;
        limit: number;
        offset: number;
        hasMore: boolean;
    };
}> => {
    // For today view, include dashboard task lists
    const includeLists = query.includes('type=today');
    const tasksQuery =
        includeLists && !query.includes('include_lists')
            ? `${query}${query.includes('?') ? '&' : '?'}include_lists=true`
            : query;

    // Fetch tasks and metrics in parallel for better performance
    const [tasksResponse, metricsResponse] = await Promise.all([
        fetch(getApiPath(`tasks${tasksQuery}`), {
            credentials: 'include',
            headers: getDefaultHeaders(),
        }),
        fetch(getApiPath('tasks/metrics'), {
            credentials: 'include',
            headers: getDefaultHeaders(),
        }),
    ]);

    await handleAuthResponse(tasksResponse, 'Failed to fetch tasks.');
    await handleAuthResponse(metricsResponse, 'Failed to fetch metrics.');

    const tasksResult = await tasksResponse.json();
    const metrics = await metricsResponse.json();

    if (!Array.isArray(tasksResult.tasks)) {
        throw new Error('Resulting tasks are not an array.');
    }

    return {
        tasks: tasksResult.tasks,
        metrics: metrics,
        groupedTasks: tasksResult.groupedTasks,
        // Dashboard task lists (only present when include_lists=true)
        tasks_in_progress: tasksResult.tasks_in_progress,
        tasks_today_plan: tasksResult.tasks_today_plan,
        tasks_due_today: tasksResult.tasks_due_today,
        tasks_overdue: tasksResult.tasks_overdue,
        suggested_tasks: tasksResult.suggested_tasks,
        tasks_completed_today: tasksResult.tasks_completed_today,
        // Pagination metadata
        pagination: tasksResult.pagination,
    };
};

export const createTask = async (taskData: Task): Promise<Task> => {
    const response = await fetch(getApiPath('task'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(taskData),
    });

    await handleAuthResponse(response, 'Failed to create task.');
    const created = await response.json();
    refreshTagCountsIfTagsChanged(taskData);
    return created;
};

export const updateTask = async (
    taskUid: string,
    taskData: Partial<Task>
): Promise<Task> => {
    // Use original_name to prevent display name (e.g. "Monthly", "Daily")
    // from overwriting the real task name in the database
    const payload = { ...taskData };
    if (payload.original_name && payload.name !== undefined) {
        payload.name = payload.original_name;
    }

    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}`),
        {
            method: 'PATCH',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify(payload),
        }
    );

    await handleAuthResponse(response, 'Failed to update task.');
    const updated = await response.json();
    refreshTagCountsIfTagsChanged(taskData);
    return updated;
};

export const toggleTaskCompletion = async (
    taskUid: string,
    currentTask?: Task
): Promise<Task> => {
    const task = currentTask ?? (await fetchTaskByUid(taskUid));

    // Handle habits differently - log completion instead of marking as done
    if (task.habit_mode) {
        const { logHabitCompletion } = await import('./habitsService');
        const result = await logHabitCompletion(taskUid);
        return result.task;
    }

    const newStatus = isTaskDone(task.status)
        ? task.note
            ? TASK_STATUS.IN_PROGRESS
            : TASK_STATUS.NOT_STARTED
        : TASK_STATUS.DONE;

    if (process.env.NODE_ENV === 'development') {
        console.log('[toggleTaskCompletion]', {
            taskUid,
            oldStatus: task.status,
            newStatus,
            oldCompletedAt: task.completed_at,
        });
    }

    const result = await updateTask(taskUid, { status: newStatus });

    if (process.env.NODE_ENV === 'development') {
        console.log('[toggleTaskCompletion] result', {
            taskUid,
            status: result.status,
            completed_at: result.completed_at,
        });
    }

    return result;
};

export const deleteTask = async (taskUid: string): Promise<void> => {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );

    // A task that is already gone on the server is in the state the caller
    // asked for. Treating 404 as success lets stale rows (e.g. left behind by
    // an interrupted CalDAV sync) be cleared from the UI instead of failing
    // every delete attempt.
    if (response.status === 404) {
        return;
    }

    await handleAuthResponse(response, 'Failed to delete task.');
    refreshTagCountsIfTagsChanged();
};

export const fetchTaskById = async (taskId: number): Promise<Task> => {
    const response = await fetch(getApiPath(`task/${taskId}`), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch task.');
    return await response.json();
};

export const fetchTaskByUid = async (uid: string): Promise<Task> => {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(uid)}`),
        {
            credentials: 'include',
            headers: getDefaultHeaders(),
        }
    );

    await handleAuthResponse(response, 'Failed to fetch task.');
    return await response.json();
};

export const fetchSubtasks = async (parentTaskUid: string): Promise<Task[]> => {
    const response = await fetch(getApiPath(`task/${parentTaskUid}/subtasks`), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch subtasks.');
    return await response.json();
};

export interface TaskIteration {
    date: string;
    utc_date: string;
}

export const fetchTaskNextIterations = async (
    taskUid: string,
    startFromDate?: string
): Promise<TaskIteration[]> => {
    const url = startFromDate
        ? getApiPath(
              `task/${taskUid}/next-iterations?startFromDate=${startFromDate}`
          )
        : getApiPath(`task/${taskUid}/next-iterations`);

    const response = await fetch(url, {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });

    await handleAuthResponse(response, 'Failed to fetch task iterations.');
    const result = await response.json();
    return result.iterations || [];
};

export const fetchTaskRelations = async (
    taskUid: string
): Promise<TaskRelation[]> => {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}/relations`),
        {
            credentials: 'include',
            headers: getDefaultHeaders(),
        }
    );

    await handleAuthResponse(response, 'Failed to fetch task relations.');
    const data = await response.json();
    return data.relations || [];
};

export const createTaskRelation = async (
    taskUid: string,
    targetUid: string,
    type: TaskRelationType
): Promise<TaskRelation> => {
    const response = await fetch(
        getApiPath(`task/${encodeURIComponent(taskUid)}/relations`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify({ target_uid: targetUid, type }),
        }
    );

    await handleAuthResponse(response, 'Failed to add relation.');
    return await response.json();
};

export const deleteTaskRelation = async (
    taskUid: string,
    relationUid: string
): Promise<void> => {
    const response = await fetch(
        getApiPath(
            `task/${encodeURIComponent(taskUid)}/relations/${encodeURIComponent(relationUid)}`
        ),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );

    await handleAuthResponse(response, 'Failed to remove relation.');
};
