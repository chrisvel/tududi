import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

export interface StarterResult {
    onboarding_starter: string;
    onboarded_at: string;
    created: {
        areas: number;
        goals: number;
        projects: number;
        tasks: number;
        habits: number;
        notes: number;
    };
}

// Records the welcome page as seen. The page sends the "empty" starter,
// which creates nothing; the same endpoint accepts a full starter (areas,
// habits, note) for API clients that want to seed an account.
export const applyStarter = async (payload: {
    key: string;
}): Promise<StarterResult> => {
    const response = await fetch(getApiPath('onboarding/starter'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(response, 'Failed to finish the welcome page.');
    return response.json();
};
