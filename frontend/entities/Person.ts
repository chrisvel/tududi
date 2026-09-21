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
    created_at?: string;
    updated_at?: string;
}
