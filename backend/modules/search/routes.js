'use strict';

const express = require('express');
const router = express.Router();
const searchController = require('./controller');

router.get('/search', searchController.search);

module.exports = router;
