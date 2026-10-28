'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // The days left in the last "your trial ends soon" email, so each
    // reminder goes out once.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'billing_accounts', [
            {
                name: 'trial_reminder_days',
                definition: { type: Sequelize.INTEGER, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'billing_accounts',
            'trial_reminder_days'
        );
    },
};
