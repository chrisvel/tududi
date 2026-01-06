'use strict';

/**
 * Migration to add keyboard_shortcuts JSON column to users table.
 * This stores user-configurable keyboard shortcuts for quick actions.
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.safeAddColumn('users', 'keyboard_shortcuts', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.safeRemoveColumn('users', 'keyboard_shortcuts');
    },
};
