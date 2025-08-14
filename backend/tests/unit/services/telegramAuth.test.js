const {
    _isAuthorizedTelegramUser,
} = require('../../../services/telegramPoller');

describe('Telegram Authorization', () => {
    describe('isAuthorizedTelegramUser', () => {
        it('should allow all users when no whitelist is configured', () => {
            const user = { telegram_allowed_users: null };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow all users when whitelist is empty', () => {
            const user = { telegram_allowed_users: '' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow all users when whitelist is whitespace only', () => {
            const user = { telegram_allowed_users: '   ' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow user when ID is in whitelist', () => {
            const user = { telegram_allowed_users: '123456,789012' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow user when username is in whitelist (without @)', () => {
            const user = { telegram_allowed_users: 'testuser,anotheruser' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow user when username is in whitelist (with @)', () => {
            const user = { telegram_allowed_users: '@testuser,@anotheruser' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow user in mixed whitelist by ID match', () => {
            const user = { telegram_allowed_users: '123456,@anotheruser' };
            const message = { from: { id: 123456, username: 'differentuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should allow user in mixed whitelist by username match', () => {
            const user = { telegram_allowed_users: '789012,testuser' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should deny user not in whitelist', () => {
            const user = { telegram_allowed_users: '789012,@anotheruser' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(false);
        });

        it('should deny user without username if ID not in whitelist', () => {
            const user = { telegram_allowed_users: '789012,@testuser' };
            const message = { from: { id: 123456 } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(false);
        });

        it('should allow user without username if ID is in whitelist', () => {
            const user = { telegram_allowed_users: '123456,@testuser' };
            const message = { from: { id: 123456 } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should handle case insensitive username matching', () => {
            const user = { telegram_allowed_users: 'TestUser,@AnotherUser' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should deny when no sender information is provided', () => {
            const user = { telegram_allowed_users: 'testuser' };
            const message = {};

            expect(_isAuthorizedTelegramUser(user, message)).toBe(false);
        });

        it('should handle whitelist with extra spaces and commas', () => {
            const user = {
                telegram_allowed_users: ' testuser , @anotheruser ,  123456  ',
            };
            const message = { from: { id: 123456, username: 'differentuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true);
        });

        it('should deny when whitelist contains only empty values after trimming', () => {
            const user = { telegram_allowed_users: ' , , ' };
            const message = { from: { id: 123456, username: 'testuser' } };

            expect(_isAuthorizedTelegramUser(user, message)).toBe(true); // Empty after filtering means allow all
        });
    });
});
