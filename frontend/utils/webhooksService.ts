import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export type WebhookAuthType = 'none' | 'basic' | 'header';

export interface WebhookEndpointSummary {
    uid: string;
    name: string;
    url: string;
    event_types: string[];
    active: boolean;
    last_delivery_at: string | null;
    last_delivery_status: 'success' | 'failed' | null;
    last_delivery_error: string | null;
    failure_count: number;
    created_at: string;
    updated_at: string;
    secret_preview: string | null;
    secret?: string;
    auth_type: WebhookAuthType;
    auth_header_name: string | null;
    auth_username: string | null;
    auth_configured: boolean;
}

export interface WebhookAuthPayload {
    auth_type?: WebhookAuthType;
    auth_header_name?: string;
    auth_username?: string;
    auth_secret?: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Request failed';
        throw new Error(message);
    }
    return (await response.json()) as T;
}

export async function fetchWebhooks(): Promise<WebhookEndpointSummary[]> {
    const response = await fetch(getApiPath('webhooks'), {
        credentials: 'include',
    });
    return handleResponse<WebhookEndpointSummary[]>(response);
}

export async function createWebhook(
    payload: {
        name: string;
        url: string;
        event_types: string[];
    } & WebhookAuthPayload
): Promise<WebhookEndpointSummary> {
    const response = await fetch(getApiPath('webhooks'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return handleResponse<WebhookEndpointSummary>(response);
}

export async function updateWebhook(
    uid: string,
    payload: Partial<
        {
            name: string;
            url: string;
            event_types: string[];
            active: boolean;
        } & WebhookAuthPayload
    >
): Promise<WebhookEndpointSummary> {
    const response = await fetch(getApiPath(`webhooks/${uid}`), {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
    });
    return handleResponse<WebhookEndpointSummary>(response);
}

export async function deleteWebhook(uid: string): Promise<void> {
    const response = await fetch(getApiPath(`webhooks/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const message = errorBody?.error || 'Failed to delete webhook';
        throw new Error(message);
    }
}

export async function rotateWebhookSecret(
    uid: string
): Promise<WebhookEndpointSummary> {
    const response = await fetch(getApiPath(`webhooks/${uid}/rotate-secret`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
    });
    return handleResponse<WebhookEndpointSummary>(response);
}

export async function testWebhook(
    uid: string
): Promise<{ success: boolean; error: string | null }> {
    const response = await fetch(getApiPath(`webhooks/${uid}/test`), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
    });
    return handleResponse<{ success: boolean; error: string | null }>(response);
}
