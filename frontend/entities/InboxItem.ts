export interface InboxItem {
    id?: number;
    uid?: string;
    content: string;
    title?: string | null;
    status?: string; // 'added' | 'processed' | 'deleted'
    source?: string; // 'telegram'
    created_at?: string;
    updated_at?: string;
}
