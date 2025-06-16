const https = require('https');
const { User, InboxItem } = require('../models');

class TelegramPoller {
  constructor() {
    this.running = false;
    this.interval = null;
    this.pollInterval = 5000; // 5 seconds
    this.usersToPool = [];
    this.userStatus = {};
  }

  // Singleton pattern
  static getInstance() {
    if (!TelegramPoller.instance) {
      TelegramPoller.instance = new TelegramPoller();
    }
    return TelegramPoller.instance;
  }

  // Add user to polling list
  async addUser(user) {
    if (!user || !user.telegram_bot_token) {
      return false;
    }

    // Check if user already in list
    const exists = this.usersToPool.find(u => u.id === user.id);
    if (!exists) {
      this.usersToPool.push(user);
    }

    // Start polling if not already running
    if (this.usersToPool.length > 0 && !this.running) {
      this.startPolling();
    }

    return true;
  }

  // Remove user from polling list
  removeUser(userId) {
    this.usersToPool = this.usersToPool.filter(u => u.id !== userId);
    delete this.userStatus[userId];

    // Stop polling if no users left
    if (this.usersToPool.length === 0 && this.running) {
      this.stopPolling();
    }

    return true;
  }

  // Start the polling process
  startPolling() {
    if (this.running) return;

    console.log('Starting Telegram polling...');
    this.running = true;
    
    this.interval = setInterval(async () => {
      try {
        await this.pollUpdates();
      } catch (error) {
        console.error('Error polling Telegram:', error.message);
      }
    }, this.pollInterval);
  }

  // Stop the polling process
  stopPolling() {
    if (!this.running) return;

    console.log('Stopping Telegram polling...');
    this.running = false;
    
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  // Poll for updates from Telegram
  async pollUpdates() {
    for (const user of this.usersToPool) {
      const token = user.telegram_bot_token;
      if (!token) continue;

      try {
        const lastUpdateId = this.userStatus[user.id]?.lastUpdateId || 0;
        const updates = await this.getTelegramUpdates(token, lastUpdateId + 1);
        
        if (updates && updates.length > 0) {
          await this.processUpdates(user, updates);
        }
      } catch (error) {
        console.error(`Error getting updates for user ${user.id}:`, error.message);
      }
    }
  }

  // Get updates from Telegram API
  getTelegramUpdates(token, offset) {
    return new Promise((resolve, reject) => {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=1`;
      
      https.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.ok && Array.isArray(response.result)) {
              resolve(response.result);
            } else {
              console.error('Telegram API error:', response);
              resolve([]);
            }
          } catch (error) {
            reject(error);
          }
        });
      }).on('error', (error) => {
        reject(error);
      }).on('timeout', () => {
        reject(new Error('Request timeout'));
      });
    });
  }

  // Process updates received from Telegram
  async processUpdates(user, updates) {
    if (!updates.length) return;

    // Track the highest update_id
    const highestUpdateId = Math.max(...updates.map(u => u.update_id));
    
    // Save the last update ID for this user
    if (!this.userStatus[user.id]) {
      this.userStatus[user.id] = {};
    }
    this.userStatus[user.id].lastUpdateId = highestUpdateId;

    for (const update of updates) {
      try {
        if (update.message && update.message.text) {
          await this.processMessage(user, update);
        }
      } catch (error) {
        console.error(`Error processing update ${update.update_id}:`, error.message);
      }
    }
  }

  // Process a single message
  async processMessage(user, update) {
    const message = update.message;
    const text = message.text;
    const chatId = message.chat.id.toString();
    const messageId = message.message_id;

    console.log(`Processing message from user ${user.id}: ${text}`);

    // Save the chat_id if not already saved
    if (!user.telegram_chat_id) {
      console.log(`Updating user's telegram_chat_id to ${chatId}`);
      await User.update(
        { telegram_chat_id: chatId },
        { where: { id: user.id } }
      );
      user.telegram_chat_id = chatId; // Update local object
    }

    try {
      // Create an inbox item
      const inboxItem = await InboxItem.create({
        content: text,
        source: 'telegram',
        user_id: user.id
      });

      console.log(`Created inbox item ${inboxItem.id} from Telegram message`);

      // Send confirmation
      await this.sendTelegramMessage(
        user.telegram_bot_token,
        chatId,
        `✅ Added to Tududi inbox: "${text}"`,
        messageId
      );
    } catch (error) {
      console.error('Failed to create inbox item:', error.message);

      // Send error message
      await this.sendTelegramMessage(
        user.telegram_bot_token,
        chatId,
        `❌ Failed to add to inbox: ${error.message}`,
        messageId
      );
    }
  }

  // Send a message to Telegram
  sendTelegramMessage(token, chatId, text, replyToMessageId = null) {
    return new Promise((resolve, reject) => {
      const messageParams = {
        chat_id: chatId,
        text: text
      };

      if (replyToMessageId) {
        messageParams.reply_to_message_id = replyToMessageId;
      }

      const postData = JSON.stringify(messageParams);
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            resolve(response);
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // Get status of the poller
  getStatus() {
    return {
      running: this.running,
      usersCount: this.usersToPool.length,
      pollInterval: this.pollInterval,
      userStatus: this.userStatus
    };
  }
}

module.exports = TelegramPoller;