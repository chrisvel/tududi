const express = require('express');
const { User } = require('../models');
const telegramPoller = require('../services/telegramPoller');
const router = express.Router();

// POST /api/telegram/start-polling
router.post('/telegram/start-polling', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user || !user.telegram_bot_token) {
            return res
                .status(400)
                .json({ error: 'Telegram bot token not set.' });
        }

        const success = await telegramPoller.addUser(user);

        if (success) {
            res.json({
                success: true,
                message: 'Telegram polling started',
                status: telegramPoller.getStatus(),
            });
        } else {
            res.status(500).json({
                error: 'Failed to start Telegram polling.',
            });
        }
    } catch (error) {
        console.error('Error starting Telegram polling:', error);
        res.status(500).json({ error: 'Failed to start Telegram polling.' });
    }
});

// POST /api/telegram/stop-polling
router.post('/telegram/stop-polling', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const success = telegramPoller.removeUser(req.session.userId);

        res.json({
            success: true,
            message: 'Telegram polling stopped',
            status: telegramPoller.getStatus(),
        });
    } catch (error) {
        console.error('Error stopping Telegram polling:', error);
        res.status(500).json({ error: 'Failed to stop Telegram polling.' });
    }
});

// GET /api/telegram/polling-status
router.get('/telegram/polling-status', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        res.json({
            success: true,
            status: telegramPoller.getStatus(),
        });
    } catch (error) {
        console.error('Error getting Telegram polling status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/telegram/setup
router.post('/telegram/setup', async (req, res) => {
    try {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const { token } = req.body;

        if (!token) {
            return res
                .status(400)
                .json({ error: 'Telegram bot token is required.' });
        }

        const user = await User.findByPk(req.session.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Basic token validation - check if it looks like a Telegram bot token
        if (!/^\d+:[A-Za-z0-9_-]{35}$/.test(token)) {
            return res
                .status(400)
                .json({ error: 'Invalid Telegram bot token format.' });
        }

        // Update user's telegram bot token
        await user.update({ telegram_bot_token: token });

        res.json({
            success: true,
            message: 'Telegram bot token updated successfully',
            token: token,
        });
    } catch (error) {
        console.error('Error setting up Telegram:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
