import { getApiPath } from '../config/paths';
import { fetchWithCsrf } from './csrfService';

export interface GroupSummary {
    uid: string;
    name: string;
    member_count: number;
}

export interface AdminGroup {
    uid: string;
    name: string;
    description: string | null;
    member_count: number;
    share_count: number;
    created_at?: string;
    updated_at?: string;
}

export interface GroupMember {
    user_id: number;
    email: string;
    name?: string | null;
    surname?: string | null;
    avatar_image?: string | null;
}

export interface GroupResourceShare {
    resource_type: string;
    resource_uid: string;
    resource_name?: string | null;
    access_level: 'ro' | 'rw';
}

export interface AdminGroupDetail {
    group: AdminGroup;
    members: GroupMember[];
    shares: GroupResourceShare[];
}

export interface GroupInput {
    name: string;
    description?: string | null;
}

async function readError(res: Response, fallback: string): Promise<Error> {
    try {
        const body = await res.json();
        if (body?.error) return new Error(body.error);
        if (body?.message) return new Error(body.message);
    } catch {
        // ignore non-JSON error bodies
    }
    return new Error(fallback);
}

const JSON_HEADERS = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
};

// Group names and member counts, for the share picker. Any signed-in user.
export async function fetchGroups(): Promise<GroupSummary[]> {
    const res = await fetch(getApiPath('groups'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw await readError(res, 'Failed to load groups');
    const data = await res.json();
    return data.groups || [];
}

export async function fetchAdminGroups(): Promise<AdminGroup[]> {
    const res = await fetch(getApiPath('admin/groups'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw await readError(res, 'Failed to load groups');
    const data = await res.json();
    return data.groups || [];
}

export async function fetchAdminGroup(uid: string): Promise<AdminGroupDetail> {
    const res = await fetch(getApiPath(`admin/groups/${uid}`), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw await readError(res, 'Failed to load group');
    return res.json();
}

export async function createAdminGroup(input: GroupInput): Promise<AdminGroup> {
    const res = await fetchWithCsrf(getApiPath('admin/groups'), {
        method: 'POST',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
    });
    if (!res.ok) throw await readError(res, 'Failed to create group');
    const data = await res.json();
    return data.group;
}

export async function updateAdminGroup(
    uid: string,
    input: Partial<GroupInput>
): Promise<AdminGroup> {
    const res = await fetchWithCsrf(getApiPath(`admin/groups/${uid}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
    });
    if (!res.ok) throw await readError(res, 'Failed to update group');
    const data = await res.json();
    return data.group;
}

export async function deleteAdminGroup(uid: string): Promise<void> {
    const res = await fetchWithCsrf(getApiPath(`admin/groups/${uid}`), {
        method: 'DELETE',
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok && res.status !== 204) {
        throw await readError(res, 'Failed to delete group');
    }
}

export async function addGroupMembers(
    uid: string,
    userIds: number[]
): Promise<{ added: number[]; already_members: number[] }> {
    const res = await fetchWithCsrf(getApiPath(`admin/groups/${uid}/members`), {
        method: 'POST',
        credentials: 'include',
        headers: JSON_HEADERS,
        body: JSON.stringify({ user_ids: userIds }),
    });
    if (!res.ok) throw await readError(res, 'Failed to add members');
    return res.json();
}

export async function removeGroupMember(
    uid: string,
    userId: number
): Promise<void> {
    const res = await fetchWithCsrf(
        getApiPath(`admin/groups/${uid}/members/${userId}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: { Accept: 'application/json' },
        }
    );
    if (!res.ok && res.status !== 204) {
        throw await readError(res, 'Failed to remove member');
    }
}

export interface UserOption {
    id: number;
    email: string;
    name?: string | null;
    surname?: string | null;
}

// Every account on the instance, for picking who to add to a group.
export async function fetchUserOptions(): Promise<UserOption[]> {
    const res = await fetch(getApiPath('admin/users'), {
        credentials: 'include',
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw await readError(res, 'Failed to load users');
    return res.json();
}
