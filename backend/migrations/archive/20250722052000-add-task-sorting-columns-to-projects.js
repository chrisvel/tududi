'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'task_show_completed',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: true,
                    defaultValue: false,
                },
            },
            {
                name: 'task_sort_order',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: 'created_at:desc',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'projects',
            'task_show_completed'
        );
        await safeRemoveColumn(queryInterface, 'projects', 'task_sort_order');
    },
};
