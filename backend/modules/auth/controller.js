'use strict';

const authService = require('./service');
const { logError } = require('../../services/logService');
const { generateToken } = require('../../middleware/csrf');
const { isPasswordAuthEnabled } = require('../../config/authConfig');
const { getConfig } = require('../../config/config');
const auditService = require('../oidc/auditService');

const authController = {
    getVersion(req, res) {
        res.json(authService.getVersion());
    },

    getPublicConfig(req, res) {
        const config = getConfig();
        res.json({
            fileUploadLimitMB: config.fileUploadLimitMB,
        });
    },

    async getRegistrationStatus(req, res, next) {
        try {
            const result = await authService.getRegistrationStatus();
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    getPasswordAuthStatus(req, res, next) {
        try {
            res.json({ enabled: isPasswordAuthEnabled() });
        } catch (error) {
            next(error);
        }
    },

    async register(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await authService.register(email, password);
            res.status(201).json(result);
        } catch (error) {
            // Handle specific error messages for compatibility
            if (error.statusCode === 404) {
                return res.status(404).json({ error: error.message });
            }
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 403) {
                return res.status(403).json({ error: error.message });
            }
            if (error.statusCode === 503) {
                logError('Registration email failure:', error);
                return res.status(503).json({ error: error.message });
            }
            logError('Registration error:', error);
            res.status(500).json({
                error: 'Registration failed. Please try again.',
            });
        }
    },

    async verifyEmail(req, res, next) {
        try {
            const { token } = req.query;
            const result = await authService.verifyEmail(token);
            res.redirect(result.redirect);
        } catch (error) {
            next(error);
        }
    },

    async getCurrentUser(req, res, next) {
        try {
            const result = await authService.getCurrentUser(req.session);
            res.json(result);
        } catch (error) {
            logError('Error fetching current user:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async login(req, res, next) {
        const { email, password } = req.body;
        try {
            const result = await authService.login(
                email,
                password,
                req.session
            );
            await auditService.logLoginSuccess(
                req.session.userId,
                auditService.AUTH_METHODS.EMAIL_PASSWORD,
                req
            );
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 401) {
                await auditService.logLoginFailed(
                    typeof email === 'string'
                        ? email.trim().toLowerCase()
                        : null,
                    auditService.AUTH_METHODS.EMAIL_PASSWORD,
                    req,
                    null,
                    'invalid_credentials'
                );
                return res.status(401).json({ errors: [error.message] });
            }
            if (error.statusCode === 403) {
                return res.status(403).json({
                    error: error.message,
                    email_not_verified: error.email_not_verified || false,
                });
            }
            logError('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async resendVerification(req, res, next) {
        try {
            const result = await authService.resendVerification(req.body.email);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async forgotPassword(req, res, next) {
        try {
            const result = await authService.forgotPassword(req.body.email);
            res.json(result);
        } catch (error) {
            next(error);
        }
    },

    async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            const result = await authService.resetPassword(token, password);
            await auditService.logEvent({
                userId: null,
                eventType: auditService.EVENT_TYPES.PASSWORD_RESET,
                authMethod: auditService.AUTH_METHODS.EMAIL_PASSWORD,
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                metadata: { email: result.email },
            });
            res.json({ message: result.message });
        } catch (error) {
            next(error);
        }
    },

    async logout(req, res, next) {
        try {
            const result = await authService.logout(req.session);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getCsrfToken(req, res) {
        const token = generateToken(req, res);
        res.json({ csrfToken: token });
    },
};

module.exports = authController;
