'use strict';

const { safeAddIndex, safeAddColumns } = require('../utils/migration-utils');
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add assigned_to_user_id column to tasks table
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'assigned_to_user_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'users',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL', // Keep task if assignee is deleted
                },
            },
        ]);
        await safeAddIndex(queryInterface, 'tasks', ['assigned_to_user_id'], {
            name: 'tasks_assigned_to_user_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove index first

        await queryInterface.removeIndex(
            'tasks',
            'tasks_assigned_to_user_id_idx'
        );

        // Remove column
        await queryInterface.safeRemoveColumn(queryInterface, 'tasks', [
            'assigned_to_user_id',
        ]);
    },
};
