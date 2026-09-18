'use strict';

const express = require('express');
const router = express.Router();
const webhooksController = require('./controller');

router.get('/webhooks', webhooksController.list);
router.post('/webhooks', webhooksController.create);
router.patch('/webhooks/:uid', webhooksController.update);
router.delete('/webhooks/:uid', webhooksController.remove);
router.post('/webhooks/:uid/rotate-secret', webhooksController.rotateSecret);
router.post('/webhooks/:uid/test', webhooksController.sendTest);

module.exports = router;
