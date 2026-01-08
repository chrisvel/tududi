'use strict';

const express = require('express');
const router = express.Router();
const tagsController = require('./controller');

// All routes require authentication (handled by app.js middleware)

router.get('/tags', tagsController.list);
router.get('/tag', tagsController.getOne);
router.post('/tag', tagsController.create);
router.patch('/tag/:identifier', tagsController.update);
router.delete('/tag/:identifier', tagsController.delete);

module.exports = router;
