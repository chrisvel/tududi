'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'email_verified',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true, // Existing users are considered verified
                },
            },
            {
                name: 'email_verification_token',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
            {
                name: 'email_verification_token_expires_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
            },
        ]);

        // Add index on verification token for faster lookups
        await queryInterface.addIndex('users', ['email_verification_token'], {
            name: 'users_email_verification_token_idx',
            unique: false,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex(
            'users',
            'users_email_verification_token_idx'
        );
        await queryInterface.removeColumn('users', 'email_verified');
        await queryInterface.removeColumn('users', 'email_verification_token');
        await queryInterface.removeColumn(
            'users',
            'email_verification_token_expires_at'
        );
    },
};
