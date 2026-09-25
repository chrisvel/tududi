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

export interface AiWrapUp {
    summary: string;
    wins: string[];
    carry_over: { task_uid: string; name?: string; reason: string }[];
    pattern: string;
    generated_at: string;
}

export interface DailyPlan {
    uid: string;
    date: string;
    started_at: string | null;
    ai_wrap_up?: AiWrapUp | null;
    items: DailyPlanItem[];
}

export interface AiDraftItem {
    task_uid: string;
    start_minute: number | null;
    duration_minutes: number;
    reason: string;
    task: Task;
}

export interface AiDraft {
    date: string;
    mode: 'fill' | 'replace';
    summary: string;
    items: AiDraftItem[];
    skipped: { task_uid: string; name: string; reason: string }[];
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
    // Task uids in the user's ranking order (Profile > Planning).
    ranked?: string[];
}

export type RankingGroup =
    'overdue' | 'due_today' | 'in_progress' | 'suggested';
export type RankingBucket = `${RankingGroup}:${'project' | 'none'}`;

export interface PlanRanking {
    order: RankingBucket[];
    default_order: RankingBucket[];
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

export const fetchPlanRanking = async (): Promise<PlanRanking> => {
    const response = await fetch(getApiPath('daily-plan/ranking'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to load the planning order.');
    return response.json();
};

export const savePlanRanking = async (
    order: RankingBucket[]
): Promise<PlanRanking> => {
    const response = await fetch(getApiPath('daily-plan/ranking'), {
        method: 'PUT',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ order }),
    });
    await handleAuthResponse(response, 'Failed to save the planning order.');
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

export const draftDayWithAi = async (
    date: string,
    mode: 'fill' | 'replace'
): Promise<AiDraft> => {
    const response = await fetch(getApiPath('daily-plan/ai/draft'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ date, mode }),
    });
    await handleAuthResponse(response, 'Could not draft the day.');
    return response.json();
};

export const estimateWithAi = async (
    taskUids: string[]
): Promise<Record<string, number>> => {
    const response = await fetch(getApiPath('daily-plan/ai/estimates'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ task_uids: taskUids }),
    });
    await handleAuthResponse(response, 'Could not estimate the tasks.');
    const body: { estimates: { task_uid: string; minutes: number }[] } =
        await response.json();
    return Object.fromEntries(
        body.estimates.map((e) => [e.task_uid, e.minutes])
    );
};

export const wrapUpDayWithAi = async (
    date: string
): Promise<{ date: string; wrap_up: AiWrapUp }> => {
    const response = await fetch(
        getApiPath(`daily-plan/${encodeURIComponent(date)}/ai/wrap-up`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Could not wrap up the day.');
    return response.json();
};

export const carryOverTasks = async (
    date: string,
    taskUids: string[]
): Promise<DailyPlanResponse> => {
    const response = await fetch(
        getApiPath(`daily-plan/${encodeURIComponent(date)}/carry-over`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify({ task_uids: taskUids }),
        }
    );
    await handleAuthResponse(response, 'Could not add the tasks.');
    return response.json();
};
