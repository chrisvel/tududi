'use strict';

/**
 * Migration to remove the deprecated 'today' column from tasks table.
 * The 'today' field is no longer used - task visibility in the today view
 * is now determined by status (in_progress, planned, waiting).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('tasks');

        // Safely remove today column if it exists
        if (tableInfo.today) {
            await queryInterface.removeColumn('tasks', 'today');
        }
    },

    async down(queryInterface, Sequelize) {
        const tableInfo = await queryInterface.describeTable('tasks');

        // Re-add today column if it doesn't exist
        if (!tableInfo.today) {
            await queryInterface.addColumn('tasks', 'today', {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
        }
    },
};
