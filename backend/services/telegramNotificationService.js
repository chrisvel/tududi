const { sendTelegramMessage } = require('./telegramPoller');

/**
 * Check if user has Telegram properly configured
 * @param {Object} user - User model instance
 * @returns {boolean} - True if user has both bot token and chat ID
 */
function isTelegramConfigured(user) {
    return !!(user && user.telegram_bot_token && user.telegram_chat_id);
}

/**
 * Format notification into a user-friendly Telegram message
 * @param {Object} user - User model instance with name/username
 * @param {Object} notification - Notification object with title, message, level, data
 * @returns {string} - Formatted message string
 */
function formatNotificationMessage(user, notification) {
    const { title, message } = notification;

    // Get user's name (use name field, fallback to 'there')
    const userName = user.name || 'there';

    // Build the message with user name
    let formattedMessage = `${userName}, ${message || title}`;

    return formattedMessage;
}

/**
 * Send a notification to the user via Telegram
 * @param {Object} user - User model instance with telegram_bot_token and telegram_chat_id
 * @param {Object} notification - Notification object with title, message, level, data
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
async function sendTelegramNotification(user, notification) {
    try {
        // Check if Telegram is configured
        if (!isTelegramConfigured(user)) {
            return {
                success: false,
                error: 'Telegram not configured for user',
            };
        }

        // Format the notification message
        const formattedMessage = formatNotificationMessage(user, notification);

        // Send the message via Telegram
        await sendTelegramMessage(
            user.telegram_bot_token,
            user.telegram_chat_id,
            formattedMessage
        );

        return { success: true };
    } catch (error) {
        console.error('Failed to send Telegram notification:', error);
        return {
            success: false,
            error: error.message || 'Unknown error',
        };
    }
}

module.exports = {
    isTelegramConfigured,
    formatNotificationMessage,
    sendTelegramNotification,
};
