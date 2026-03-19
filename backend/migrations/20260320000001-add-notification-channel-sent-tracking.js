'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

/**
 * Migration to add channel_sent_at JSON column to notifications table.
 * This tracks when each notification channel (telegram, email, push) was last sent,
 * enabling rate limiting to prevent notification spam.
 *
 * Example value: {"telegram": "2026-03-19T10:30:00Z", "email": "2026-03-19T11:00:00Z"}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'notifications', [
            {
                name: 'channel_sent_at',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'notifications', 'channel_sent_at');
    },
};
