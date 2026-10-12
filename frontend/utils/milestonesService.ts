// Life-to-Day (T-602): client for /api/milestones (T-601).
import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export type MilestonePrecision = 'day' | 'month' | 'year';
export type MilestoneKind = 'life_event' | 'goal_milestone';

export interface Milestone {
    uid: string;
    title: string;
    date: string; // ISO Gregorian YYYY-MM-DD
    date_precision: MilestonePrecision;
    kind: MilestoneKind;
    goal_uid: string | null;
    note: string | null;
    color: string | null;
}

export type MilestoneInput = Partial<Omit<Milestone, 'uid'>>;

export const fetchMilestones = async (
    from?: string,
    to?: string
): Promise<Milestone[]> => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    const response = await fetch(
        getApiPath(`milestones${query ? `?${query}` : ''}`),
        { credentials: 'include', headers: { Accept: 'application/json' } }
    );
    await handleAuthResponse(response, 'Failed to fetch milestones.');
    return (await response.json()).milestones;
};

const send = async (
    method: 'POST' | 'PATCH',
    path: string,
    data: MilestoneInput
): Promise<Milestone> => {
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(data),
    });
    await handleAuthResponse(response, 'Failed to save milestone.');
    return (await response.json()).milestone;
};

export const createMilestone = (data: MilestoneInput) =>
    send('POST', 'milestones', data);

export const updateMilestone = (uid: string, data: MilestoneInput) =>
    send('PATCH', `milestones/${uid}`, data);

export const deleteMilestone = async (
    uid: string
): Promise<{ journal_uid: string }> => {
    const response = await fetch(getApiPath(`milestones/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
    });
    await handleAuthResponse(response, 'Failed to delete milestone.');
    return response.json();
};
