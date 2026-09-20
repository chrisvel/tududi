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
