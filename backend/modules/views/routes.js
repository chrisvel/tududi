'use strict';

const express = require('express');
const router = express.Router();
const viewsController = require('./controller');

router.get('/views', viewsController.getAll);
router.get('/views/pinned', viewsController.getPinned);
router.get('/views/:identifier', viewsController.getOne);
router.post('/views', viewsController.create);
router.patch('/views/:identifier', viewsController.update);
router.delete('/views/:identifier', viewsController.delete);

module.exports = router;
