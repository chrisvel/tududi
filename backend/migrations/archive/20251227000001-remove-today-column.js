'use strict';

const {
    safeRemoveColumn,
    safeAddColumns,
} = require('../utils/migration-utils');

/**
 * Migration to remove the deprecated 'today' column from tasks table.
 * The 'today' field is no longer used - task visibility in the today view
 * is now determined by status (in_progress, planned, waiting).
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeRemoveColumn(queryInterface, 'tasks', 'today');
    },

    async down(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'today',
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        ]);
    },
};
