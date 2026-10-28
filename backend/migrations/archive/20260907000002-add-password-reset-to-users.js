'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'password_reset_token_hash',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
            {
                name: 'password_reset_token_expires_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'password_reset_token_hash');
        await queryInterface.removeColumn(
            'users',
            'password_reset_token_expires_at'
        );
    },
};
