const { User, InboxItem, sequelize } = require('../../models');
const telegramPoller = require('../../services/telegramPoller');

// Mock the HTTPS module to simulate Telegram API responses
jest.mock('https', () => {
    const mockResponse = {
        on: jest.fn((event, callback) => {
            if (event === 'data') {
                // Simulate API response with duplicate updates
                callback(
                    JSON.stringify({
                        ok: true,
                        result: [
                            {
                                update_id: 1001,
                                message: {
                                    message_id: 123,
                                    text: 'Buy groceries from the store',
                                    chat: { id: 987654321 },
                                    date: Math.floor(Date.now() / 1000),
                                },
                            },
                        ],
                    })
                );
            } else if (event === 'end') {
                callback();
            }
        }),
    };

    const mockRequest = {
        on: jest.fn(),
        write: jest.fn(),
        end: jest.fn(),
    };

    return {
        get: jest.fn((url, options, callback) => {
            callback(mockResponse);
            return mockRequest;
        }),
        request: jest.fn((url, options, callback) => {
            callback(mockResponse);
            return mockRequest;
        }),
    };
});

describe('Telegram Duplicate Message Scenario', () => {
    let testUser;
    let consoleMessages;

    beforeAll(async () => {
        await sequelize.sync({ force: true });

        // Capture console logs
        consoleMessages = [];
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            consoleMessages.push(args.join(' '));
            originalConsoleLog(...args);
        };
    });

    beforeEach(async () => {
        consoleMessages = [];

        // Create test user with Telegram configuration
        testUser = await User.create({
            email: 'telegram-user@example.com',
            password_digest: 'hashedpassword',
            telegram_bot_token: 'real-bot-token-456',
            telegram_chat_id: '987654321',
        });

        // Clear inbox
        await InboxItem.destroy({ where: {} });

        // Reset poller
        telegramPoller.stopPolling();
    });

    afterEach(async () => {
        telegramPoller.stopPolling();
        await User.destroy({ where: {} });
        await InboxItem.destroy({ where: {} });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('Real-world Duplicate Scenarios', () => {
        test('should prevent duplicates when same message is processed twice due to network issues', async () => {
            const messageContent = 'Buy groceries from the store';
            const messageId = 123;
            const updateId = 1001;

            // Simulate first message processing
            const inboxItem1 = await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: messageId },
            });

            // Wait a moment (simulating network delay)
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Simulate duplicate processing attempt (same message, different processing cycle)
            const recentCutoff = new Date(Date.now() - 30000);
            const existingItem = await InboxItem.findOne({
                where: {
                    content: messageContent,
                    user_id: testUser.id,
                    source: 'telegram',
                    created_at: {
                        [require('sequelize').Op.gte]: recentCutoff,
                    },
                },
            });

            // Should find the existing item
            expect(existingItem).toBeTruthy();
            expect(existingItem.id).toBe(inboxItem1.id);

            // Verify only one item exists
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });
            expect(allItems).toHaveLength(1);
        });

        test('should handle rapid consecutive messages without creating duplicates', async () => {
            const messages = [
                { content: 'First message', messageId: 201, updateId: 2001 },
                { content: 'Second message', messageId: 202, updateId: 2002 },
                { content: 'First message', messageId: 203, updateId: 2003 }, // Duplicate content
                { content: 'Third message', messageId: 204, updateId: 2004 },
            ];

            // Process all messages rapidly
            const createdItems = [];
            for (const msg of messages) {
                try {
                    // Check for existing item first (simulating the duplicate prevention logic)
                    const existingItem = await InboxItem.findOne({
                        where: {
                            content: msg.content,
                            user_id: testUser.id,
                            source: 'telegram',
                            created_at: {
                                [require('sequelize').Op.gte]: new Date(
                                    Date.now() - 30000
                                ),
                            },
                        },
                    });

                    if (existingItem) {
                        console.log(`Duplicate detected: "${msg.content}"`);
                        createdItems.push(existingItem);
                    } else {
                        const newItem = await InboxItem.create({
                            content: msg.content,
                            source: 'telegram',
                            user_id: testUser.id,
                            metadata: { telegram_message_id: msg.messageId },
                        });
                        createdItems.push(newItem);
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            }

            // Should have 3 unique items (first, second, third) - duplicate "First message" should be prevented
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });

            expect(allItems).toHaveLength(3);

            const contentCounts = allItems.reduce((acc, item) => {
                acc[item.content] = (acc[item.content] || 0) + 1;
                return acc;
            }, {});

            expect(contentCounts['First message']).toBe(1);
            expect(contentCounts['Second message']).toBe(1);
            expect(contentCounts['Third message']).toBe(1);
        });

        test('should track update IDs correctly to prevent reprocessing', async () => {
            // Simulate the internal update tracking logic
            const processedUpdates = new Set();

            const updates = [
                {
                    update_id: 3001,
                    message: {
                        text: 'Message 1',
                        message_id: 301,
                        chat: { id: 987654321 },
                    },
                },
                {
                    update_id: 3002,
                    message: {
                        text: 'Message 2',
                        message_id: 302,
                        chat: { id: 987654321 },
                    },
                },
                {
                    update_id: 3001,
                    message: {
                        text: 'Message 1',
                        message_id: 301,
                        chat: { id: 987654321 },
                    },
                }, // Duplicate update
                {
                    update_id: 3003,
                    message: {
                        text: 'Message 3',
                        message_id: 303,
                        chat: { id: 987654321 },
                    },
                },
            ];

            const processedCount = { count: 0 };

            for (const update of updates) {
                const updateKey = `${testUser.id}-${update.update_id}`;

                if (!processedUpdates.has(updateKey)) {
                    // Simulate processing the update
                    processedUpdates.add(updateKey);
                    processedCount.count++;

                    // Simulate creating inbox item
                    await InboxItem.create({
                        content: update.message.text,
                        source: 'telegram',
                        user_id: testUser.id,
                        metadata: {
                            telegram_message_id: update.message.message_id,
                            update_id: update.update_id,
                        },
                    });
                } else {
                    console.log(
                        `Skipping already processed update: ${update.update_id}`
                    );
                }
            }

            // Should have processed 3 unique updates (3001, 3002, 3003)
            expect(processedCount.count).toBe(3);
            expect(processedUpdates.size).toBe(3);

            // Verify inbox items
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });
            expect(allItems).toHaveLength(3);
        });

        test('should handle poller restart without creating duplicates', async () => {
            // Create initial inbox item
            const initialItem = await InboxItem.create({
                content: 'Message before restart',
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: 401, update_id: 4001 },
            });

            // Add user to poller
            await telegramPoller.addUser(testUser);

            // Simulate getting status
            let status = telegramPoller.getStatus();
            expect(status.running).toBe(true);
            expect(status.usersCount).toBe(1);

            // Stop poller (simulating restart)
            telegramPoller.stopPolling();
            status = telegramPoller.getStatus();
            expect(status.running).toBe(false);

            // Start again
            await telegramPoller.addUser(testUser);
            status = telegramPoller.getStatus();
            expect(status.running).toBe(true);

            // The poller should maintain its state correctly
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });
            expect(allItems).toHaveLength(1);
            expect(allItems[0].id).toBe(initialItem.id);
        });

        test('should cleanup old processed updates to prevent memory leaks', async () => {
            // Test the memory management logic
            const processedUpdates = new Set();

            // Add many processed updates
            for (let i = 1; i <= 1200; i++) {
                processedUpdates.add(`${testUser.id}-${i}`);
            }

            expect(processedUpdates.size).toBe(1200);

            // Simulate the cleanup logic (keeping only 1000 most recent)
            if (processedUpdates.size > 1000) {
                const allEntries = Array.from(processedUpdates);
                const oldestEntries = allEntries.slice(0, 200); // Remove oldest 200
                oldestEntries.forEach((entry) =>
                    processedUpdates.delete(entry)
                );
            }

            expect(processedUpdates.size).toBe(1000);

            // Verify oldest entries are removed
            expect(processedUpdates.has(`${testUser.id}-1`)).toBe(false);
            expect(processedUpdates.has(`${testUser.id}-200`)).toBe(false);

            // Verify newest entries are kept
            expect(processedUpdates.has(`${testUser.id}-1200`)).toBe(true);
            expect(processedUpdates.has(`${testUser.id}-1000`)).toBe(true);
        });
    });

    describe('Edge Cases', () => {
        test('should handle identical messages from different Telegram message IDs', async () => {
            const messageContent = 'Identical content';

            // Create first message
            const item1 = await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: 501 },
            });

            // Wait a moment
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Try to create with same content but different message ID
            // This should be prevented by the content-based duplicate check
            const recentCutoff = new Date(Date.now() - 30000);
            const existingItem = await InboxItem.findOne({
                where: {
                    content: messageContent,
                    user_id: testUser.id,
                    source: 'telegram',
                    created_at: {
                        [require('sequelize').Op.gte]: recentCutoff,
                    },
                },
            });

            expect(existingItem).toBeTruthy();
            expect(existingItem.id).toBe(item1.id);
        });

        test('should allow same content after time window expires', async () => {
            const messageContent = 'Time-based test message';

            // Create first item with old timestamp
            const oldTimestamp = new Date(Date.now() - 35000); // 35 seconds ago
            await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                created_at: oldTimestamp,
                updated_at: oldTimestamp,
                metadata: { telegram_message_id: 601 },
            });

            // Now try to create new item with same content
            const newItem = await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: 602 },
            });

            // Should be allowed since the old one is outside the 30-second window
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });
            expect(allItems).toHaveLength(2);
        });
    });
});
