const https = require('https');
const { User, InboxItem } = require('../models');

// Create poller state
const createPollerState = () => ({
    running: false,
    interval: null,
    pollInterval: 5000, // 5 seconds
    usersToPool: [],
    userStatus: {},
    processedUpdates: new Set(), // Track processed update IDs to prevent duplicates
});

// Global mutable state (managed functionally)
let pollerState = createPollerState();

// Check if user exists in list
const userExistsInList = (users, userId) => users.some((u) => u.id === userId);

// Add user to list
const addUserToList = (users, user) => {
    if (userExistsInList(users, user.id)) {
        return users;
    }
    return [...users, user];
};

// Remove user from list
const removeUserFromList = (users, userId) =>
    users.filter((u) => u.id !== userId);

// Remove user status
const removeUserStatus = (userStatus, userId) => {
    const { [userId]: removed, ...rest } = userStatus;
    return rest;
};

// Update user status
const updateUserStatus = (userStatus, userId, updates) => ({
    ...userStatus,
    [userId]: {
        ...userStatus[userId],
        ...updates,
    },
});

// Get highest update ID from updates
const getHighestUpdateId = (updates) => {
    if (!updates.length) return 0;
    return Math.max(...updates.map((u) => u.update_id));
};

// Build a unique processed update key shared across users of same bot token
const getProcessedUpdateKey = (user, updateId) => {
    const tokenPart = user.telegram_bot_token || `user-${user.id}`;
    return `${tokenPart}-${updateId}`;
};

// Create message parameters
const createMessageParams = (
    chatId,
    text,
    replyToMessageId = null,
    parseMode = undefined
) => {
    const params = { chat_id: chatId, text: text };
    if (replyToMessageId) {
        params.reply_to_message_id = replyToMessageId;
    }
    if (parseMode) {
        params.parse_mode = parseMode;
    } else if (
        typeof text === 'string' &&
        text.startsWith("📋 *Today's Task Summary*")
    ) {
        // Ensure Task Summary messages render as MarkdownV2
        params.parse_mode = 'MarkdownV2';
    }
    return params;
};

// Create Telegram API URL
const createTelegramUrl = (token, endpoint, params = {}) => {
    const baseUrl = `https://api.telegram.org/bot${token}/${endpoint}`;
    if (Object.keys(params).length === 0) return baseUrl;

    const searchParams = new URLSearchParams(params);
    return `${baseUrl}?${searchParams}`;
};

// Side effect function to make HTTP GET request
const makeHttpGetRequest = (url, timeout = 5000) => {
    return new Promise((resolve, reject) => {
        https
            .get(url, { timeout }, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                });
            })
            .on('error', (error) => {
                reject(error);
            })
            .on('timeout', () => {
                reject(new Error('Request timeout'));
            });
    });
};

// Side effect function to make HTTP POST request
const makeHttpPostRequest = (url, postData, options) => {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
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
};

// Side effect function to get Telegram updates
const getTelegramUpdates = async (token, offset) => {
    try {
        // Keep a low timeout to avoid blocking HTTP server in tests/CI
        const url = createTelegramUrl(token, 'getUpdates', {
            offset: offset.toString(),
            timeout: '1',
        });

        const response = await makeHttpGetRequest(url, 5000);

        if (response.ok && Array.isArray(response.result)) {
            return response.result;
        } else {
            return [];
        }
    } catch (error) {
        throw error;
    }
};

// Side effect function to send Telegram message
const sendTelegramMessage = async (
    token,
    chatId,
    text,
    replyToMessageId = null,
    options = {}
) => {
    try {
        const messageParams = createMessageParams(
            chatId,
            text,
            replyToMessageId,
            options.parseMode
        );
        const postData = JSON.stringify(messageParams);
        const url = createTelegramUrl(token, 'sendMessage');

        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        return await makeHttpPostRequest(url, postData, requestOptions);
    } catch (error) {
        throw error;
    }
};

// Side effect function to update user chat ID
const updateUserChatId = async (userId, chatId) => {
    await User.update({ telegram_chat_id: chatId }, { where: { id: userId } });
};

// Side effect function to create inbox item
const createInboxItem = async (content, userId, messageId) => {
    // Check if a similar item was created recently (within last 30 seconds)
    // to prevent duplicates from network issues or multiple processing
    const recentCutoff = new Date(Date.now() - 30000); // 30 seconds ago

    const existingItem = await InboxItem.findOne({
        where: {
            content: content,
            user_id: userId,
            source: 'telegram',
            created_at: {
                [require('sequelize').Op.gte]: recentCutoff,
            },
        },
    });

    if (existingItem) {
        console.log(
            `Duplicate inbox item detected for user ${userId}, content: "${content}". Skipping creation.`
        );
        return existingItem;
    }

    return await InboxItem.create({
        content: content,
        source: 'telegram',
        user_id: userId,
        metadata: { telegram_message_id: messageId }, // Store message ID for reference
    });
};

