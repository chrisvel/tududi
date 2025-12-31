'use strict';

const express = require('express');
const router = express.Router();
const sharesController = require('./controller');

router.post('/shares', sharesController.create);
router.delete('/shares', sharesController.delete);
router.get('/shares', sharesController.getAll);

module.exports = router;
