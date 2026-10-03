'use strict';

const express = require('express');
const router = express.Router();
const notesController = require('./controller');
const { uploadsLimiter } = require('../../middleware/rateLimiter');

// Mounted before the authentication middleware: the link is the credential.
router.get('/public/notes/:token', notesController.getPublicNote);
// Files read from disk get the same limit as the signed-in /uploads path.
router.get(
    '/public/notes/:token/files/:filename',
    uploadsLimiter,
    notesController.getPublicNoteFile
);

module.exports = router;
