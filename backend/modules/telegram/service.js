'use strict';

const { User } = require('../../models');
const { logError } = require('../../services/logService');
const telegramPoller = require('./telegramPoller');
const { getBotInfo } = require('./telegramApi');
const {
    NotFoundError,
    ValidationError,
    UnauthorizedError,
} = require('../../shared/errors');

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

class TelegramService {
    async startPolling(userId) {
        const user = await User.findByPk(userId);
        if (!user || !user.telegram_bot_token) {
            throw new ValidationError('Telegram bot token not set.');
        }

        const success = await telegramPoller.addUser(user);

        if (success) {
            return {
                success: true,
                message: 'Telegram polling started',
                status: telegramPoller.getStatus(),
            };
        } else {
            throw new Error('Failed to start Telegram polling.');
        }
    }

    async stopPolling(userId) {
        const success = telegramPoller.removeUser(userId);

        return {
            success: true,
            message: 'Telegram polling stopped',
            status: telegramPoller.getStatus(),
        };
    }

    getPollingStatus() {
        return {
            success: true,
            status: telegramPoller.getStatus(),
        };
    }

    async setup(userId, token) {
        if (!token) {
            throw new ValidationError('Telegram bot token is required.');
        }

        const user = await User.findByPk(userId);
        if (!user) {
            throw new NotFoundError('User not found.');
        }

        // Basic token validation - check if it looks like a Telegram bot token
        if (!/^\d+:[A-Za-z0-9_-]{35}$/.test(token)) {
            throw new ValidationError('Invalid Telegram bot token format.');
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
                throw new ValidationError(
                    'Invalid bot token or bot not accessible.'
                );
            }
        }

        // Update user's telegram bot token
        await user.update({ telegram_bot_token: token });

        return {
            success: true,
            message: 'Telegram bot token updated successfully',
            bot: botInfo,
        };
    }

    async sendWelcome(userId, chatId) {
        const user = await User.findByPk(userId);
        if (!user || !user.telegram_bot_token) {
            throw new ValidationError('Telegram bot token not set.');
        }

        if (!chatId) {
            throw new ValidationError('Chat ID is required.');
        }

        // Send welcome message
        const success = await sendWelcomeMessage(
            user.telegram_bot_token,
            chatId
        );

        if (success) {
            return {
                success: true,
                message: 'Welcome message sent successfully',
            };
        } else {
            throw new Error('Failed to send welcome message.');
        }
    }
}

module.exports = new TelegramService();
