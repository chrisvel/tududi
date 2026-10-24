import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

// Webhooks POST tududi events as signed JSON to an address the user picks
// (n8n, Home Assistant, Slack, Discord, their own server). The address and
// signing secret are stored encrypted; the secret is only returned when it
// is created or rotated.

export interface Webhook {
    uid: string;
    name: string;
    host: string | null;
    events: string[];
    summary_hour: number;
    enabled: boolean;
    disabled_reason: string | null;
    failure_count: number;
    last_delivery_at: string | null;
    last_delivery_status: 'delivered' | 'failed' | null;
    created_at: string;
    secret?: string;
}

export interface WebhookInput {
    name?: string;
    url?: string;
    events?: string[];
    summary_hour?: number;
    enabled?: boolean;
}

export interface WebhookDelivery {
    uid: string;
    event: string;
    status: 'pending' | 'sending' | 'delivered' | 'failed';
    attempts: number;
    response_status: number | null;
    error: string | null;
    created_at: string;
    delivered_at: string | null;
}

export const WEBHOOK_EVENT_GROUPS: { key: string; events: string[] }[] = [
    {
        key: 'alerts',
        events: [
            'task.due_soon',
            'task.overdue',
            'task.reminder',
            'task.deferred_ready',
            'task.assigned',
            'project.due_soon',
            'project.overdue',
            'habit.reminder',
            'comment.added',
            'comment.mention',
            'share.invitation',
        ],
    },
    {
        key: 'changes',
        events: [
            'task.created',
            'task.updated',
            'task.completed',
            'task.deleted',
        ],
    },
    { key: 'summary', events: ['daily_summary'] },
];

const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return data.error || data.message || fallback;
};

const send = async <T>(
    path: string,
    method: string,
    fallback: string,
    body?: unknown
): Promise<T> => {
    const response = await fetch(getApiPath(path), {
        method,
        credentials: 'include',
        headers: {
            ...(body !== undefined
                ? { 'Content-Type': 'application/json' }
                : {}),
            ...(method !== 'GET'
                ? { 'x-csrf-token': await getCsrfToken() }
                : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
        throw new Error(await readError(response, fallback));
    }
    return response.json();
};

export const listWebhooks = () =>
    send<Webhook[]>('webhooks', 'GET', 'Could not load webhooks');

export const createWebhook = (input: WebhookInput) =>
    send<Webhook>('webhooks', 'POST', 'Could not save the webhook', input);

export const updateWebhook = (uid: string, input: WebhookInput) =>
    send<Webhook>(
        `webhooks/${uid}`,
        'PATCH',
        'Could not save the webhook',
        input
    );

export const deleteWebhook = (uid: string) =>
    send<{ deleted: boolean }>(
        `webhooks/${uid}`,
        'DELETE',
        'Could not delete the webhook'
    );

export const rotateWebhookSecret = (uid: string) =>
    send<Webhook>(
        `webhooks/${uid}/secret`,
        'POST',
        'Could not make a new secret'
    );

export const testWebhook = (uid: string) =>
    send<{ delivered: boolean; response_status: number | null }>(
        `webhooks/${uid}/test`,
        'POST',
        'Could not send the test'
    );

export const listWebhookDeliveries = (uid: string) =>
    send<WebhookDelivery[]>(
        `webhooks/${uid}/deliveries`,
        'GET',
        'Could not load deliveries'
    );
