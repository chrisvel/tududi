import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

// Records that the brain dump is done with, whether the person planned a
// day or skipped it. The server keeps the first time it was called.
export const completeOnboarding = async (): Promise<{
    onboarded_at: string;
}> => {
    const response = await fetch(getApiPath('onboarding/complete'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });
    await handleAuthResponse(response, 'Failed to finish the welcome screen.');
    return response.json();
};

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

// Records the welcome page as seen. The welcome page sends the "empty"
// starter, which creates nothing; the same endpoint accepts a full starter
// (areas, habits, note) for API clients that want to seed an account.
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
