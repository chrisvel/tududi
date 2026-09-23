import { Attachment, AttachmentType } from '../entities/Attachment';
import { getApiPath } from '../config/paths';
import { getCsrfToken } from './csrfService';
import { getServerConfig } from './configService';

// Keep in sync with ALLOWED_TYPES in backend/utils/attachment-utils.js.
const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed',
];

const INLINE_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];

export const ALLOWED_FILE_EXTENSIONS =
    '.pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.xls,.xlsx,.csv,.zip';

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
    // Images outside the built-in list are stored as generic downloads when
    // FILE_UPLOAD_ALLOW_ALL_TYPES is on, so the browser can't render them.
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

    if (!config.fileUploadAllowAllTypes && !ALLOWED_TYPES.includes(file.type)) {
        return {
            valid: false,
            error: 'File type not allowed',
        };
    }

    return { valid: true };
}
