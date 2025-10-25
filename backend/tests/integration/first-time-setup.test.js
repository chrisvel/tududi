const { User, Role } = require('../../models');

describe('First-time Setup (Docker scenario)', () => {
    beforeEach(async () => {
        // Clear data before each test
        await Role.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
    });

    it('should automatically create admin role for first user and regular role for second user', async () => {
        // Create first user (simulating Docker with TUDUDI_USER_EMAIL/PASSWORD)
        const firstUser = await User.create({
            email: 'admin@example.com',
            password: 'password123',
        });

        // Check that role was automatically created via afterCreate hook
        const firstUserRole = await Role.findOne({
            where: { user_id: firstUser.id },
        });

        expect(firstUserRole).not.toBeNull();
        expect(firstUserRole.is_admin).toBe(true);

        // Create second user
        const secondUser = await User.create({
            email: 'user@example.com',
            password: 'password123',
        });

        // Check that role was automatically created but is not admin
        const secondUserRole = await Role.findOne({
            where: { user_id: secondUser.id },
        });

        expect(secondUserRole).not.toBeNull();
        expect(secondUserRole.is_admin).toBe(false);

        // Verify counts
        const adminCount = await Role.count({ where: { is_admin: true } });
        const totalUsers = await User.count();

        expect(adminCount).toBe(1);
        expect(totalUsers).toBe(2);
    });

    it('should automatically create role when user registers', async () => {
        // Create an admin first
        await User.create({
            email: 'admin@example.com',
            password: 'password123',
        });

        // Simulate registration by creating user directly
        const registeredUser = await User.create({
            email: 'registered@example.com',
            password: 'password123',
            email_verified: false,
        });

        // Check that role was automatically created
        const registeredUserRole = await Role.findOne({
            where: { user_id: registeredUser.id },
        });

        expect(registeredUserRole).not.toBeNull();
        expect(registeredUserRole.is_admin).toBe(false); // Not admin since admin already exists
    });

    it('should handle multiple users created in sequence', async () => {
        // Create 5 users
        const users = [];
        for (let i = 0; i < 5; i++) {
            const user = await User.create({
                email: `user${i}@example.com`,
                password: 'password123',
            });
            users.push(user);
        }

        // Check all users have roles
        const roles = await Role.findAll();
        expect(roles.length).toBe(5);

        // Check only first user is admin
        const adminRoles = roles.filter((r) => r.is_admin);
        expect(adminRoles.length).toBe(1);
        expect(adminRoles[0].user_id).toBe(users[0].id);
    });
});
