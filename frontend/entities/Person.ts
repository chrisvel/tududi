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
    created_at?: string;
    updated_at?: string;
}
