import { Task } from '../entities/Task';
import {
    handleAuthResponse,
    getDefaultHeaders,
    getPostHeadersWithCsrf,
} from './authUtils';
import { getApiPath } from '../config/paths';

export interface DailyPlanItem {
    task_uid: string;
    position: number;
    start_minute: number | null;
    duration_minutes: number;
    task: Task;
}

export interface DailyPlan {
    uid: string;
    date: string;
    started_at: string | null;
    items: DailyPlanItem[];
}

export interface DailyPlanResponse {
    date: string;
    plan: DailyPlan | null;
}

export interface InboxCandidate {
    uid: string;
    title: string | null;
    content: string;
    created_at: string;
}

export interface PlanCandidates {
    in_progress: Task[];
    overdue: Task[];
    due_today: Task[];
    suggested: Task[];
    inbox: InboxCandidate[];
    inbox_count: number;
}

export interface PlanItemInput {
    task_uid: string;
    start_minute: number | null;
    duration_minutes: number;
}

export const fetchDailyPlan = async (
    date?: string
): Promise<DailyPlanResponse> => {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const response = await fetch(getApiPath(`daily-plan${query}`), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to load the day plan.');
    return response.json();
};

export const fetchPlanCandidates = async (): Promise<PlanCandidates> => {
    const response = await fetch(getApiPath('daily-plan/candidates'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to load tasks to plan.');
    return response.json();
};

export const saveDailyPlanItems = async (
    date: string,
    items: PlanItemInput[]
): Promise<DailyPlanResponse> => {
    const response = await fetch(
        getApiPath(`daily-plan/${encodeURIComponent(date)}`),
        {
            method: 'PUT',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify({ items }),
        }
    );
    await handleAuthResponse(response, 'Failed to save the day plan.');
    return response.json();
};

export const startDailyPlan = async (
    date: string
): Promise<DailyPlanResponse> => {
    const response = await fetch(
        getApiPath(`daily-plan/${encodeURIComponent(date)}/start`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Failed to start the day.');
    return response.json();
};

export const clearDailyPlan = async (
    date: string
): Promise<DailyPlanResponse> => {
    const response = await fetch(
        getApiPath(`daily-plan/${encodeURIComponent(date)}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Failed to clear the day plan.');
    return response.json();
};

export const toPlanItemInputs = (items: DailyPlanItem[]): PlanItemInput[] =>
    items.map((item) => ({
        task_uid: item.task_uid,
        start_minute: item.start_minute,
        duration_minutes: item.duration_minutes,
    }));
