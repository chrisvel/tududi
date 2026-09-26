// A stored file as every owner (task, inbox item, project, note) returns it.
export interface FileAttachment {
    uid: string;
    original_filename: string;
    stored_filename: string;
    file_size: number;
    mime_type: string;
    file_url?: string;
    created_at: string;
    updated_at: string;
}

export interface Attachment extends FileAttachment {
    id: number;
    task_id: number;
    user_id: number;
    file_path: string;
}

// Inbox items, projects and notes always send the file's URL.
export interface InboxAttachment extends FileAttachment {
    file_url: string;
}

export type AttachmentType =
    | 'image'
    | 'pdf'
    | 'text'
    | 'document'
    | 'spreadsheet'
    | 'archive'
    | 'other';
