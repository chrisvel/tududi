export interface Tag {
    id?: number;
    uid?: string;
    name: string;
    tag_type?: 'system' | 'user';
    pinned?: boolean;
    color?: string;
    usage_count?: number;
    tasks_count?: number;
    notes_count?: number;
    projects_count?: number;
}
