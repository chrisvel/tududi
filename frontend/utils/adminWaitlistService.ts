import { handleAuthResponse } from './authUtils';
import { getApiPath } from '../config/paths';

export interface WaitlistEntry {
    id: number;
    email: string;
    source: string;
    locale: string | null;
    submission_count: number;
    created_at: string;
}

export interface WaitlistPage {
    total: number;
    subscribers: WaitlistEntry[];
}

export const fetchWaitlist = async (
    { q = '', limit = 50, offset = 0 } = {} as {
        q?: string;
        limit?: number;
        offset?: number;
    }
): Promise<WaitlistPage> => {
    const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
    });
    if (q) params.set('q', q);
    const response = await fetch(getApiPath(`admin/waitlist?${params}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load the waitlist.');
    return response.json();
};

// The export is the whole list, not the page on screen, so it goes through
// the server rather than the rows already fetched.
export const downloadWaitlistCsv = async (): Promise<void> => {
    const response = await fetch(getApiPath('admin/waitlist/export'), {
        credentials: 'include',
    });
    await handleAuthResponse(response, 'Failed to export the waitlist.');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
};
