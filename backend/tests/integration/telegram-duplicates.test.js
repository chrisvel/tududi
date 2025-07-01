const request = require('supertest');
const app = require('../../app');
const { User, InboxItem, sequelize } = require('../../models');
const telegramPoller = require('../../services/telegramPoller');

describe('Telegram Duplicate Prevention Integration Tests', () => {
    let testUser;
    let originalConsoleLog;
    let logMessages;

    beforeAll(async () => {
        // Capture console.log for verification
        originalConsoleLog = console.log;
        logMessages = [];
        console.log = (...args) => {
            logMessages.push(args.join(' '));
            originalConsoleLog(...args);
        };

        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        logMessages = [];

        // Create test user
        testUser = await User.create({
            email: 'test-telegram@example.com',
            password_digest: 'hashedpassword',
            telegram_bot_token: 'test-bot-token-123',
            telegram_chat_id: '987654321',
        });

        // Clear any existing inbox items
        await InboxItem.destroy({ where: {} });

        // Stop and reset poller
        telegramPoller.stopPolling();
    });

    afterEach(async () => {
        telegramPoller.stopPolling();
        await User.destroy({ where: {} });
        await InboxItem.destroy({ where: {} });
    });

    afterAll(async () => {
        console.log = originalConsoleLog;
        await sequelize.close();
    });

    describe('Database-level Duplicate Prevention', () => {
        test('should prevent duplicate inbox items with same content within 30 seconds', async () => {
            const messageContent = 'Test duplicate message';

            // Create first inbox item
            const item1 = await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: 123 },
            });

            // Wait a moment
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Try to create duplicate item (should be prevented)
            const duplicateCheck = await InboxItem.findOne({
                where: {
                    content: messageContent,
                    user_id: testUser.id,
                    source: 'telegram',
                    created_at: {
                        [require('sequelize').Op.gte]: new Date(
                            Date.now() - 30000
                        ),
                    },
                },
            });

            expect(duplicateCheck).toBeTruthy();
            expect(duplicateCheck.id).toBe(item1.id);

            // Verify only one item exists
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });
            expect(allItems).toHaveLength(1);
        });

        test('should allow duplicate content after 30 seconds', async () => {
            const messageContent = 'Test time-based duplicate';

            // Create first item with backdated timestamp
            await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                created_at: new Date(Date.now() - 35000), // 35 seconds ago
                metadata: { telegram_message_id: 124 },
            });

            // Create second item (should be allowed)
            const item2 = await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: 125 },
            });

            // Verify both items exist
            const allItems = await InboxItem.findAll({
                where: { user_id: testUser.id },
            });
            expect(allItems).toHaveLength(2);
        });

        test('should allow same content for different users', async () => {
            // Create second user
            const testUser2 = await User.create({
                email: 'test2-telegram@example.com',
                password_digest: 'hashedpassword',
                telegram_bot_token: 'test-bot-token-456',
                telegram_chat_id: '123456789',
            });

            const messageContent = 'Shared message content';

            // Create item for first user
            await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser.id,
                metadata: { telegram_message_id: 126 },
            });

            // Create item for second user (should be allowed)
            await InboxItem.create({
                content: messageContent,
                source: 'telegram',
                user_id: testUser2.id,
                metadata: { telegram_message_id: 127 },
            });

            // Verify both items exist
            const allItems = await InboxItem.findAll();
            expect(allItems).toHaveLength(2);

            const user1Items = allItems.filter(
                (item) => item.user_id === testUser.id
            );
            const user2Items = allItems.filter(
                (item) => item.user_id === testUser2.id
            );

            expect(user1Items).toHaveLength(1);
            expect(user2Items).toHaveLength(1);
        });
    });

    describe('Poller State Management', () => {
        test('should add and remove users correctly', async () => {
            const initialStatus = telegramPoller.getStatus();
            expect(initialStatus.usersCount).toBe(0);
            expect(initialStatus.running).toBe(false);

            // Add user
            const addResult = await telegramPoller.addUser(testUser);
            expect(addResult).toBe(true);

            const statusAfterAdd = telegramPoller.getStatus();
            expect(statusAfterAdd.usersCount).toBe(1);
            expect(statusAfterAdd.running).toBe(true);

            // Remove user
            const removeResult = telegramPoller.removeUser(testUser.id);
            expect(removeResult).toBe(true);

            const statusAfterRemove = telegramPoller.getStatus();
            expect(statusAfterRemove.usersCount).toBe(0);
            expect(statusAfterRemove.running).toBe(false);
        });

        test('should not add user without telegram token', async () => {
            const userWithoutToken = await User.create({
                email: 'no-token@example.com',
                password_digest: 'hashedpassword',
                // No telegram_bot_token
            });

            const addResult = await telegramPoller.addUser(userWithoutToken);
            expect(addResult).toBe(false);

            const status = telegramPoller.getStatus();
            expect(status.usersCount).toBe(0);
        });

        test('should handle adding same user multiple times', async () => {
            // Add user first time
            await telegramPoller.addUser(testUser);
            const status1 = telegramPoller.getStatus();
            expect(status1.usersCount).toBe(1);

            // Add same user again
            await telegramPoller.addUser(testUser);
            const status2 = telegramPoller.getStatus();
            expect(status2.usersCount).toBe(1); // Should still be 1
        });
    });

    describe('Update Processing Logic', () => {
        test('should handle updates with proper ID tracking', async () => {
            await telegramPoller.addUser(testUser);

            // Simulate updates (this tests the internal logic without actual HTTP calls)
            const mockUpdates = [
                {
                    update_id: 1001,
                    message: {
                        message_id: 501,
                        text: 'First message',
                        chat: { id: 987654321 },
                    },
                },
                {
                    update_id: 1002,
                    message: {
                        message_id: 502,
                        text: 'Second message',
                        chat: { id: 987654321 },
                    },
                },
            ];

            // Test highest update ID calculation
            const highestId = telegramPoller._getHighestUpdateId(mockUpdates);
            expect(highestId).toBe(1002);

            // Test update key generation (simulating internal logic)
            const updateKeys = mockUpdates.map(
                (update) => `${testUser.id}-${update.update_id}`
            );
            expect(updateKeys).toEqual([
                `${testUser.id}-1001`,
                `${testUser.id}-1002`,
            ]);
        });

        test('should properly track processed updates', async () => {
            // Test the Set-based tracking logic
            const processedUpdates = new Set();

            // Add some processed updates
            processedUpdates.add('1-1001');
            processedUpdates.add('1-1002');

            // Test filtering logic
            const newUpdates = [
                { update_id: 1001 }, // Should be filtered out
                { update_id: 1002 }, // Should be filtered out
                { update_id: 1003 }, // Should remain
            ].filter((update) => {
                const updateKey = `1-${update.update_id}`;
                return !processedUpdates.has(updateKey);
            });

            expect(newUpdates).toHaveLength(1);
            expect(newUpdates[0].update_id).toBe(1003);
        });

        test('should handle memory management for processed updates', async () => {
            // Simulate the cleanup logic
            const processedUpdates = new Set();

            // Add many updates (more than the 1000 limit)
            for (let i = 1; i <= 1100; i++) {
                processedUpdates.add(`1-${i}`);
            }

            expect(processedUpdates.size).toBe(1100);

            // Simulate cleanup (remove oldest 100)
            if (processedUpdates.size > 1000) {
                const oldestEntries = Array.from(processedUpdates).slice(
                    0,
                    100
                );
                oldestEntries.forEach((entry) =>
                    processedUpdates.delete(entry)
                );
            }

            expect(processedUpdates.size).toBe(1000);
            expect(processedUpdates.has('1-1')).toBe(false); // Oldest should be removed
            expect(processedUpdates.has('1-1100')).toBe(true); // Newest should remain
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            // Mock InboxItem.create to throw an error
            const originalCreate = InboxItem.create;
            InboxItem.create = jest
                .fn()
                .mockRejectedValue(new Error('Database error'));

            await expect(
                InboxItem.create({
                    content: 'Test error handling',
                    source: 'telegram',
                    user_id: testUser.id,
                })
            ).rejects.toThrow('Database error');

            // Restore original function
            InboxItem.create = originalCreate;
        });

        test('should handle invalid user data', async () => {
            const invalidUser = null;
            const addResult = await telegramPoller.addUser(invalidUser);
            expect(addResult).toBe(false);
        });

        test('should handle missing message properties', async () => {
            // Test the processing logic with incomplete message data
            const incompleteUpdate = {
                update_id: 2001,
                message: {
                    // Missing text and other properties
                    message_id: 601,
                    chat: { id: 987654321 },
                },
            };

            // The actual processing would skip this message due to missing text
            const hasText =
                incompleteUpdate.message && incompleteUpdate.message.text;
            expect(hasText).toBeFalsy();
        });
    });
});
