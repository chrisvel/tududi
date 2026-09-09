'use strict';

const express = require('express');
const router = express.Router();
const authController = require('./controller');
const {
    authLimiter,
    authEmailLimiter,
    apiLimiter,
} = require('../../middleware/rateLimiter');
const { csrfMiddleware } = require('../../middleware/csrf');
const { requireCaptcha } = require('../../middleware/captcha');

router.get('/version', authController.getVersion);
router.get('/config', authController.getPublicConfig);
router.get('/registration-status', authController.getRegistrationStatus);
router.get(
    '/password-auth-status',
    apiLimiter,
    authController.getPasswordAuthStatus
);
router.get('/csrf-token', csrfMiddleware, authController.getCsrfToken);
router.post('/waitlist', authLimiter, authController.joinWaitlist);
router.post('/register', authLimiter, requireCaptcha, authController.register);
router.get('/verify-email', authLimiter, authController.verifyEmail);
router.post(
    '/resend-verification',
    authLimiter,
    authEmailLimiter,
    requireCaptcha,
    authController.resendVerification
);
router.get('/current_user', authController.getCurrentUser);
router.post('/login', authLimiter, authEmailLimiter, authController.login);
router.post(
    '/forgot-password',
    authLimiter,
    authEmailLimiter,
    requireCaptcha,
    authController.forgotPassword
);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.get('/logout', authController.logout);

module.exports = router;
