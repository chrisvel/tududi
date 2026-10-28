'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'roles', [
            {
                name: 'role',
                definition: {
                    type: Sequelize.STRING(20),
                    allowNull: false,
                    defaultValue: 'user',
                },
            },
            {
                name: 'capabilities',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);

        // Existing admins keep their access under the new column. Everyone
        // else already has the column default. Safe to run again.
        await queryInterface.bulkUpdate(
            'roles',
            { role: 'admin' },
            { is_admin: true }
        );
    },

    async down(queryInterface) {
        const info = await queryInterface.describeTable('roles');
        if ('capabilities' in info) {
            await queryInterface.removeColumn('roles', 'capabilities');
        }
        if ('role' in info) {
            await queryInterface.removeColumn('roles', 'role');
        }
    },
};
