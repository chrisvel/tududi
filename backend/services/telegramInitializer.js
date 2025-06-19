const telegramPoller = require('./telegramPoller');
const { User } = require('../models');

async function initializeTelegramPolling() {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_TELEGRAM === 'true') {
    return;
  }

  try {
    // Find users with configured Telegram tokens
    const usersWithTelegram = await User.findAll({
      where: {
        telegram_bot_token: {
          [require('sequelize').Op.ne]: null
        }
      }
    });

    if (usersWithTelegram.length > 0) {
      // Add each user to the polling list
      for (const user of usersWithTelegram) {
        await telegramPoller.addUser(user);
      }
    }
  } catch (error) {
    // Telegram polling will be initialized later when the database is available
  }
}

module.exports = { initializeTelegramPolling };