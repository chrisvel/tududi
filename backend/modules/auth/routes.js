'use strict';

const express = require('express');
const router = express.Router();
const authController = require('./controller');
const { authLimiter, apiLimiter } = require('../../middleware/rateLimiter');
const { csrfMiddleware } = require('../../middleware/csrf');

router.get('/version', authController.getVersion);
router.get('/registration-status', authController.getRegistrationStatus);
router.get(
    '/password-auth-status',
    apiLimiter,
    authController.getPasswordAuthStatus
);
router.get('/csrf-token', csrfMiddleware, authController.getCsrfToken);
router.post('/register', authLimiter, authController.register);
router.get('/verify-email', authLimiter, authController.verifyEmail);
router.get('/current_user', authController.getCurrentUser);
router.post('/login', authLimiter, authController.login);
router.get('/logout', authController.logout);

module.exports = router;
