'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('./controller');

// All routes require authentication (handled by app.js middleware)
// Admin verification is done in the service layer

router.post('/admin/set-admin-role', adminController.setAdminRole);
router.get('/admin/users', adminController.listUsers);
router.post('/admin/users', adminController.createUser);
router.put('/admin/users/:id', adminController.updateUser);
router.delete('/admin/users/:id', adminController.deleteUser);
router.post('/admin/toggle-registration', adminController.toggleRegistration);

module.exports = router;
