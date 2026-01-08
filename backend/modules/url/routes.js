'use strict';

const express = require('express');
const router = express.Router();
const urlController = require('./controller');

router.get('/url/title', urlController.getTitle);
router.post('/url/extract-from-text', urlController.extractFromText);

module.exports = router;
