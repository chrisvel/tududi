import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';
import { fetchWithCsrf } from './csrfService';

export interface FeedbackEntry {
    id: number;
    message: string;
    page_url: string | null;
    user_agent: string | null;
    app_version: string | null;
    resolved_at: string | null;
    created_at: string;
    user: { uid: string; email: string; name: string } | null;
}

export type FeedbackStatus = 'open' | 'resolved' | 'all';

export interface FeedbackPage {
    total: number;
    open: number;
    feedback: FeedbackEntry[];
}

export const submitFeedback = async (payload: {
    message: string;
    page_url?: string;
    app_version?: string;
}): Promise<void> => {
    const response = await fetchWithCsrf(getApiPath('feedback'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(response, 'Failed to send feedback.');
};

export const fetchFeedback = async (
    { status = 'open', limit = 50, offset = 0 } = {} as {
        status?: FeedbackStatus;
        limit?: number;
        offset?: number;
    }
): Promise<FeedbackPage> => {
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    if (status !== 'all') params.set('status', status);
    const response = await fetch(getApiPath(`admin/feedback?${params}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load feedback.');
    return response.json();
};

export const setFeedbackResolved = async (
    id: number,
    resolved: boolean
): Promise<{ id: number; resolved_at: string | null }> => {
    const response = await fetchWithCsrf(getApiPath(`admin/feedback/${id}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ resolved }),
    });
    await handleAuthResponse(response, 'Failed to update feedback.');
    return response.json();
};

export const deleteFeedback = async (id: number): Promise<void> => {
    const response = await fetchWithCsrf(getApiPath(`admin/feedback/${id}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to delete feedback.');
};
