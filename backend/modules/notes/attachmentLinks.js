'use strict';

// Images the browser can show inline; every other file becomes a link.
const INLINE_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
];

// Brackets and parentheses would end the markdown link early.
const label = (name) =>
    (name || '').replace(/[[\]()\n]/g, ' ').trim() || 'file';

// Markdown that shows a note's file where it sits in the text: an inline
// image, or a link that downloads the file under its own name.
function noteLinkFor(noteUid, attachment) {
    if (INLINE_IMAGE_TYPES.includes(attachment.mime_type)) {
        return `![${label(attachment.original_filename)}](${attachment.file_url})`;
    }
    return `[${label(attachment.original_filename)}](/api/note/${noteUid}/attachments/${attachment.uid}/download)`;
}

const noteLinksFor = (noteUid, attachments) =>
    attachments
        .map((attachment) => noteLinkFor(noteUid, attachment))
        .join('\n\n');

module.exports = { noteLinkFor, noteLinksFor };