// Function to check if a Telegram user is authorized
const isAuthorizedTelegramUser = (user, message) => {
    // If no whitelist is configured, allow all users (default behavior)
    if (
        !user.telegram_allowed_users ||
        user.telegram_allowed_users.trim() === ''
    ) {
        return true;
    }

    const allowedUsers = user.telegram_allowed_users
        .split(',')
        .map((u) => u.trim().toLowerCase())
        .filter((u) => u.length > 0);

    if (allowedUsers.length === 0) {
        return true; // Empty whitelist means allow all
    }

    const fromUser = message.from;
    if (!fromUser) {
        return false; // No sender information
    }

    // Check by user ID (numeric)
    const userId = fromUser.id.toString();
    if (allowedUsers.includes(userId)) {
        return true;
    }

    // Check by username (with or without @ prefix)
    if (fromUser.username) {
        const username = fromUser.username.toLowerCase();
        if (
            allowedUsers.includes(username) ||
            allowedUsers.includes(`@${username}`)
        ) {
            return true;
        }
    }

    return false;
};

// Function to handle bot commands
const handleBotCommand = async (command, user, chatId, messageId) => {
    const botToken = user.telegram_bot_token;

    switch (command.toLowerCase()) {
        case '/start':
            await sendTelegramMessage(
                botToken,
                chatId,
                `🎉 Welcome to tududi!\n\nYour personal task management bot is now connected and ready to help!\n\n📝 Simply send me any message and I'll add it to your tududi inbox as an item.\n\n✨ Commands:\n• /help - Show help information\n• /start - Show welcome message\n• Just type any text - Add it as an inbox item\n\nLet's get organized! 🚀`,
                messageId
            );
            break;
        case '/help':
            await sendTelegramMessage(
                botToken,
                chatId,
                `📋 tududi Bot Help\n\nSend me any text message and I'll add it to your tududi inbox as an inbox item.\n\nCommands:\n/start - Welcome message\n/help - Show this help message\n\nJust type your item and I'll take care of the rest!`,
                messageId
            );
            break;
        default:
            await sendTelegramMessage(
                botToken,
                chatId,
                `❓ Unknown command: ${command}\n\nUse /help to see available commands or just send a regular message to add it to your inbox.`,
                messageId
            );
            break;
    }
};

// Function to process a single message (contains side effects)
const processMessage = async (user, update) => {
    const message = update.message;
    const text = message.text;
    const chatId = message.chat.id.toString();
    const messageId = message.message_id;

    // Check if the user is authorized to send messages to this bot
    if (!isAuthorizedTelegramUser(user, message)) {
        console.log(
            `Ignoring message from unauthorized Telegram user ${message.from.id} (@${message.from.username || 'no_username'}) for bot owner ${user.id}`
        );
        return; // Silently ignore unauthorized users
    }

    // If this user already has a chat bound and it doesn't match this update, ignore
    if (user.telegram_chat_id && user.telegram_chat_id !== chatId) {
        return;
    }

    // Update chat ID if needed and send welcome message for new users
    if (!user.telegram_chat_id) {
        // Ensure no other user with the same bot token already owns this chat
        const existingOwner = await User.findOne({
            where: {
                telegram_bot_token: user.telegram_bot_token,
                telegram_chat_id: chatId,
            },
        });

        if (existingOwner && existingOwner.id !== user.id) {
            // Another user already owns this chat for this token; ignore
            return;
        }

        await updateUserChatId(user.id, chatId);
        user.telegram_chat_id = chatId; // Update local object

        // Send welcome message for first-time users
        await sendTelegramMessage(
            user.telegram_bot_token,
            chatId,
            `🎉 Welcome to tududi!\n\nYour personal task management bot is now connected and ready to help!\n\n📝 Simply send me any message and I'll add it to your tududi inbox as an inbox item.\n\n✨ Commands:\n• /help - Show help information\n• /start - Show welcome message\n• Just type any text - Add it as an inbox item\n\nLet's get organized! 🚀`
        );

        console.log(
            `Sent welcome message to new user ${user.id} in chat ${chatId}`
        );

        // If the first message was just /start, don't process it further
        if (text.toLowerCase() === '/start') {
            return;
        }
    }

    try {
        // Check if message is a bot command
        if (text.startsWith('/')) {
            await handleBotCommand(text, user, chatId, messageId);
            console.log(
                `Successfully processed command ${messageId} for user ${user.id}: "${text}"`
            );
            return;
        }

        // Create inbox item for regular messages (with duplicate check)
        await createInboxItem(text, user.id, messageId);

        // Send confirmation
        await sendTelegramMessage(
            user.telegram_bot_token,
            chatId,
            `✅ Added to tududi inbox: "${text}"`,
            messageId
        );

        console.log(
            `Successfully processed message ${messageId} for user ${user.id}: "${text}"`
        );
    } catch (error) {
        // Send error message
        await sendTelegramMessage(
            user.telegram_bot_token,
            chatId,
            `❌ Failed to add to inbox: ${error.message}`,
            messageId
        );
    }
};

