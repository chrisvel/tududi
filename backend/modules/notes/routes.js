'use strict';

const express = require('express');
const router = express.Router();
const notesController = require('./controller');
const { hasAccess } = require('../../middleware/authorize');

// All routes require authentication (handled by app.js middleware)

// List all notes
router.get('/notes', notesController.list);

// Get a single note (requires read access)
router.get(
    '/note/:uidSlug',
    hasAccess(
        'ro',
        'note',
        (req) => notesController.getNoteUidForAuth(req),
        { notFoundMessage: 'Note not found.' }
    ),
    notesController.getOne
);

// Create a new note
router.post('/note', notesController.create);

// Update a note (requires write access)
router.patch(
    '/note/:uid',
    hasAccess(
        'rw',
        'note',
        (req) => notesController.getNoteUidForAuth(req),
        { notFoundMessage: 'Note not found.' }
    ),
    notesController.update
);

// Delete a note (requires write access)
router.delete(
    '/note/:uid',
    hasAccess(
        'rw',
        'note',
        (req) => notesController.getNoteUidForAuth(req),
        { notFoundMessage: 'Note not found.' }
    ),
    notesController.delete
);

module.exports = router;
