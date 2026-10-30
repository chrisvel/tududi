export type RelationshipType = 'family' | 'work' | 'friend' | 'other';

export interface Person {
    id?: number;
    uid?: string;
    user_id?: number;
    linked_user_id?: number | null;
    name: string;
    relationship_type?: RelationshipType;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
    archived?: boolean;
    color?: string | null;
    is_self?: boolean;
    kind?: 'member' | 'contact';
    can_edit?: boolean;
    account_status?: 'active' | 'invited' | 'no_sign_in';
    can_sign_in_link?: boolean;
    // A member the viewer created (or any member, for an admin): it may be
    // renamed, given an email or removed.
    can_manage?: boolean;
    // A member's place in the viewer's account: its owner, an admin, or
    // anyone else. Missing on contacts and from older servers.
    account_role?: 'owner' | 'admin' | 'member';
    created_at?: string;
    updated_at?: string;
}
