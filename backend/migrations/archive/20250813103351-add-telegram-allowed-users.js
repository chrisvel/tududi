'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'telegram_allowed_users',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment:
                        'Comma-separated list of allowed Telegram usernames or user IDs',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'telegram_allowed_users');
    },
};
