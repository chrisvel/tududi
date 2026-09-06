import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';
import type { BillingStatus } from '../entities/Billing';

export interface AdminBillingAccount {
    user_id: number;
    email: string;
    name?: string | null;
    plan: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    override_plan: string | null;
    override_expires_at: string | null;
    stripe_customer_id: string | null;
}

export interface AdminBillingSummaryRow {
    plan: string;
    status: string;
    count: number;
}

export interface AdminBillingList {
    summary: AdminBillingSummaryRow[];
    total: number;
    accounts: AdminBillingAccount[];
}

export interface AdminBillingDetail {
    user: { id: number; email: string; name?: string | null };
    status: BillingStatus;
    account: Record<string, unknown> | null;
}

export const fetchAdminBilling = async (
    q = '',
    page = 1
): Promise<AdminBillingList> => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    const response = await fetch(getApiPath(`admin/billing?${params}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load billing accounts.');
    return response.json();
};

export const setPlanOverride = async (
    userId: number,
    payload: { plan: string; expires_at?: string | null; reason?: string }
): Promise<AdminBillingDetail> => {
    const response = await fetch(
        getApiPath(`admin/billing/${userId}/override`),
        {
            method: 'PUT',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
            body: JSON.stringify(payload),
        }
    );
    await handleAuthResponse(response, 'Failed to set the plan override.');
    return response.json();
};

export const clearPlanOverride = async (
    userId: number
): Promise<AdminBillingDetail> => {
    const response = await fetch(
        getApiPath(`admin/billing/${userId}/override`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Failed to clear the plan override.');
    return response.json();
};

export const syncAccountFromStripe = async (
    userId: number
): Promise<AdminBillingDetail> => {
    const response = await fetch(getApiPath(`admin/billing/${userId}/sync`), {
        method: 'POST',
        credentials: 'include',
        headers: await getPostHeadersWithCsrf(),
    });
    await handleAuthResponse(response, 'Failed to sync from Stripe.');
    return response.json();
};
