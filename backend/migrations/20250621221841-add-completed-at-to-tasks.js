'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        // Add completed_at column to tasks table
        await queryInterface.addColumn('tasks', 'completed_at', {
            type: Sequelize.DATE,
            allowNull: true,
        });

        // Add an index for better query performance
        await queryInterface.addIndex('tasks', ['completed_at']);
    },

    async down(queryInterface, Sequelize) {
        // Remove the index first
        await queryInterface.removeIndex('tasks', ['completed_at']);

        // Remove the completed_at column
        await queryInterface.removeColumn('tasks', 'completed_at');
    },
};
