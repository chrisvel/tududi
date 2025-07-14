export interface InboxItem {
    id?: number;
    content: string;
    title?: string;
    status?: string; // 'added' | 'processed' | 'deleted'
    source?: string; // 'telegram'
    created_at?: string;
    updated_at?: string;
    suggested_type?: string;
    suggested_reason?: string;
    parsed_tags?: string[];
    parsed_projects?: string[];
    cleaned_content?: string;
}
