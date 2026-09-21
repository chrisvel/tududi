import { getApiPath } from '../config/paths';
import { fetchWithCsrf } from './csrfService';
import { RoleId } from '../entities/Role';

export interface MemberInput {
    name?: string;
    surname?: string;
    email?: string;
    password?: string;
    role?: RoleId;
    person_uid?: string;
}

export interface CreatedMember {
    id: number;
    email: string | null;
    name?: string;
    surname?: string;
    role: RoleId;
    account_status: 'active' | 'invited' | 'no_sign_in';
    person_uid: string | null;
    invited: boolean;
    email_sent: boolean;
}

export const createMember = async (
    input: MemberInput
): Promise<CreatedMember> => {
    const response = await fetchWithCsrf(getApiPath('members'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(input),
    });
    if (!response.ok) {
        let message = 'Failed to add member.';
        try {
            const body = await response.json();
            if (body?.error) message = body.error;
        } catch {
            // ignore non-JSON error bodies
        }
        throw new Error(message);
    }
    return response.json();
};

export interface SignInLink {
    url: string;
    // The part after the address, so the app can attach it to the address
    // it is actually served from.
    path: string;
    expires_at: string;
}

const failure = async (response: Response, fallback: string) => {
    try {
        const body = await response.json();
        if (body?.error) return new Error(body.error);
    } catch {
        // ignore non-JSON error bodies
    }
    return new Error(fallback);
};

// A link that lets a member without an email sign in. Whoever created the
// account, or an admin, makes it and hands it over.
export const createSignInLink = async (
    memberId: number
): Promise<SignInLink> => {
    const response = await fetchWithCsrf(
        getApiPath(`members/${memberId}/sign-in-link`),
        {
            method: 'POST',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    if (!response.ok) {
        throw await failure(response, 'Failed to create the sign-in link.');
    }
    return response.json();
};

// Removes the member's link and signs them out everywhere.
export const revokeSignInLink = async (memberId: number): Promise<void> => {
    const response = await fetchWithCsrf(
        getApiPath(`members/${memberId}/sign-in-link`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    if (!response.ok) {
        throw await failure(response, 'Failed to revoke access.');
    }
};

// Whose link this is, for the "Sign in as ...?" page. The token travels in the
// body, not the URL, so it stays out of access logs.
export const peekSignInLink = async (
    token: string
): Promise<{ name: string | null } | null> => {
    const response = await fetchWithCsrf(getApiPath('sign-in-link/peek'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ token }),
    });
    if (response.status === 404) return null;
    if (!response.ok)
        throw await failure(response, 'Could not check the link.');
    return response.json();
};

export const redeemSignInLink = async (token: string) => {
    const response = await fetchWithCsrf(getApiPath('sign-in-link/redeem'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ token }),
    });
    if (!response.ok) throw await failure(response, 'Could not sign in.');
    return response.json();
};
