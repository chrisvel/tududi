const { User } = require('../../../models');

describe('User Model', () => {
    describe('validation', () => {
        it('should create a user with valid data', async () => {
            const bcrypt = require('bcrypt');
            const userData = {
                email: 'test@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            };

            const user = await User.create(userData);

            expect(user.email).toBe(userData.email);
            expect(user.password_digest).toBeDefined();
            expect(user.password_digest).toBe(userData.password_digest);
            expect(user.appearance).toBe('light');
            expect(user.language).toBe('en');
            expect(user.timezone).toBe('UTC');
        });

        it('should require email', async () => {
            const userData = {
                password: 'password123',
            };

            await expect(User.create(userData)).rejects.toThrow();
        });

        it('should require valid email format', async () => {
            const userData = {
                email: 'invalid-email',
                password: 'password123',
            };

            await expect(User.create(userData)).rejects.toThrow();
        });

        it('should require unique email', async () => {
            const bcrypt = require('bcrypt');
            const userData = {
                email: 'test@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            };

            await User.create(userData);
            await expect(User.create(userData)).rejects.toThrow();
        });

        it('should validate appearance values', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                appearance: 'invalid',
            };

            await expect(User.create(userData)).rejects.toThrow();
        });

        it('should validate task_summary_frequency values', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                task_summary_frequency: 'invalid',
            };

            await expect(User.create(userData)).rejects.toThrow();
        });
    });

    describe('password methods', () => {
        let user;

        beforeEach(async () => {
            const bcrypt = require('bcrypt');
            user = await User.create({
                email: 'test@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });
        });

        it('should hash password on creation', async () => {
            expect(user.password_digest).toBeDefined();
            expect(user.password_digest).not.toBe('password123');
        });

        it('should check password correctly', async () => {
            const isValid = await User.checkPassword(
                'password123',
                user.password_digest
            );
            expect(isValid).toBe(true);

            const isInvalid = await User.checkPassword(
                'wrongpassword',
                user.password_digest
            );
            expect(isInvalid).toBe(false);
        });

        it('should set new password using setPassword method', async () => {
            const oldPasswordDigest = user.password_digest;
            const newPasswordDigest = await User.hashPassword('newpassword');
            user.password_digest = newPasswordDigest;
            await user.save();

            expect(user.password_digest).not.toBe(oldPasswordDigest);

            const isValidNew = await User.checkPassword(
                'newpassword',
                user.password_digest
            );
            expect(isValidNew).toBe(true);

            const isValidOld = await User.checkPassword(
                'password123',
                user.password_digest
            );
            expect(isValidOld).toBe(false);
        });

        it('should hash password on update', async () => {
            const oldPasswordDigest = user.password_digest;
            user.password = 'newpassword';
            await user.save();

            expect(user.password_digest).not.toBe(oldPasswordDigest);

            const isValidNew = await User.checkPassword(
                'newpassword',
                user.password_digest
            );
            expect(isValidNew).toBe(true);
        });
    });

    describe('default values', () => {
        it('should set correct default values', async () => {
            const bcrypt = require('bcrypt');
            const user = await User.create({
                email: 'test@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            expect(user.appearance).toBe('light');
            expect(user.language).toBe('en');
            expect(user.timezone).toBe('UTC');
            expect(user.task_summary_enabled).toBe(false);
            expect(user.task_summary_frequency).toBe('daily');
        });
    });
});
