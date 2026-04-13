const telegramPoller = require('./telegramPoller');
const { User } = require('../../models');
const { setConfig, getConfig } = require('../../config/config');
const config = getConfig();

async function initializeTelegramPolling() {
    if (config.environment === 'test' || config.disableTelegram) {
        return;
    }

    // Add a delay before starting Telegram polling to allow the system to settle
    // and prevent immediate error floods if Telegram is temporarily unreachable
    const startupDelay = 10000; // 10 seconds

    setTimeout(async () => {
        try {
            // Find users with configured Telegram tokens
            const usersWithTelegram = await User.findAll({
                where: {
                    telegram_bot_token: {
                        [require('sequelize').Op.ne]: null,
                    },
                },
            });

            if (usersWithTelegram.length > 0) {
                console.log(
                    `Initializing Telegram polling for ${usersWithTelegram.length} user(s)...`
                );
                // Add each user to the polling list
                for (const user of usersWithTelegram) {
                    await telegramPoller.addUser(user);
                }
            }
        } catch (error) {
            console.error(
                'Error initializing Telegram polling:',
                error.message
            );
        }
    }, startupDelay);
}

module.exports = { initializeTelegramPolling };
