'use strict';

const express = require('express');
const router = express.Router();
const goalsController = require('./controller');

router.get('/goals', goalsController.list);
router.get('/goals/:uid', goalsController.getOne);
router.post('/goals', goalsController.create);
router.patch('/goals/:uid', goalsController.update);
router.delete('/goals/:uid', goalsController.delete);

module.exports = router;
