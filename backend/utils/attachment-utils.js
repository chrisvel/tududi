const path = require('path');
const fs = require('fs').promises;
const { logError } = require('../services/logService');
const { getConfig } = require('../config/config');

const config = getConfig();

// Allowed MIME types and their extensions.
// SVG is intentionally excluded: it's an XML format that can embed <script>,
// and uploaded attachments are served back to the browser, so allowing it
// would enable stored XSS (GHSA-x24w-9w59-wqhq).
const ALLOWED_TYPES = {
    // Documents
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
        '.docx',
    ],
    'text/plain': ['.txt'],
    'text/markdown': ['.md'],
    // Images
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    // Spreadsheets
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
    ],
    'text/csv': ['.csv'],
    // Archives
    'application/zip': ['.zip'],
    'application/x-zip-compressed': ['.zip'],
};

// Extensions safe to render inline in the browser (used by <img>/<iframe>
// previews in the app). Everything else served through /api/uploads gets
// Content-Disposition: attachment so a browser can't execute it via direct
// navigation. This is extension-based rather than DB-mimetype-based so it
// also neutralizes any file whose extension predates the image/svg+xml
// removal above (GHSA-43p8-ch4p-gqg4).
const INLINE_SAFE_EXTENSIONS = new Set([
    '.pdf',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
]);

/**
 * Validate if file type is allowed
 */
function validateFileType(mimetype) {
    return !!ALLOWED_TYPES[mimetype];
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimetype) {
    const extensions = ALLOWED_TYPES[mimetype];
    return extensions ? extensions[0] : '';
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file is an image
 */
function isImageFile(mimetype) {
    return mimetype.startsWith('image/');
}

/**
 * Check if file is a PDF
 */
function isPdfFile(mimetype) {
    return mimetype === 'application/pdf';
}

/**
 * Check if file is a text file
 */
function isTextFile(mimetype) {
    return mimetype.startsWith('text/');
}

/**
 * Delete file from disk safely
 */
async function deleteFileFromDisk(filepath) {
    if (!filepath) return false;

    try {
        const uploadDir = path.resolve(config.uploadPath);
        const resolvedPath = path.resolve(filepath);
        const relativePath = path.relative(uploadDir, resolvedPath);

        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            logError(
                'Attempt to delete file outside upload directory:',
                filepath
            );
            return false;
        }

        const safePath = path.join(uploadDir, relativePath);
        await fs.unlink(safePath);

        return true;
    } catch (error) {
        logError('Error deleting file from disk:', error);
        return false;
    }
}

// Delete the on-disk files for a set of TaskAttachment rows. Best-effort -
// deleteFileFromDisk already logs and swallows per-file errors, so one bad
// path doesn't abort the caller's larger deletion. Does not destroy the DB
// rows; callers own that since transaction semantics differ per call site.
async function deleteAttachmentFiles(attachments = []) {
    for (const attachment of attachments) {
        const filePath = path.join(config.uploadPath, attachment.file_path);
        await deleteFileFromDisk(filePath);
    }
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
        return true;
    } catch (error) {
        logError('Error creating upload directory:', error);
        return false;
    }
}

/**
 * Get file URL for serving
 */
function getFileUrl(storedFilename) {
    return `/api/uploads/tasks/${storedFilename}`;
}

module.exports = {
    ALLOWED_TYPES,
    INLINE_SAFE_EXTENSIONS,
    validateFileType,
    getExtensionFromMimeType,
    formatFileSize,
    isImageFile,
    isPdfFile,
    isTextFile,
    deleteFileFromDisk,
    deleteAttachmentFiles,
    ensureUploadDir,
    getFileUrl,
};
