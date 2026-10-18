'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // Images pasted into comments, kept out of the task files list
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'task_attachments', [
            {
                name: 'inline',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'task_attachments', 'inline');
    },
};
