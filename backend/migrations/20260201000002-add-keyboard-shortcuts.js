'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

/**
 * Migration to add keyboard_shortcuts JSON column to users table.
 * This stores user-configurable keyboard shortcuts for quick actions.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'keyboard_shortcuts',
                type: Sequelize.JSON,
                allowNull: true,
                defaultValue: null,
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'keyboard_shortcuts');
    },
};
