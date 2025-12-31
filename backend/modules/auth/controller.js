'use strict';

const authService = require('./service');
const { logError } = require('../../services/logService');

const authController = {
    getVersion(req, res) {
        res.json(authService.getVersion());
    },

    async getRegistrationStatus(req, res, next) {
        try {
            const result = await authService.getRegistrationStatus();
            res.json(result);
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
            if (error.message === 'Failed to send verification email. Please try again later.') {
                return res.status(500).json({ error: error.message });
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
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password, req.session);
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 401) {
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

    async logout(req, res, next) {
        try {
            const result = await authService.logout(req.session);
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },
};

module.exports = authController;
