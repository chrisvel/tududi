'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

// When a user finished (or skipped) the welcome screen. It stays null for
// every existing account too, so everyone sees the screen once on their
// next visit to Today. The demo account is set when it is prepared.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'onboarded_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'onboarded_at');
    },
};
