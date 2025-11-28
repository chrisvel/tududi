export interface Attachment {
    id: number;
    uid: string;
    task_id: number;
    user_id: number;
    original_filename: string;
    stored_filename: string;
    file_size: number;
    mime_type: string;
    file_path: string;
    file_url?: string;
    created_at: string;
    updated_at: string;
}

export type AttachmentType =
    | 'image'
    | 'pdf'
    | 'text'
    | 'document'
    | 'spreadsheet'
    | 'archive'
    | 'other';
