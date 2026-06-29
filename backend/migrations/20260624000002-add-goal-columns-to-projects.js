'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('projects', 'goal_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'goals',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn('projects', 'is_maintenance', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        await queryInterface.addIndex('projects', ['goal_id'], {
            name: 'projects_goal_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('projects', 'projects_goal_id_idx');
        await queryInterface.removeColumn('projects', 'is_maintenance');
        await queryInterface.removeColumn('projects', 'goal_id');
    },
};
