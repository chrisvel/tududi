const { InboxItem, User } = require('../../../models');

describe('InboxItem Model', () => {
    let user;

    beforeEach(async () => {
        const bcrypt = require('bcrypt');
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });
    });

    describe('validation', () => {
        it('should create an inbox item with valid data', async () => {
            const inboxData = {
                content: 'Remember to buy groceries',
                status: 'added',
                source: 'web',
                user_id: user.id,
            };

            const inboxItem = await InboxItem.create(inboxData);

            expect(inboxItem.content).toBe(inboxData.content);
            expect(inboxItem.status).toBe(inboxData.status);
            expect(inboxItem.source).toBe(inboxData.source);
            expect(inboxItem.user_id).toBe(user.id);
        });

        it('should require content', async () => {
            const inboxData = {
                user_id: user.id,
            };

            await expect(InboxItem.create(inboxData)).rejects.toThrow();
        });

        it('should require user_id', async () => {
            const inboxData = {
                content: 'Test content',
            };

            await expect(InboxItem.create(inboxData)).rejects.toThrow();
        });

        it('should require status', async () => {
            const inboxData = {
                content: 'Test content',
                user_id: user.id,
                status: null,
            };

            await expect(InboxItem.create(inboxData)).rejects.toThrow();
        });

        it('should require source', async () => {
            const inboxData = {
                content: 'Test content',
                user_id: user.id,
                source: null,
            };

            await expect(InboxItem.create(inboxData)).rejects.toThrow();
        });
    });

    describe('default values', () => {
        it('should set correct default values', async () => {
            const inboxItem = await InboxItem.create({
                content: 'Test content',
                user_id: user.id,
            });

            expect(inboxItem.status).toBe('added');
        });
    });

    describe('associations', () => {
        it('should belong to a user', async () => {
            const inboxItem = await InboxItem.create({
                content: 'Test content',
                user_id: user.id,
            });

            const inboxItemWithUser = await InboxItem.findByPk(inboxItem.id, {
                include: [{ model: User }],
            });

            expect(inboxItemWithUser.User).toBeDefined();
            expect(inboxItemWithUser.User.id).toBe(user.id);
            expect(inboxItemWithUser.User.email).toBe(user.email);
        });
    });
});
