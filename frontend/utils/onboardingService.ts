import { getApiPath } from '../config/paths';
import { getPostHeadersWithCsrf, handleAuthResponse } from './authUtils';

// Records that the welcome screen is done with, whether the person planned
// a day or skipped it. The server keeps the first time it was called.
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
