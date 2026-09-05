import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';

export type AccessLevel = 'ro' | 'rw';

export interface ShareGrantRequest {
    resource_type: 'project' | 'task' | 'note' | 'area' | 'tag';
    resource_uid: string;
    target_user_email: string;
    access_level: AccessLevel;
}

export async function grantShare(req: ShareGrantRequest): Promise<void> {
    const res = await fetch(getApiPath('shares'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        body: JSON.stringify(req),
    });
    if (!res.ok) {
        let message = 'Failed to share resource';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
}

export type ShareStatus = 'pending' | 'accepted';

export interface ListSharesResponseRow {
    user_id: number;
    access_level: AccessLevel | 'owner';
    status?: ShareStatus;
    created_at: string | null;
    email?: string | null;
    avatar_image?: string | null;
    is_owner?: boolean;
}

export async function listShares(
    resource_type: ShareGrantRequest['resource_type'],
    resource_uid: string
): Promise<ListSharesResponseRow[]> {
    const params = new URLSearchParams({ resource_type, resource_uid });
    const res = await fetch(getApiPath(`shares?${params.toString()}`), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        let message = 'Failed to load shares';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
    const data = await res.json();
    return data.shares || [];
}

export async function revokeShare(
    resource_type: ShareGrantRequest['resource_type'],
    resource_uid: string,
    target_user_id: number
): Promise<void> {
    const res = await fetch(getApiPath('shares'), {
        method: 'DELETE',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-csrf-token': await getCsrfToken(),
        },
        body: JSON.stringify({ resource_type, resource_uid, target_user_id }),
    });
    if (!res.ok) {
        let message = 'Failed to revoke share';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
}

export interface ShareInvitation {
    id: number;
    resource_type: ShareGrantRequest['resource_type'];
    resource_uid: string;
    resource_name: string | null;
    access_level: AccessLevel;
    created_at: string;
    inviter_email: string | null;
    inviter_name: string | null;
}

export async function listInvitations(): Promise<ShareInvitation[]> {
    const res = await fetch(getApiPath('shares/invitations'), {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        throw new Error('Failed to load invitations');
    }
    const data = await res.json();
    return data.invitations || [];
}

async function answerInvitation(
    invitationId: number,
    answer: 'accept' | 'decline'
): Promise<void> {
    const res = await fetch(
        getApiPath(`shares/invitations/${invitationId}/${answer}`),
        {
            method: 'POST',
            credentials: 'include',
            headers: {
                Accept: 'application/json',
                'x-csrf-token': await getCsrfToken(),
            },
        }
    );
    if (!res.ok) {
        let message =
            answer === 'accept'
                ? 'Failed to accept invitation'
                : 'Failed to decline invitation';
        try {
            const body = await res.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
}

export function acceptInvitation(invitationId: number): Promise<void> {
    return answerInvitation(invitationId, 'accept');
}

export function declineInvitation(invitationId: number): Promise<void> {
    return answerInvitation(invitationId, 'decline');
}
