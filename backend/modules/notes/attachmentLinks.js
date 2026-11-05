'use strict';

// Images and videos the browser can show inline; every other file becomes a
// link. Notes render image syntax pointing at a video as a player.
const INLINE_IMAGE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
];

// Brackets and parentheses would end the markdown link early.
const label = (name) =>
    (name || '').replace(/[[\]()\n]/g, ' ').trim() || 'file';

// Markdown that shows a note's file where it sits in the text: an inline
// image or video, or a link that downloads the file under its own name.
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
