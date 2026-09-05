import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import type { BillingStatus, BillingCatalog } from '../entities/Billing';

export const fetchBillingStatus = async (): Promise<BillingStatus> => {
    const response = await fetch(getApiPath('billing'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load billing status.');
    return response.json();
};

export const fetchBillingCatalog = async (): Promise<BillingCatalog> => {
    const response = await fetch(getApiPath('billing/plans'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load plans.');
    return response.json();
};

export const startCheckout = async (
    interval: 'month' | 'year'
): Promise<string> => {
    const response = await fetch(getApiPath('billing/checkout'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ interval }),
    });
    await handleAuthResponse(response, 'Failed to start checkout.');
    const data = await response.json();
    return data.url as string;
};

export const openPortal = async (): Promise<string> => {
    const response = await fetch(getApiPath('billing/portal'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });
    await handleAuthResponse(response, 'Failed to open the billing portal.');
    const data = await response.json();
    return data.url as string;
};

export const syncCheckout = async (
    sessionId?: string
): Promise<BillingStatus> => {
    const response = await fetch(getApiPath('billing/sync'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify(sessionId ? { session_id: sessionId } : {}),
    });
    await handleAuthResponse(response, 'Failed to refresh billing status.');
    return response.json();
};

export const formatBytes = (bytes: number): string => {
    if (bytes >= 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    if (bytes >= 1024) {
        return `${Math.round(bytes / 1024)} KB`;
    }
    return `${bytes} B`;
};
