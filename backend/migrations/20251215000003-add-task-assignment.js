'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add assigned_to_user_id column to tasks table
        await queryInterface.addColumn('tasks', 'assigned_to_user_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL', // Keep task if assignee is deleted
        });

        // Add index for performance on assigned tasks queries
        await queryInterface.addIndex('tasks', ['assigned_to_user_id'], {
            name: 'tasks_assigned_to_user_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        // Remove index first
        await queryInterface.removeIndex('tasks', 'tasks_assigned_to_user_id_idx');

        // Remove column
        await queryInterface.removeColumn('tasks', 'assigned_to_user_id');
    },
};
