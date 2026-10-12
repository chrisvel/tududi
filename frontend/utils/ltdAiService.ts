import { request } from './planningService';
import { Proposal } from './proposalsService';
export const features = [
    'overload',
    'small_steps',
    'decompose',
    'tomorrow',
    'weekly_priorities',
    'why',
    'review',
] as const;
export type Feature = (typeof features)[number];
export interface AiRequest {
    feature: Feature;
    date?: string;
    target_uid?: string;
    target_type?: 'goal' | 'task';
    period: 'day' | 'week';
    allow_notes: boolean;
    allow_calendar_titles: boolean;
    token_budget: number;
}
export interface Manifest {
    digest: string;
    manifest: {
        provider: string;
        model: string;
        destination: string;
        categories: string[];
        notes_included: boolean;
        calendar_titles_included: boolean;
        token_upper_bound: number;
        snapshot: {
            goals: { uid: string; title: string }[];
            tasks: { uid: string; title: string }[];
            whyChain?: { uid: string; title: string; horizon: string }[];
            [key: string]: unknown;
        };
    };
}
export interface AiResult {
    run_id: number;
    proposal: Proposal | null;
    text: { sentence?: string; summary?: string; question?: string } | null;
}
export const previewAi = (body: AiRequest) =>
    request<Manifest>('ltd-ai/manifest', 'POST', body);
export const runAi = (body: AiRequest, digest: string) =>
    request<AiResult>('ltd-ai/run', 'POST', {
        request: body,
        digest,
        consent: true,
    });
export const saveAiReview = (text: AiResult['text']) =>
    request('ltd-ai/review/save', 'POST', { text, confirm: true });

export const aiTargets = () =>
    request<{
        tasks: { uid: string; title: string }[];
        goals: { uid: string; title: string }[];
    }>('ltd-ai/targets');
