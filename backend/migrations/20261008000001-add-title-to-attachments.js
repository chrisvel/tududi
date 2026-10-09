'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

const TABLES = [
    'project_attachments',
    'task_attachments',
    'note_attachments',
    'inbox_item_attachments',
];

module.exports = {
    // An optional title shown instead of the file name.
    async up(queryInterface, Sequelize) {
        for (const table of TABLES) {
            await safeAddColumns(queryInterface, table, [
                {
                    name: 'title',
                    definition: { type: Sequelize.STRING, allowNull: true },
                },
            ]);
        }
    },

    async down(queryInterface) {
        for (const table of TABLES) {
            await safeRemoveColumn(queryInterface, table, 'title');
        }
    },
};
