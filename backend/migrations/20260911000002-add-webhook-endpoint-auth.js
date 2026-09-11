'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'webhook_endpoints', [
            {
                name: 'auth_type',
                definition: {
                    type: Sequelize.STRING(16),
                    allowNull: false,
                    defaultValue: 'none',
                },
            },
            {
                name: 'auth_header_name',
                definition: {
                    type: Sequelize.STRING(128),
                    allowNull: true,
                },
            },
            {
                name: 'auth_username',
                definition: {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                },
            },
            {
                name: 'auth_secret',
                definition: {
                    type: Sequelize.STRING(500),
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('webhook_endpoints', 'auth_type');
        await queryInterface.removeColumn(
            'webhook_endpoints',
            'auth_header_name'
        );
        await queryInterface.removeColumn(
            'webhook_endpoints',
            'auth_username'
        );
        await queryInterface.removeColumn('webhook_endpoints', 'auth_secret');
    },
};
