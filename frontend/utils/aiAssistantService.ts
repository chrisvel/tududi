import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

export interface PriorityAction {
    action: string;
    project: string | null;
    reason?: string;
    suggestion?: string;
}

export interface DailyBrief {
    focus: string;
    priority_actions: PriorityAction[];
    watch_out: string[];
    generated_at: string;
    model: string;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
    };
}

export interface TaskInsightsRequest {
    taskUid?: string;
    taskName: string;
    taskNote?: string;
    taskStatus?: string | number;
    taskPriority?: string | number;
    taskDueDate?: string;
    taskTags?: string[];
    subtaskCount?: number;
    projectName?: string;
    projectDescription?: string;
    projectStatus?: string;
    projectGoal?: string;
    projectArea?: string;
}

export interface TaskInsightLink {
    label: string;
    url: string;
}

export interface TaskInsights {
    insight: string;
    next_step: string;
    breakdown?: string[];
    links?: TaskInsightLink[];
    watch_out: string | null;
    generated_at: string;
    dismissed: boolean;
}

export const fetchTaskInsights = async (
    payload: TaskInsightsRequest
): Promise<TaskInsights> => {
    const response = await fetch(getApiPath('ai-assistant/task-insights'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(response, 'Failed to generate task insights.');
    return response.json();
};

export const fetchCachedTaskInsights = async (
    taskUid: string
): Promise<TaskInsights | null> => {
    const response = await fetch(
        getApiPath(`ai-assistant/task-insights/${taskUid}`),
        { method: 'GET', credentials: 'include' }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
};

export const updateTaskInsightsDismissed = async (
    taskUid: string,
    dismissed: boolean
): Promise<void> => {
    await fetch(getApiPath(`ai-assistant/task-insights/${taskUid}/dismissed`), {
        method: 'PATCH',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ dismissed }),
    });
};

export interface ProjectInsightsRequest {
    projectUid?: string;
    projectName: string;
    projectDescription?: string;
    projectStatus?: string;
    projectPriority?: number | null;
    projectDueDate?: string;
    projectGoal?: string;
    projectArea?: string;
    totalTasks?: number;
    openTasks?: number;
    completedTasks?: number;
    inProgressTasks?: number;
    overdueTaskCount?: number;
}

export interface ProjectInsights {
    insight: string;
    next_action: string;
    health: string;
    watch_out: string | null;
    generated_at: string;
    dismissed: boolean;
}

export const fetchProjectInsights = async (
    payload: ProjectInsightsRequest
): Promise<ProjectInsights> => {
    const response = await fetch(getApiPath('ai-assistant/project-insights'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(response, 'Failed to generate project insights.');
    return response.json();
};

export const fetchCachedProjectInsights = async (
    projectUid: string
): Promise<ProjectInsights | null> => {
    const response = await fetch(
        getApiPath(`ai-assistant/project-insights/${projectUid}`),
        { method: 'GET', credentials: 'include' }
    );
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
};

export const updateProjectInsightsDismissed = async (
    projectUid: string,
    dismissed: boolean
): Promise<void> => {
    await fetch(
        getApiPath(`ai-assistant/project-insights/${projectUid}/dismissed`),
        {
            method: 'PATCH',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify({ dismissed }),
        }
    );
};

export const fetchCachedBrief = async (): Promise<DailyBrief | null> => {
    const response = await fetch(getApiPath('ai-assistant/daily-brief'), {
        method: 'GET',
        credentials: 'include',
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data || null;
};

export const fetchDailyBrief = async (): Promise<DailyBrief> => {
    const response = await fetch(getApiPath('ai-assistant/daily-brief'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });
    await handleAuthResponse(response, 'Failed to generate daily brief.');
    return response.json();
};
