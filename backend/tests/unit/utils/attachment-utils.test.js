const fs = require('fs').promises;
const path = require('path');
const {
    ALLOWED_TYPES,
    validateFileType,
    getExtensionFromMimeType,
    formatFileSize,
    isImageFile,
    isPdfFile,
    isTextFile,
    deleteFileFromDisk,
    ensureUploadDir,
    getFileUrl,
} = require('../../../utils/attachment-utils');

describe('Attachment Utils', () => {
    describe('validateFileType', () => {
        it('should accept PDF files', () => {
            expect(validateFileType('application/pdf')).toBe(true);
        });

        it('should accept PNG images', () => {
            expect(validateFileType('image/png')).toBe(true);
        });

        it('should accept JPEG images', () => {
            expect(validateFileType('image/jpeg')).toBe(true);
        });

        it('should accept Word documents', () => {
            expect(
                validateFileType(
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                )
            ).toBe(true);
        });

        it('should accept text files', () => {
            expect(validateFileType('text/plain')).toBe(true);
        });

        it('should accept markdown files', () => {
            expect(validateFileType('text/markdown')).toBe(true);
        });

        it('should accept Excel files', () => {
            expect(
                validateFileType(
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                )
            ).toBe(true);
        });

        it('should accept CSV files', () => {
            expect(validateFileType('text/csv')).toBe(true);
        });

        it('should accept ZIP files', () => {
            expect(validateFileType('application/zip')).toBe(true);
        });

        it('should reject executable files', () => {
            expect(validateFileType('application/x-msdownload')).toBe(false);
        });

        it('should reject script files', () => {
            expect(validateFileType('application/javascript')).toBe(false);
        });

        it('should reject unknown MIME types', () => {
            expect(validateFileType('application/unknown')).toBe(false);
        });

        it('should reject empty MIME type', () => {
            expect(validateFileType('')).toBe(false);
        });

        it('should reject null MIME type', () => {
            expect(validateFileType(null)).toBe(false);
        });
    });

    describe('getExtensionFromMimeType', () => {
        it('should return .pdf for PDF MIME type', () => {
            expect(getExtensionFromMimeType('application/pdf')).toBe('.pdf');
        });

        it('should return .png for PNG MIME type', () => {
            expect(getExtensionFromMimeType('image/png')).toBe('.png');
        });

        it('should return .jpg for JPEG MIME type', () => {
            expect(getExtensionFromMimeType('image/jpeg')).toBe('.jpg');
        });

        it('should return .docx for Word MIME type', () => {
            expect(
                getExtensionFromMimeType(
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                )
            ).toBe('.docx');
        });

        it('should return .txt for text MIME type', () => {
            expect(getExtensionFromMimeType('text/plain')).toBe('.txt');
        });

        it('should return empty string for unknown MIME type', () => {
            expect(getExtensionFromMimeType('application/unknown')).toBe('');
        });

        it('should return empty string for null MIME type', () => {
            expect(getExtensionFromMimeType(null)).toBe('');
        });
    });

    describe('formatFileSize', () => {
        it('should format 0 bytes', () => {
            expect(formatFileSize(0)).toBe('0 Bytes');
        });

        it('should format bytes', () => {
            expect(formatFileSize(500)).toBe('500 Bytes');
        });

        it('should format kilobytes', () => {
            expect(formatFileSize(1024)).toBe('1 KB');
        });

        it('should format kilobytes with decimals', () => {
            expect(formatFileSize(1536)).toBe('1.5 KB');
        });

        it('should format megabytes', () => {
            expect(formatFileSize(1048576)).toBe('1 MB');
        });

        it('should format megabytes with decimals', () => {
            expect(formatFileSize(1572864)).toBe('1.5 MB');
        });

        it('should format gigabytes', () => {
            expect(formatFileSize(1073741824)).toBe('1 GB');
        });

        it('should format large files', () => {
            expect(formatFileSize(10485760)).toBe('10 MB');
        });

        it('should round to 2 decimal places', () => {
            const result = formatFileSize(1234567);
            expect(result).toMatch(/^\d+\.\d{1,2}\s(KB|MB)$/);
        });
    });

    describe('isImageFile', () => {
        it('should return true for PNG', () => {
            expect(isImageFile('image/png')).toBe(true);
        });

        it('should return true for JPEG', () => {
            expect(isImageFile('image/jpeg')).toBe(true);
        });

        it('should return true for GIF', () => {
            expect(isImageFile('image/gif')).toBe(true);
        });

        it('should return true for SVG', () => {
            expect(isImageFile('image/svg+xml')).toBe(true);
        });

        it('should return true for WebP', () => {
            expect(isImageFile('image/webp')).toBe(true);
        });

        it('should return false for PDF', () => {
            expect(isImageFile('application/pdf')).toBe(false);
        });

        it('should return false for text', () => {
            expect(isImageFile('text/plain')).toBe(false);
        });
    });

    describe('isPdfFile', () => {
        it('should return true for PDF', () => {
            expect(isPdfFile('application/pdf')).toBe(true);
        });

        it('should return false for image', () => {
            expect(isPdfFile('image/png')).toBe(false);
        });

        it('should return false for text', () => {
            expect(isPdfFile('text/plain')).toBe(false);
        });

        it('should return false for null', () => {
            expect(isPdfFile(null)).toBe(false);
        });
    });

    describe('isTextFile', () => {
        it('should return true for text/plain', () => {
            expect(isTextFile('text/plain')).toBe(true);
        });

        it('should return true for text/markdown', () => {
            expect(isTextFile('text/markdown')).toBe(true);
        });

        it('should return true for text/csv', () => {
            expect(isTextFile('text/csv')).toBe(true);
        });

        it('should return false for PDF', () => {
            expect(isTextFile('application/pdf')).toBe(false);
        });

        it('should return false for image', () => {
            expect(isTextFile('image/png')).toBe(false);
        });
    });

    describe('deleteFileFromDisk', () => {
        const testDir = path.join(__dirname, '../../test-uploads');
        const testFile = path.join(testDir, 'test-delete-file.txt');

        beforeEach(async () => {
            // Create test directory and file
            await fs.mkdir(testDir, { recursive: true });
            await fs.writeFile(testFile, 'test content');
        });

        afterEach(async () => {
            // Clean up test directory
            try {
                await fs.rm(testDir, { recursive: true, force: true });
            } catch (error) {
                // Ignore errors
            }
        });

        it('should delete an existing file', async () => {
            const result = await deleteFileFromDisk(testFile);
            expect(result).toBe(true);

            // Verify file is deleted
            await expect(fs.access(testFile)).rejects.toThrow();
        });

        it('should return false for non-existent file', async () => {
            const nonExistentFile = path.join(testDir, 'non-existent.txt');
            const result = await deleteFileFromDisk(nonExistentFile);
            expect(result).toBe(false);
        });

        it('should handle null filepath gracefully', async () => {
            const result = await deleteFileFromDisk(null);
            expect(result).toBe(false);
        });

        it('should handle empty filepath gracefully', async () => {
            const result = await deleteFileFromDisk('');
            expect(result).toBe(false);
        });
    });

    describe('ensureUploadDir', () => {
        const testDir = path.join(__dirname, '../../test-upload-dir');

        afterEach(async () => {
            // Clean up test directory
            try {
                await fs.rm(testDir, { recursive: true, force: true });
            } catch (error) {
                // Ignore errors
            }
        });

        it('should create a directory if it does not exist', async () => {
            const result = await ensureUploadDir(testDir);
            expect(result).toBe(true);

            // Verify directory exists
            const stats = await fs.stat(testDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should succeed if directory already exists', async () => {
            // Create directory first
            await fs.mkdir(testDir, { recursive: true });

            const result = await ensureUploadDir(testDir);
            expect(result).toBe(true);

            // Verify directory still exists
            const stats = await fs.stat(testDir);
            expect(stats.isDirectory()).toBe(true);
        });

        it('should create nested directories', async () => {
            const nestedDir = path.join(testDir, 'level1', 'level2');
            const result = await ensureUploadDir(nestedDir);
            expect(result).toBe(true);

            // Verify nested directory exists
            const stats = await fs.stat(nestedDir);
            expect(stats.isDirectory()).toBe(true);
        });
    });

    describe('getFileUrl', () => {
        it('should return correct URL for stored filename', () => {
            const filename = 'task-12345.pdf';
            expect(getFileUrl(filename)).toBe(
                '/api/uploads/tasks/task-12345.pdf'
            );
        });

        it('should handle filenames with special characters', () => {
            const filename = 'task-12345-test_file.pdf';
            expect(getFileUrl(filename)).toBe(
                '/api/uploads/tasks/task-12345-test_file.pdf'
            );
        });

        it('should handle different file extensions', () => {
            expect(getFileUrl('file.png')).toBe('/api/uploads/tasks/file.png');
            expect(getFileUrl('file.docx')).toBe(
                '/api/uploads/tasks/file.docx'
            );
            expect(getFileUrl('file.zip')).toBe('/api/uploads/tasks/file.zip');
        });
    });

    describe('ALLOWED_TYPES constant', () => {
        it('should include PDF type', () => {
            expect(ALLOWED_TYPES['application/pdf']).toEqual(['.pdf']);
        });

        it('should include PNG type', () => {
            expect(ALLOWED_TYPES['image/png']).toEqual(['.png']);
        });

        it('should include JPEG type', () => {
            expect(ALLOWED_TYPES['image/jpeg']).toEqual(['.jpg', '.jpeg']);
        });

        it('should include Word document types', () => {
            expect(ALLOWED_TYPES['application/msword']).toEqual(['.doc']);
            expect(
                ALLOWED_TYPES[
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ]
            ).toEqual(['.docx']);
        });

        it('should include text types', () => {
            expect(ALLOWED_TYPES['text/plain']).toEqual(['.txt']);
            expect(ALLOWED_TYPES['text/markdown']).toEqual(['.md']);
        });

        it('should include spreadsheet types', () => {
            expect(ALLOWED_TYPES['application/vnd.ms-excel']).toEqual(['.xls']);
            expect(
                ALLOWED_TYPES[
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                ]
            ).toEqual(['.xlsx']);
            expect(ALLOWED_TYPES['text/csv']).toEqual(['.csv']);
        });

        it('should include archive types', () => {
            expect(ALLOWED_TYPES['application/zip']).toEqual(['.zip']);
            expect(ALLOWED_TYPES['application/x-zip-compressed']).toEqual([
                '.zip',
            ]);
        });

        it('should include all image types', () => {
            expect(ALLOWED_TYPES['image/gif']).toEqual(['.gif']);
            expect(ALLOWED_TYPES['image/svg+xml']).toEqual(['.svg']);
            expect(ALLOWED_TYPES['image/webp']).toEqual(['.webp']);
        });
    });
});
