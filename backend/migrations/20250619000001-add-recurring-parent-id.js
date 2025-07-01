'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('tasks', 'recurring_parent_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'tasks',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        // Add index for performance
        await queryInterface.addIndex('tasks', ['recurring_parent_id']);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeIndex('tasks', ['recurring_parent_id']);
        await queryInterface.removeColumn('tasks', 'recurring_parent_id');
    },
};
