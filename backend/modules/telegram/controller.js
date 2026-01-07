'use strict';

const telegramService = require('./service');
const { logError } = require('../../services/logService');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

const telegramController = {
    async startPolling(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }
            const result = await telegramService.startPolling(userId);
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            logError('Error starting Telegram polling:', error);
            res.status(500).json({
                error: 'Failed to start Telegram polling.',
            });
        }
    },

    async stopPolling(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }
            const result = await telegramService.stopPolling(userId);
            res.json(result);
        } catch (error) {
            logError('Error stopping Telegram polling:', error);
            res.status(500).json({ error: 'Failed to stop Telegram polling.' });
        }
    },

    async getPollingStatus(req, res, next) {
        try {
            const result = telegramService.getPollingStatus();
            res.json(result);
        } catch (error) {
            logError('Error getting Telegram polling status:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async setup(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }
            const { token } = req.body;
            const result = await telegramService.setup(userId, token);
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            if (error.statusCode === 404) {
                return res.status(404).json({ error: error.message });
            }
            logError('Error setting up Telegram:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    async sendWelcome(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Authentication required' });
            }
            const { chatId } = req.body;
            const result = await telegramService.sendWelcome(userId, chatId);
            res.json(result);
        } catch (error) {
            if (error.statusCode === 400) {
                return res.status(400).json({ error: error.message });
            }
            logError('Error sending welcome message:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },
};

module.exports = telegramController;
