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

// Create message parameters
const createMessageParams = (chatId, text, replyToMessageId = null) => {
    const params = { chat_id: chatId, text: text };
    if (replyToMessageId) {
        params.reply_to_message_id = replyToMessageId;
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
    replyToMessageId = null
) => {
    try {
        const messageParams = createMessageParams(
            chatId,
            text,
            replyToMessageId
        );
        const postData = JSON.stringify(messageParams);
        const url = createTelegramUrl(token, 'sendMessage');

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        return await makeHttpPostRequest(url, postData, options);
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

// Function to process a single message (contains side effects)
const processMessage = async (user, update) => {
    const message = update.message;
    const text = message.text;
    const chatId = message.chat.id.toString();
    const messageId = message.message_id;

    // Update chat ID if needed
    if (!user.telegram_chat_id) {
        await updateUserChatId(user.id, chatId);
        user.telegram_chat_id = chatId; // Update local object
    }

    try {
        // Create inbox item (with duplicate check)
        const inboxItem = await createInboxItem(text, user.id, messageId);

        // Send confirmation
        await sendTelegramMessage(
            user.telegram_bot_token,
            chatId,
            `✅ Added to Tududi inbox: "${text}"`,
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
        const updateKey = `${user.id}-${update.update_id}`;
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
            const updateKey = `${user.id}-${update.update_id}`;

            if (update.message && update.message.text) {
                await processMessage(user, update);

                // Mark update as processed
                pollerState.processedUpdates.add(updateKey);

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
};
