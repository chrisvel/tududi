import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export interface AdminAiUsageUser {
    id: number;
    email: string;
    name?: string | null;
    plan: string;
    ai_credits_used_this_month: number;
    ai_credits_limit: number | null;
    ai_credits_remaining: number | null;
}

export interface AdminAiUsageList {
    summary: { total_credits_used_this_month: number };
    total: number;
    users: AdminAiUsageUser[];
}

export const fetchAdminAiUsage = async (
    q = '',
    page = 1
): Promise<AdminAiUsageList> => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    const response = await fetch(getApiPath(`admin/ai-usage?${params}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load AI usage.');
    return response.json();
};
