'use strict';

const express = require('express');
const router = express.Router();
const notesController = require('./controller');

// Mounted before the authentication middleware: the link is the credential.
router.get('/public/notes/:token', notesController.getPublicNote);

module.exports = router;
