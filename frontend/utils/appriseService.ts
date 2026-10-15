import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

// Apprise sends tududi notifications through a self-hosted apprise-api
// server, which fans them out to 100+ services. The server address and the
// config key are stored encrypted and are never sent back to the browser.

export interface AppriseConfig {
    configured: boolean;
    host: string | null;
    tags: string;
}

export interface AppriseConfigInput {
    url: string;
    key: string;
    tags: string;
}

const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return data.error || data.message || fallback;
};

export async function getAppriseConfig(): Promise<AppriseConfig> {
    const response = await fetch(getApiPath('apprise/config'), {
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error(
            await readError(response, 'Could not load Apprise settings')
        );
    }
    return response.json();
}

export async function saveAppriseConfig(
    input: AppriseConfigInput
): Promise<AppriseConfig> {
    const response = await fetch(getApiPath('apprise/config'), {
        method: 'PUT',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        throw new Error(
            await readError(response, 'Could not save Apprise settings')
        );
    }
    return response.json();
}

export async function removeAppriseConfig(): Promise<AppriseConfig> {
    const response = await fetch(getApiPath('apprise/config'), {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'x-csrf-token': await getCsrfToken() },
    });
    if (!response.ok) {
        throw new Error(
            await readError(response, 'Could not remove Apprise settings')
        );
    }
    return response.json();
}
