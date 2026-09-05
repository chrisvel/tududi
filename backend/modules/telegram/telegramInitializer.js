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
    const leaderRetryDelay = 60000; // 1 minute

    // Telegram's getUpdates confirms updates by offset, and the offsets live
    // in this process's memory, so exactly one process may poll. Whoever
    // holds the leader lock polls; the others retry in case it goes away.
    const { tryBecomeLeader } = require('../../services/jobLock');

    const startWhenLeader = async () => {
        if (!(await tryBecomeLeader('telegram-poller'))) {
            setTimeout(startWhenLeader, leaderRetryDelay);
            return;
        }
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
    };

    setTimeout(startWhenLeader, startupDelay);
}

module.exports = { initializeTelegramPolling };
