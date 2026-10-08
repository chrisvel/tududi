'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

// When a user finished (or skipped) the first-login welcome screen. Everyone
// who already has an account never saw it, so they count as onboarded from
// the day they signed up; only accounts created after this see the screen.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'onboarded_at',
                definition: { type: Sequelize.DATE, allowNull: true },
            },
        ]);
        await queryInterface.sequelize.query(
            'UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL'
        );
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'onboarded_at');
    },
};
