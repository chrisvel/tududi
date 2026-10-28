'use strict';

const {
    safeAddColumns,
    safeAddIndex,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add order column to tasks table for subtask ordering
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'order',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    defaultValue: null,
                    comment: 'Order position for subtasks within a parent task',
                },
            },
        ]);

        // Add index on parent_task_id and order for efficient subtask queries
        await safeAddIndex(
            queryInterface,
            'tasks',
            ['parent_task_id', 'order'],
            {
                name: 'tasks_parent_task_id_order',
            }
        );

        // Populate order field for existing subtasks based on created_at
        await queryInterface.sequelize.query(`
            UPDATE tasks
            SET "order" = subquery.row_num
            FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                         PARTITION BY parent_task_id
                         ORDER BY created_at ASC
                       ) as row_num
                FROM tasks
                WHERE parent_task_id IS NOT NULL
            ) AS subquery
            WHERE tasks.id = subquery.id
        `);
    },

    async down(queryInterface) {
        // Remove the index
        const indexes = await queryInterface.showIndex('tasks');
        const indexExists = indexes.some(
            (index) => index.name === 'tasks_parent_task_id_order'
        );

        if (indexExists) {
            await queryInterface.removeIndex(
                'tasks',
                'tasks_parent_task_id_order'
            );
        }

        // Remove the order column using safe utility
        await safeRemoveColumn(queryInterface, 'tasks', 'order');
    },
};
