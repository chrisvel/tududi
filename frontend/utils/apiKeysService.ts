import { getApiPath } from '../config/paths';

export interface ApiKeySummary {
    id: number;
    name: string;
    token_prefix: string;
    created_at: string;
    updated_at: string;
    last_used_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
}

export interface CreateApiKeyResponse {
    token: string;
    apiKey: ApiKeySummary;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Request failed';
        throw new Error(message);
    }
    return (await response.json()) as T;
}

export async function fetchApiKeys(): Promise<ApiKeySummary[]> {
    const response = await fetch(getApiPath('profile/api-keys'), {
        credentials: 'include',
    });
    return handleResponse<ApiKeySummary[]>(response);
}

export async function createApiKey(payload: {
    name: string;
    expires_at?: string | null;
}): Promise<CreateApiKeyResponse> {
    const response = await fetch(getApiPath('profile/api-keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return handleResponse<CreateApiKeyResponse>(response);
}

export async function revokeApiKey(id: number): Promise<ApiKeySummary> {
    const response = await fetch(getApiPath(`profile/api-keys/${id}/revoke`), {
        method: 'POST',
        credentials: 'include',
    });
    return handleResponse<ApiKeySummary>(response);
}

export async function deleteApiKey(id: number): Promise<void> {
    const response = await fetch(getApiPath(`profile/api-keys/${id}`), {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Failed to delete API key';
        throw new Error(message);
    }
}
