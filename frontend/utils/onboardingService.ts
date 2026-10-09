import { getApiPath } from '../config/paths';
import {
    getDefaultHeaders,
    getPostHeadersWithCsrf,
    handleAuthResponse,
} from './authUtils';
import type { StarterPayload } from './starters';

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

// Applies a starter from the welcome screen and saves the choice. "empty"
// saves the choice and creates nothing.
export const applyStarter = async (
    payload: StarterPayload | { key: 'empty' }
): Promise<StarterResult> => {
    const response = await fetch(getApiPath('onboarding/starter'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(payload),
    });
    await handleAuthResponse(response, 'Failed to set up the starter.');
    return response.json();
};

export const fetchExampleCount = async (): Promise<number> => {
    const response = await fetch(getApiPath('onboarding/examples'), {
        credentials: 'include',
        headers: getDefaultHeaders(),
    });
    await handleAuthResponse(response, 'Failed to load examples.');
    const data = await response.json();
    return data.count ?? 0;
};

export const removeExamples = async (): Promise<number> => {
    const response = await fetch(getApiPath('onboarding/examples'), {
        method: 'DELETE',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });
    await handleAuthResponse(response, 'Failed to remove the examples.');
    const data = await response.json();
    return data.removed ?? 0;
};
