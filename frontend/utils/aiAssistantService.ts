import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

export interface AIConfig {
    api_key_set: boolean;
    // Omitted on a hosted instance: they describe the operator's own server
    // config (LLM provider/network, model choice), not the caller's.
    base_url?: string | null;
    model?: string;
}

export const fetchAIConfig = async (): Promise<AIConfig | null> => {
    const response = await fetch(getApiPath('ai-assistant/config'), {
        method: 'GET',
        credentials: 'include',
    });
    if (!response.ok) return null;
    return response.json();
};

export interface AiProviderSettings {
    ai_base_url: string | null;
    ai_model: string | null;
    ai_api_key_set: boolean;
    ai_api_key_last4: string | null;
}

export interface AiProviderSettingsUpdate {
    // Omitted leaves the stored key untouched; null/'' clears it.
    ai_api_key?: string | null;
    ai_base_url?: string | null;
    ai_model?: string | null;
}

export const fetchAiProviderSettings =
    async (): Promise<AiProviderSettings | null> => {
        const response = await fetch(getApiPath('profile/ai-settings'), {
            method: 'GET',
            credentials: 'include',
        });
        if (!response.ok) return null;
        return response.json();
    };

export const updateAiProviderSettings = async (
    payload: AiProviderSettingsUpdate
): Promise<AiProviderSettings> => {
    const response = await fetch(getApiPath('profile/ai-settings'), {
        method: 'PUT',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(
        response,
        'Failed to update AI provider settings.'
    );
    return response.json();
};

export interface PriorityAction {
    action: string;
    project: string | null;
    reason?: string;
    suggestion?: string;
    task_uid?: string | null;
    project_uid?: string | null;
}

export interface DailyBrief {
    overview?: string;
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
