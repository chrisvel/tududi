import { mutate } from 'swr';
import { Goal } from '../entities/Goal';
import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';
import { useStore } from '../store/useStore';

export interface GoalProgress {
    A: number | null;
    O: number | null;
    expected: number | null;
    health: 'on_track' | 'needs_love' | 'stalled' | null;
    achievement_suggested: boolean;
    whyChain: Goal[];
}
export interface GoalNode extends Goal {
    children: GoalNode[];
    progress: GoalProgress;
}
export interface MetricCheckin {
    uid: string;
    value: number;
    note?: string;
    recorded_at: string;
}
export interface GoalMetric {
    uid: string;
    name: string;
    unit?: string;
    baseline: number;
    target: number;
    direction: 'increase' | 'decrease';
    current_value: number;
    weight: number;
    source: 'manual' | 'habit' | 'task_count';
    checkins?: MetricCheckin[];
}
export interface JournalEntry {
    uid: string;
    operation?: string;
    op?: string;
    entity_type: string;
    entity_uid?: string;
    created_at: string;
    reverted_at?: string | null;
}
export const request = async <T>(
    path: string,
    method = 'GET',
    body?: unknown
): Promise<T> => {
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers:
            method === 'GET'
                ? { Accept: 'application/json' }
                : await getPostHeadersWithCsrf(),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    await handleAuthResponse(response, 'Unable to update planning.');
    return response.status === 204 ? (undefined as T) : response.json();
};
export const planningKeys = {
    tree: 'ltd:tree',
    journal: 'ltd:journal',
    progress: (uid: string) => `ltd:progress:${uid}`,
    metrics: (uid: string) => `ltd:metrics:${uid}`,
};
export const fetchGoalTree = () => request<{ goals: GoalNode[] }>('goals/tree');
export const fetchGoalProgress = (uid: string) =>
    request<GoalProgress>(`goals/${uid}/progress`);
export const fetchGoalMetrics = (uid: string) =>
    request<{ metrics: GoalMetric[] }>(`goals/${uid}/metrics`);
export const saveGoalMetric = (goalUid: string, metric: Partial<GoalMetric>) =>
    request(
        metric.uid ? `metrics/${metric.uid}` : `goals/${goalUid}/metrics`,
        metric.uid ? 'PATCH' : 'POST',
        metric
    );
export const deleteGoalMetric = (uid: string) =>
    request(`metrics/${uid}`, 'DELETE');
export const checkinMetric = (uid: string, value: number, note: string) =>
    request(`metrics/${uid}/checkins`, 'POST', { value, note });
export const fetchJournal = () =>
    request<{ entries: JournalEntry[] }>('journal');
export const revertJournal = (uid: string) =>
    request(`journal/${uid}/revert`, 'POST');
export const revertJournalGroup = (uids: string[]) =>
    request('journal/revert', 'POST', { uids });
export const fetchTaskWhyChain = (uid: string) =>
    request<{ whyChain: Goal[] }>(`tasks/${uid}/why-chain`);
export const refreshPlanning = async () => {
    await Promise.all([
        mutate((key) => typeof key === 'string' && key.startsWith('ltd:')),
        useStore.getState().goalsStore.loadGoals(true),
    ]);
};
export const flattenGoals = (nodes: GoalNode[]): GoalNode[] =>
    nodes.flatMap((node) => [node, ...flattenGoals(node.children)]);
