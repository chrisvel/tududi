'use strict';

const express = require('express');
const router = express.Router();
const adminController = require('./controller');
const { requireSuperadminMfa } = require('./mfaGate');

// All routes require authentication (handled by app.js middleware)
// Admin verification is done in the service layer

// On a hosted instance the superadmin can see every customer, so the admin
// panel stays closed to that account until it has two-factor sign-in on.
// Mounted before the other modules' /admin routes, so it covers those too.
router.use('/admin', requireSuperadminMfa);

router.post('/admin/set-admin-role', adminController.setAdminRole);
router.get('/admin/overview', adminController.overview);
router.get('/admin/overview/users', adminController.userStatuses);
router.get('/admin/users/:id/emails', adminController.userEmails);
router.get(
    '/admin/users/:id/emails/:key/preview',
    adminController.previewUserEmail
);
router.post('/admin/users/:id/emails/:key/send', adminController.sendUserEmail);
router.get('/admin/waitlist', adminController.listWaitlist);
router.get('/admin/waitlist/export', adminController.exportWaitlist);
router.delete('/admin/waitlist/:id', adminController.deleteWaitlistEntry);
router.get('/admin/roles', adminController.listRoles);
router.get('/admin/users', adminController.listUsers);
router.post('/admin/users', adminController.createUser);
router.put('/admin/users/:id', adminController.updateUser);
router.delete('/admin/users/:id', adminController.deleteUser);
router.post('/admin/users/:id/mfa/reset', adminController.resetUserMfa);
router.post('/admin/toggle-registration', adminController.toggleRegistration);
router.get('/admin/oidc-config', adminController.getOidcConfig);
router.put('/admin/oidc-config', adminController.updateOidcConfig);
router.get('/admin/blog', adminController.getBlog);
router.put('/admin/blog', adminController.updateBlog);

module.exports = router;
