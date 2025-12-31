'use strict';

const express = require('express');
const router = express.Router();
const quotesController = require('./controller');

router.get('/quotes/random', quotesController.getRandom);
router.get('/quotes', quotesController.getAll);

module.exports = router;
