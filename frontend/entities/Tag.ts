export interface Tag {
    id?: number;
    uid?: string;
    name: string;
    tag_type?: 'system' | 'user';
    pinned?: boolean;
    usage_count?: number;
}
