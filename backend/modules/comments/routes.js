'use strict';

const express = require('express');
const router = express.Router();
const commentsController = require('./controller');
const { Task } = require('../../models');
const { isValidTaskUid } = require('../tasks/utils/validation');
const { isValidUid } = require('../../utils/slug-utils');
const { numericIdParam } = require('../../middleware/numericIdParam');

router.param('uid', numericIdParam('task', Task));

router.get('/task/:uid/comments', (req, res, next) => {
    if (!isValidTaskUid(req.params.uid)) {
        return res.status(400).json({ error: 'Invalid UID' });
    }
    return commentsController.list(req, res, next);
});

router.post('/task/:uid/comments', (req, res, next) => {
    if (!isValidTaskUid(req.params.uid)) {
        return res.status(400).json({ error: 'Invalid UID' });
    }
    return commentsController.create(req, res, next);
});

router.delete('/comment/:uid', (req, res, next) => {
    if (!isValidUid(req.params.uid)) {
        return res.status(400).json({ error: 'Invalid UID' });
    }
    return commentsController.delete(req, res, next);
});

router.post('/comment/:uid/reaction', (req, res, next) => {
    if (!isValidUid(req.params.uid)) {
        return res.status(400).json({ error: 'Invalid UID' });
    }
    return commentsController.react(req, res, next);
});

module.exports = router;
