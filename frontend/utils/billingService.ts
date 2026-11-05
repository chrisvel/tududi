import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import type { BillingStatus, BillingCatalog } from '../entities/Billing';
import { openPaddleCheckout, type PaddleCheckout } from './paddleCheckout';

export const fetchBillingStatus = async (): Promise<BillingStatus> => {
    const response = await fetch(getApiPath('billing'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load billing status.');
    return response.json();
};

// Last known status, so the user menu can show the plan at once instead of
// waiting for the request on every open.
let cachedBillingStatus: BillingStatus | null = null;

export const getCachedBillingStatus = (): BillingStatus | null =>
    cachedBillingStatus;

export const refreshBillingStatus = async (): Promise<BillingStatus> => {
    const status = await fetchBillingStatus();
    cachedBillingStatus = status;
    return status;
};

export const clearBillingStatusCache = (): void => {
    cachedBillingStatus = null;
};

export const fetchBillingCatalog = async (): Promise<BillingCatalog> => {
    const response = await fetch(getApiPath('billing/plans'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load plans.');
    return response.json();
};

// Starts a checkout: a hosted checkout page to go to, or (Paddle) the
// overlay to open over the current page.
export const startCheckout = async (
    interval: 'month' | 'year',
    plan: string = 'pro'
): Promise<{ url: string | null; paddle?: PaddleCheckout }> => {
    const response = await fetch(getApiPath('billing/checkout'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ interval, plan }),
    });
    await handleAuthResponse(response, 'Failed to start checkout.');
    return response.json();
};

// Sends the browser to the checkout. `closed` runs if an overlay is closed
// without paying.
export const goToCheckout = async (
    interval: 'month' | 'year',
    plan: string,
    closed?: () => void
): Promise<void> => {
    const checkout = await startCheckout(interval, plan);
    if (checkout.paddle) {
        await openPaddleCheckout(checkout.paddle, closed);
    } else if (checkout.url) {
        window.location.assign(checkout.url);
    }
};

// Moves the subscription to another plan (Paddle subscriptions).
export const changePlan = async (plan: string): Promise<BillingStatus> => {
    const response = await fetch(getApiPath('billing/plan'), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
        body: JSON.stringify({ plan }),
    });
    await handleAuthResponse(response, 'Failed to change the plan.');
    return response.json();
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
