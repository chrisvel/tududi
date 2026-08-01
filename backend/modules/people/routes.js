'use strict';

const express = require('express');
const router = express.Router();
const peopleController = require('./controller');

router.get('/people', peopleController.list);
router.get('/people/:uid', peopleController.getOne);
router.post('/people', peopleController.create);
router.patch('/people/:uid', peopleController.update);
router.delete('/people/:uid', peopleController.delete);

module.exports = router;
