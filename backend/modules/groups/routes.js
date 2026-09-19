'use strict';

const express = require('express');
const router = express.Router();
const groupsController = require('./controller');

router.get('/groups', groupsController.listForPicker);

router.get('/admin/groups', groupsController.list);
router.post('/admin/groups', groupsController.create);
router.get('/admin/groups/:uid', groupsController.getOne);
router.patch('/admin/groups/:uid', groupsController.update);
router.delete('/admin/groups/:uid', groupsController.delete);
router.post('/admin/groups/:uid/members', groupsController.addMembers);
router.delete(
    '/admin/groups/:uid/members/:userId',
    groupsController.removeMember
);

module.exports = router;
