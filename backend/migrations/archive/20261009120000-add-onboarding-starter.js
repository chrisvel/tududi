'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

// The starter a user picked on the welcome screen ("household", "empty",
// ...). Null for every existing account too, so everyone sees the screen
// once. Tasks a starter seeded carry the starter key in example_of until
// the user touches them, so "Remove examples" knows which ones to clear.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'onboarding_starter',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
        ]);
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'example_of',
                definition: { type: Sequelize.STRING, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'onboarding_starter');
        await safeRemoveColumn(queryInterface, 'tasks', 'example_of');
    },
};
