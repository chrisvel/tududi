import { InboxAttachment } from './Attachment';

export interface InboxItem {
    id?: number;
    uid?: string;
    content: string;
    title?: string | null;
    status?: string; // 'added' | 'processed' | 'deleted' | 'trashed'
    source?: string; // 'telegram'
    created_at?: string;
    updated_at?: string;
    attachments?: InboxAttachment[];
    // Last AI assist result, saved so it shows again on the next visit.
    ai_suggestion?: InboxAiSuggestion | null;
}

export type InboxAiKind = 'task' | 'note' | 'project' | 'keep';

export interface InboxAiOption {
    kind: InboxAiKind;
    // "guess" when the item is unclear (e.g. only a file name).
    confidence: 'sure' | 'guess';
    title: string;
    project_uid: string | null;
    project_name: string | null;
    tags: string[];
    due_date: string | null;
    reason: string;
    analysis: string;
    // Where each proposed value came from; empty for fields left empty.
    why: {
        title: string;
        project: string;
        tags: string;
        due_date: string;
    };
}

// One to three options per item, best first.
export interface InboxAiSuggestion {
    item_uid: string;
    options: InboxAiOption[];
    generated_at?: string;
}
