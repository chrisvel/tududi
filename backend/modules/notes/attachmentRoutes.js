'use strict';

const { hasAccess } = require('../../middleware/authorize');
const {
    createAttachmentRouter,
    noteAttachments,
} = require('../../services/entityAttachments');
const { Note } = require('../../models');
const notesController = require('./controller');

const noteUid = (req) => notesController.getNoteUidForAuth(req);
const options = { notFoundMessage: 'Note not found.' };

// Files placed in a note's text. Anyone who can read the note can open
// them; anyone who can edit it can add or remove them.
module.exports = createAttachmentRouter({
    basePath: '/note/:uid/attachments',
    store: noteAttachments,
    canRead: hasAccess('ro', 'note', noteUid, options),
    canWrite: hasAccess('rw', 'note', noteUid, options),
    loadOwner: async (req) =>
        Note.findOne({ where: { uid: await noteUid(req) } }),
});
