import { handleAuthResponse, getPostHeadersWithCsrf } from './authUtils';
import { getApiPath } from '../config/paths';

// One account email for one user: whether it can be sent now (and why not),
// and what went out before.
export interface AdminUserEmail {
    key: string;
    can_send: boolean;
    reason: string | null;
    sent_count: number;
    last_sent_at: string | null;
    last_status: 'sent' | 'failed' | null;
    // Sent before the log existed: true, or the date the account kept.
    recorded_before_log: true | string | null;
}

export interface AdminEmailDelivery {
    id: number;
    email: string;
    variant: string | null;
    subject: string;
    recipient: string;
    language: string;
    status: 'sent' | 'failed';
    error: string | null;
    created_at: string;
    // The admin who sent it by hand, or null when the app sent it.
    sent_by: string | null;
}

export interface AdminUserEmails {
    user: { id: number; email: string | null; language: string };
    emails: AdminUserEmail[];
    history: AdminEmailDelivery[];
}

export interface AdminEmailPreview {
    key: string;
    to: string;
    language: string;
    subject: string;
    text: string;
    html: string | null;
    // What else sending does, such as setting a deletion date.
    note: string | null;
    // Stands in for a link whose token is only made when the email is sent.
    link_placeholder: string;
}

export const fetchUserEmails = async (
    userId: number
): Promise<AdminUserEmails> => {
    const response = await fetch(getApiPath(`admin/users/${userId}/emails`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    await handleAuthResponse(response, 'Failed to load emails.');
    return response.json();
};

export const previewUserEmail = async (
    userId: number,
    key: string
): Promise<AdminEmailPreview> => {
    const response = await fetch(
        getApiPath(`admin/users/${userId}/emails/${key}/preview`),
        { credentials: 'include', headers: { Accept: 'application/json' } }
    );
    await handleAuthResponse(response, 'Failed to build the email.');
    return response.json();
};

export const sendUserEmail = async (
    userId: number,
    key: string
): Promise<{ sent: boolean; error: string | null }> => {
    const response = await fetch(
        getApiPath(`admin/users/${userId}/emails/${key}/send`),
        {
            method: 'POST',
            credentials: 'include',
            headers: await getPostHeadersWithCsrf(),
        }
    );
    await handleAuthResponse(response, 'Failed to send the email.');
    return response.json();
};
