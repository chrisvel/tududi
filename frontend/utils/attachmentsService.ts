import {
    Attachment,
    AttachmentType,
    FileAttachment,
} from '../entities/Attachment';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import { getServerConfig } from './configService';

const INLINE_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];

/**
 * Upload a file attachment to a task
 */
export async function uploadAttachment(
    taskUid: string,
    file: File
): Promise<Attachment> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('taskUid', taskUid);

    const response = await fetch(getApiPath('upload/task-attachment'), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'x-csrf-token': await getCsrfToken(),
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload attachment');
    }

    return await response.json();
}

/**
 * Fetch all attachments for a task
 */
export async function fetchAttachments(taskUid: string): Promise<Attachment[]> {
    const response = await fetch(getApiPath(`tasks/${taskUid}/attachments`), {
        method: 'GET',
        credentials: 'include',
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch attachments');
    }

    return await response.json();
}

/**
 * Delete an attachment
 */
export async function deleteAttachment(
    taskUid: string,
    attachmentUid: string
): Promise<void> {
    const response = await fetch(
        getApiPath(`tasks/${taskUid}/attachments/${attachmentUid}`),
        {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'x-csrf-token': await getCsrfToken(),
            },
        }
    );

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete attachment');
    }
}

/**
 * Get download URL for an attachment
 */
export function getDownloadUrl(attachmentUid: string): string {
    return getApiPath(`attachments/${attachmentUid}/download`);
}

/**
 * Trigger download of an attachment
 */
export function downloadAttachment(attachmentUid: string): void {
    window.open(getDownloadUrl(attachmentUid), '_blank');
}

/**
 * Get attachment type from MIME type
 */
export function getAttachmentType(mimeType: string): AttachmentType {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }
    if (mimeType === 'application/pdf') {
        return 'pdf';
    }
    if (mimeType.startsWith('text/')) {
        return 'text';
    }
    if (
        mimeType === 'application/msword' ||
        mimeType ===
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
        return 'document';
    }
    if (
        mimeType === 'application/vnd.ms-excel' ||
        mimeType ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'text/csv'
    ) {
        return 'spreadsheet';
    }
    if (
        mimeType === 'application/zip' ||
        mimeType === 'application/x-zip-compressed'
    ) {
        return 'archive';
    }
    return 'other';
}

/**
 * Check if attachment can be previewed inline
 */
export function canPreviewInline(mimeType: string): boolean {
    const type = getAttachmentType(mimeType);
    // Images outside the known list are stored as generic .bin downloads, so
    // the browser can't render them.
    if (type === 'image') return INLINE_IMAGE_TYPES.includes(mimeType);
    return type === 'pdf' || type === 'text';
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate file before upload
 */
export async function validateFile(
    file: File
): Promise<{ valid: boolean; error?: string }> {
    const config = await getServerConfig();
    const maxSize = config.fileUploadLimitMB * 1024 * 1024;
    if (file.size > maxSize) {
        return {
            valid: false,
            error: `File size exceeds ${config.fileUploadLimitMB}MB limit`,
        };
    }

    return { valid: true };
}

// The four things an attachments panel needs, for whatever owns the files.
export interface AttachmentsApi {
    list: () => Promise<FileAttachment[]>;
    upload: (file: File) => Promise<FileAttachment>;
    remove: (attachmentUid: string) => Promise<void>;
    downloadUrl: (attachmentUid: string) => string;
}

export const taskAttachmentsApi = (taskUid: string): AttachmentsApi => ({
    list: () => fetchAttachments(taskUid),
    upload: (file) => uploadAttachment(taskUid, file),
    remove: (attachmentUid) => deleteAttachment(taskUid, attachmentUid),
    downloadUrl: getDownloadUrl,
});

export type AttachmentOwnerKind = 'inbox' | 'project' | 'note';

const readError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}));
    return new Error(data.error || fallback);
};

// Inbox items, projects and notes share one set of endpoints:
// /api/<kind>/<uid>/attachments.
export const ownerAttachmentsApi = (
    kind: AttachmentOwnerKind,
    ownerUid: string
): AttachmentsApi => {
    const base = `${kind}/${ownerUid}/attachments`;
    return {
        list: async () => {
            const response = await fetch(getApiPath(base), {
                credentials: 'include',
            });
            if (!response.ok) {
                throw await readError(response, 'Failed to fetch attachments');
            }
            return response.json();
        },
        upload: async (file) => {
            const formData = new FormData();
            formData.append('file', file);
            const response = await fetch(getApiPath(base), {
                method: 'POST',
                credentials: 'include',
                headers: { 'x-csrf-token': await getCsrfToken() },
                body: formData,
            });
            if (!response.ok) {
                throw await readError(response, 'Failed to upload attachment');
            }
            return response.json();
        },
        remove: async (attachmentUid) => {
            const response = await fetch(
                getApiPath(`${base}/${attachmentUid}`),
                {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'x-csrf-token': await getCsrfToken() },
                }
            );
            if (!response.ok) {
                throw await readError(response, 'Failed to delete attachment');
            }
        },
        downloadUrl: (attachmentUid) =>
            getApiPath(`${base}/${attachmentUid}/download`),
    };
};
