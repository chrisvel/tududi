const TelegramPoller = require('./telegramPoller');
const { User } = require('../models');

async function initializeTelegramPolling() {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_TELEGRAM === 'true') {
    return;
  }

  console.log('Initializing Telegram polling for configured users...');

  try {
    // Get singleton instance of the poller
    const poller = TelegramPoller.getInstance();

    // Find users with configured Telegram tokens
    const usersWithTelegram = await User.findAll({
      where: {
        telegram_bot_token: {
          [require('sequelize').Op.ne]: null
        }
      }
    });

    if (usersWithTelegram.length > 0) {
      console.log(`Found ${usersWithTelegram.length} users with Telegram configuration`);

      // Add each user to the polling list
      for (const user of usersWithTelegram) {
        console.log(`Starting Telegram polling for user ${user.id}`);
        await poller.addUser(user);
      }

      console.log('Telegram polling initialized successfully');
    } else {
      console.log('No users with Telegram configuration found');
    }
  } catch (error) {
    console.error('Error initializing Telegram polling:', error.message);
    console.error('Telegram polling will be initialized later when the database is available.');
  }
}

module.exports = { initializeTelegramPolling };