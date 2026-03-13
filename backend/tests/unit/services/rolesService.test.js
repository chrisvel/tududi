const { isAdmin } = require('../../../services/rolesService');
const { User, Role, sequelize } = require('../../../models');
const bcrypt = require('bcrypt');

describe('rolesService', () => {
    beforeEach(async () => {
        await sequelize.query('DELETE FROM roles');
    });

    describe('isAdmin', () => {
        it('should return false for null uid', async () => {
            expect(await isAdmin(null)).toBe(false);
        });

        it('should return false for undefined uid', async () => {
            expect(await isAdmin(undefined)).toBe(false);
        });

        it('should return false for empty string uid', async () => {
            expect(await isAdmin('')).toBe(false);
        });

        it('should return false when user does not exist', async () => {
            expect(await isAdmin('nonexistent-uid')).toBe(false);
        });

        it('should return true for first user (auto-admin via afterCreate hook)', async () => {
            const hash = await bcrypt.hash('pass', 10);
            // First user created when no admin exists becomes admin automatically
            const user = await User.create({ email: 'first@example.com', password_digest: hash });
            expect(await isAdmin(user.uid)).toBe(true);
        });

        it('should return false for non-first user (non-admin)', async () => {
            const hash = await bcrypt.hash('pass', 10);
            // First user becomes admin
            await User.create({ email: 'first@example.com', password_digest: hash });
            // Second user is not admin
            const second = await User.create({ email: 'second@example.com', password_digest: hash });
            expect(await isAdmin(second.uid)).toBe(false);
        });

        it('should return false when user role has is_admin=false', async () => {
            const hash = await bcrypt.hash('pass', 10);
            const user = await User.create({ email: 'demoted@example.com', password_digest: hash });
            // The hook created an admin role; update it to non-admin
            await Role.update({ is_admin: false }, { where: { user_id: user.id } });
            expect(await isAdmin(user.uid)).toBe(false);
        });

        it('should return true when user role has is_admin=true', async () => {
            const hash = await bcrypt.hash('pass', 10);
            await User.create({ email: 'first@example.com', password_digest: hash });
            const user = await User.create({ email: 'promoted@example.com', password_digest: hash });
            // The hook created a non-admin role; update it to admin
            await Role.update({ is_admin: true }, { where: { user_id: user.id } });
            expect(await isAdmin(user.uid)).toBe(true);
        });
    });
});