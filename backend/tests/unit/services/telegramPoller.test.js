const { User, InboxItem } = require('../../../models');
const telegramPoller = require('../../../services/telegramPoller');

// Mock the database models
jest.mock('../../../models', () => ({
    User: {
        update: jest.fn(),
        findAll: jest.fn(),
        findOne: jest.fn(),
    },
    InboxItem: {
        create: jest.fn(),
        findOne: jest.fn(),
    },
}));

// Mock https module
jest.mock('https', () => ({
    get: jest.fn(),
    request: jest.fn(),
}));

describe('TelegramPoller Duplicate Prevention', () => {
    let mockUser;

    beforeEach(() => {
        jest.clearAllMocks();

        mockUser = {
            id: 1,
            telegram_bot_token: 'test-token',
            telegram_chat_id: '123456789',
        };

        // Reset poller state
        telegramPoller.stopPolling();
    });

    describe('Update ID Tracking', () => {
        test('should filter out already processed updates', () => {
            const updates = [
                {
                    update_id: 100,
                    message: {
                        text: 'Hello 1',
                        message_id: 1,
                        chat: { id: 123 },
                    },
                },
                {
                    update_id: 101,
                    message: {
                        text: 'Hello 2',
                        message_id: 2,
                        chat: { id: 123 },
                    },
                },
                {
                    update_id: 102,
                    message: {
                        text: 'Hello 3',
                        message_id: 3,
                        chat: { id: 123 },
                    },
                },
            ];

            // Test internal function for filtering
            const processedUpdates = new Set(['1-100', '1-101']);
            const newUpdates = updates.filter((update) => {
                const updateKey = `1-${update.update_id}`;
                return !processedUpdates.has(updateKey);
            });

            expect(newUpdates).toHaveLength(1);
            expect(newUpdates[0].update_id).toBe(102);
        });

        test('should track highest update ID correctly', () => {
            const updates = [
                { update_id: 98 },
                { update_id: 101 },
                { update_id: 99 },
            ];

            const highestUpdateId = telegramPoller._getHighestUpdateId(updates);
            expect(highestUpdateId).toBe(101);
        });

        test('should handle empty updates array', () => {
            const highestUpdateId = telegramPoller._getHighestUpdateId([]);
            expect(highestUpdateId).toBe(0);
        });
    });

    describe('User List Management', () => {
        test('should not add duplicate users', () => {
            const users = [{ id: 1, name: 'User 1' }];
            const newUser = { id: 1, name: 'User 1 Updated' };

            const userExists = telegramPoller._userExistsInList(users, 1);
            expect(userExists).toBe(true);

            const updatedUsers = telegramPoller._addUserToList(users, newUser);
            expect(updatedUsers).toHaveLength(1);
            expect(updatedUsers).toEqual(users); // Should return original array unchanged
        });

        test('should add new users correctly', () => {
            const users = [{ id: 1, name: 'User 1' }];
            const newUser = { id: 2, name: 'User 2' };

            const userExists = telegramPoller._userExistsInList(users, 2);
            expect(userExists).toBe(false);

            const updatedUsers = telegramPoller._addUserToList(users, newUser);
            expect(updatedUsers).toHaveLength(2);
            expect(updatedUsers).toContain(newUser);
        });

        test('should remove users correctly', () => {
            const users = [
                { id: 1, name: 'User 1' },
                { id: 2, name: 'User 2' },
                { id: 3, name: 'User 3' },
            ];

            const updatedUsers = telegramPoller._removeUserFromList(users, 2);
            expect(updatedUsers).toHaveLength(2);
            expect(updatedUsers.find((u) => u.id === 2)).toBeUndefined();
            expect(updatedUsers.find((u) => u.id === 1)).toBeDefined();
            expect(updatedUsers.find((u) => u.id === 3)).toBeDefined();
        });
    });

    describe('Message Parameters', () => {
        test('should create message parameters without reply', () => {
            const params = telegramPoller._createMessageParams(
                '123',
                'Hello World'
            );
            expect(params).toEqual({
                chat_id: '123',
                text: 'Hello World',
            });
        });

        test('should create message parameters with reply', () => {
            const params = telegramPoller._createMessageParams(
                '123',
                'Hello World',
                456
            );
            expect(params).toEqual({
                chat_id: '123',
                text: 'Hello World',
                reply_to_message_id: 456,
            });
        });
    });

    describe('Telegram URL Creation', () => {
        test('should create URL without parameters', () => {
            const url = telegramPoller._createTelegramUrl('token123', 'getMe');
            expect(url).toBe('https://api.telegram.org/bottoken123/getMe');
        });

        test('should create URL with parameters', () => {
            const url = telegramPoller._createTelegramUrl(
                'token123',
                'getUpdates',
                {
                    offset: '100',
                    timeout: '30',
                }
            );
            expect(url).toBe(
                'https://api.telegram.org/bottoken123/getUpdates?offset=100&timeout=30'
            );
        });
    });

    describe('State Management', () => {
        test('should return correct initial state', () => {
            const state = telegramPoller._createPollerState();
            expect(state).toEqual({
                running: false,
                interval: null,
                pollInterval: 5000,
                usersToPool: [],
                userStatus: {},
                processedUpdates: expect.any(Set),
            });
        });

        test('should track poller status correctly', () => {
            const status = telegramPoller.getStatus();
            expect(status).toEqual({
                running: false,
                usersCount: 0,
                pollInterval: 5000,
                userStatus: {},
            });
        });
    });
});