// Function to process updates (contains side effects)
const processUpdates = async (user, updates) => {
    if (!updates.length) return;

    // Filter out already processed updates
    const newUpdates = updates.filter((update) => {
        const updateKey = getProcessedUpdateKey(user, update.update_id);
        return !pollerState.processedUpdates.has(updateKey);
    });

    if (!newUpdates.length) return;

    // Get highest update ID from new updates
    const highestUpdateId = getHighestUpdateId(newUpdates);

    // Update user status
    pollerState = {
        ...pollerState,
        userStatus: updateUserStatus(pollerState.userStatus, user.id, {
            lastUpdateId: highestUpdateId,
        }),
    };

    // Process each new update
    for (const update of newUpdates) {
        try {
            const updateKey = getProcessedUpdateKey(user, update.update_id);

            if (update.message && update.message.text) {
                // Mark update as processed BEFORE processing to avoid races
                pollerState.processedUpdates.add(updateKey);
                await processMessage(user, update);

                // Clean up old processed updates (keep only last 1000 to prevent memory leak)
                if (pollerState.processedUpdates.size > 1000) {
                    const oldestEntries = Array.from(
                        pollerState.processedUpdates
                    ).slice(0, 100);
                    oldestEntries.forEach((entry) =>
                        pollerState.processedUpdates.delete(entry)
                    );
                }
            }
        } catch (error) {
            console.error(
                `Error processing update ${update.update_id} for user ${user.id}:`,
                error
            );
        }
    }
};

// Function to poll updates for all users (contains side effects)
const pollUpdates = async () => {
    for (const user of pollerState.usersToPool) {
        const token = user.telegram_bot_token;
        if (!token) continue;

        try {
            const lastUpdateId =
                pollerState.userStatus[user.id]?.lastUpdateId || 0;
            const updates = await getTelegramUpdates(token, lastUpdateId + 1);

            if (updates && updates.length > 0) {
                console.log(
                    `Processing ${updates.length} updates for user ${user.id}, starting from update ID ${lastUpdateId + 1}`
                );
                await processUpdates(user, updates);
            }
        } catch (error) {
            console.error(`Error getting updates for user ${user.id}:`, error);
        }
    }
};

// Function to start polling (contains side effects)
const startPolling = () => {
    if (pollerState.running) return;

    const interval = setInterval(async () => {
        try {
            await pollUpdates();
        } catch (error) {
            // Error polling Telegram
        }
    }, pollerState.pollInterval);

    pollerState = {
        ...pollerState,
        running: true,
        interval,
    };
};

// Function to stop polling (contains side effects)
const stopPolling = () => {
    if (!pollerState.running) return;

    if (pollerState.interval) {
        clearInterval(pollerState.interval);
    }

    pollerState = {
        ...pollerState,
        running: false,
        interval: null,
    };
};

// Function to add user (contains side effects)
const addUser = async (user) => {
    if (!user || !user.telegram_bot_token) {
        return false;
    }

    // Add user to list
    const newUsersList = addUserToList(pollerState.usersToPool, user);

    pollerState = {
        ...pollerState,
        usersToPool: newUsersList,
    };

    // Start polling if not already running and we have users
    if (pollerState.usersToPool.length > 0 && !pollerState.running) {
        startPolling();
    }

    return true;
};

// Function to remove user (contains side effects)
const removeUser = (userId) => {
    // Remove user from list and status
    const newUsersList = removeUserFromList(pollerState.usersToPool, userId);
    const newUserStatus = removeUserStatus(pollerState.userStatus, userId);

    pollerState = {
        ...pollerState,
        usersToPool: newUsersList,
        userStatus: newUserStatus,
    };

    // Stop polling if no users left
    if (pollerState.usersToPool.length === 0 && pollerState.running) {
        stopPolling();
    }

    return true;
};

// Get poller status
const getStatus = () => ({
    running: pollerState.running,
    usersCount: pollerState.usersToPool.length,
    pollInterval: pollerState.pollInterval,
    userStatus: pollerState.userStatus,
});

// Export functional interface
module.exports = {
    addUser,
    removeUser,
    startPolling,
    stopPolling,
    getStatus,
    sendTelegramMessage,
    // For testing
    _createPollerState: createPollerState,
    _userExistsInList: userExistsInList,
    _addUserToList: addUserToList,
    _removeUserFromList: removeUserFromList,
    _getHighestUpdateId: getHighestUpdateId,
    _createMessageParams: createMessageParams,
    _createTelegramUrl: createTelegramUrl,
    _isAuthorizedTelegramUser: isAuthorizedTelegramUser,
};
