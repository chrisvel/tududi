'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // Records the two emails an account can get from the trial lifecycle:
    // the reminder to verify, and the warning before an ended trial is
    // deleted. Each is sent once.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'billing_accounts', [
            {
                name: 'deletion_warned_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'verification_reminder_sent_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'users',
            'verification_reminder_sent_at'
        );
        await safeRemoveColumn(
            queryInterface,
            'billing_accounts',
            'deletion_warned_at'
        );
    },
};
