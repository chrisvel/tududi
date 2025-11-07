const express = require('express');
const { User } = require('../models');
const { logError } = require('../services/logService');
const telegramPoller = require('../services/telegramPoller');
const { getBotInfo } = require('../services/telegramApi');
const router = express.Router();
const { getAuthenticatedUserId } = require('../utils/request-utils');

const getUserIdOrUnauthorized = (req, res) => {
    const userId = getAuthenticatedUserId(req);
    if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    return userId;
};

// POST /api/telegram/start-polling
router.post('/telegram/start-polling', async (req, res) => {
    try {
        const userId = getUserIdOrUnauthorized(req, res);
        if (!userId) return;
        const user = await User.findByPk(userId);
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
        logError('Error starting Telegram polling:', error);
        res.status(500).json({ error: 'Failed to start Telegram polling.' });
    }
});

// POST /api/telegram/stop-polling
router.post('/telegram/stop-polling', async (req, res) => {
    try {
        const userId = getUserIdOrUnauthorized(req, res);
        if (!userId) return;
        const success = telegramPoller.removeUser(userId);

        res.json({
            success: true,
            message: 'Telegram polling stopped',
            status: telegramPoller.getStatus(),
        });
    } catch (error) {
        logError('Error stopping Telegram polling:', error);
        res.status(500).json({ error: 'Failed to stop Telegram polling.' });
    }
});

// GET /api/telegram/polling-status
router.get('/telegram/polling-status', async (req, res) => {
    try {
        res.json({
            success: true,
            status: telegramPoller.getStatus(),
        });
    } catch (error) {
        logError('Error getting Telegram polling status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/telegram/setup
router.post('/telegram/setup', async (req, res) => {
    try {
        const userId = getUserIdOrUnauthorized(req, res);
        if (!userId) return;
        const { token } = req.body;

        if (!token) {
            return res
                .status(400)
                .json({ error: 'Telegram bot token is required.' });
        }

        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Basic token validation - check if it looks like a Telegram bot token
        if (!/^\d+:[A-Za-z0-9_-]{35}$/.test(token)) {
            return res
                .status(400)
                .json({ error: 'Invalid Telegram bot token format.' });
        }

        // Get bot info from Telegram API
        // Skip actual API call in test environment
        let botInfo;
        if (process.env.NODE_ENV === 'test') {
            // Mock response for tests
            botInfo = {
                id: 123456789,
                is_bot: true,
                first_name: 'Test Bot',
                username: 'testbot',
            };
        } else {
            botInfo = await getBotInfo(token);
            if (!botInfo) {
                return res.status(400).json({
                    error: 'Invalid bot token or bot not accessible.',
                });
            }
        }

        // Update user's telegram bot token
        await user.update({ telegram_bot_token: token });

        res.json({
            success: true,
            message: 'Telegram bot token updated successfully',
            bot: botInfo,
        });
    } catch (error) {
        logError('Error setting up Telegram:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/telegram/send-welcome
router.post('/telegram/send-welcome', async (req, res) => {
    try {
        const userId = getUserIdOrUnauthorized(req, res);
        if (!userId) return;
        const user = await User.findByPk(userId);
        if (!user || !user.telegram_bot_token) {
            return res
                .status(400)
                .json({ error: 'Telegram bot token not set.' });
        }

        const { chatId } = req.body;
        if (!chatId) {
            return res.status(400).json({ error: 'Chat ID is required.' });
        }

        // Send welcome message
        const success = await sendWelcomeMessage(
            user.telegram_bot_token,
            chatId
        );

        if (success) {
            res.json({
                success: true,
                message: 'Welcome message sent successfully',
            });
        } else {
            res.status(500).json({
                error: 'Failed to send welcome message.',
            });
        }
    } catch (error) {
        logError('Error sending welcome message:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to send welcome message
async function sendWelcomeMessage(token, chatId) {
    return new Promise((resolve) => {
        const welcomeText = `🎉 Welcome to tududi!\n\nYour personal task management bot is now connected and ready to help!\n\n📝 Simply send me any message and I'll add it to your tududi inbox as an item.\n\n✨ Commands:\n• /help - Show help information\n• Just type any text - Add it as an inbox item\n\nLet's get organized! 🚀`;

        const postData = JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
        });

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = require('https').request(url, options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.ok) {
                        console.log('Welcome message sent successfully');
                        resolve(true);
                    } else {
                        logError(
                            'Failed to send welcome message:',
                            response.description
                        );
                        resolve(false);
                    }
                } catch (error) {
                    logError('Error parsing welcome message response:', error);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            logError('Error sending welcome message:', error);
            resolve(false);
        });

        req.write(postData);
        req.end();
    });
}

module.exports = router;
