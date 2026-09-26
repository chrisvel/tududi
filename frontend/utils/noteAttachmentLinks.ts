import { FileAttachment } from '../entities/Attachment';

// Images the browser can show inline; every other file becomes a link.
const INLINE_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];

// Brackets and parentheses would end the markdown link early.
const label = (name: string) =>
    (name || '').replace(/[[\]()\n]/g, ' ').trim() || 'file';

// Markdown that shows a note's file where it sits in the text. Matches
// backend/modules/notes/attachmentLinks.js, which writes the same links when
// an inbox item becomes a note. Stored text keeps the plain /api path, like
// the file URLs the server returns.
export const noteLinkFor = (
    noteUid: string,
    attachment: FileAttachment
): string => {
    const name = label(attachment.original_filename);
    if (INLINE_IMAGE_TYPES.includes(attachment.mime_type)) {
        return `![${name}](${attachment.file_url})`;
    }
    return `[${name}](/api/note/${noteUid}/attachments/${attachment.uid}/download)`;
};

export const noteLinksFor = (
    noteUid: string,
    attachments: FileAttachment[]
): string =>
    attachments
        .map((attachment) => noteLinkFor(noteUid, attachment))
        .join('\n\n');
