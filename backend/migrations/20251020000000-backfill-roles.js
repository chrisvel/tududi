'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Check if roles table exists
        let tableExists = false;
        try {
            await queryInterface.describeTable('roles');
            tableExists = true;
        } catch (error) {
            // Table doesn't exist, migration hasn't run yet
            return;
        }

        if (!tableExists) {
            // Roles table doesn't exist yet, nothing to backfill
            return;
        }

        // Check if any admin users exist
        const [adminCountResult] = await queryInterface.sequelize.query(
            'SELECT COUNT(*) as count FROM roles WHERE is_admin = 1'
        );
        const hasAdmins = adminCountResult[0].count > 0;

        // Get users without role entries
        const [usersWithoutRoles] = await queryInterface.sequelize.query(
            'SELECT u.id FROM users u LEFT JOIN roles r ON u.id = r.user_id WHERE r.id IS NULL'
        );

        if (usersWithoutRoles.length > 0) {
            const roleEntries = usersWithoutRoles.map((user) => ({
                user_id: user.id,
                is_admin: !hasAdmins, // true if no admins exist, false otherwise
                created_at: new Date(),
                updated_at: new Date(),
            }));

            await queryInterface.bulkInsert('roles', roleEntries);
        }
    },

    async down(queryInterface, Sequelize) {
        // This migration only adds missing data, no need to reverse
    },
};
