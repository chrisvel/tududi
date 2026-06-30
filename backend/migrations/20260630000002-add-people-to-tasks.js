'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('tasks', 'assigned_to', {
            type: Sequelize.STRING(15),
            allowNull: true,
            defaultValue: null,
            references: {
                model: 'people',
                key: 'uid',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn('tasks', 'involves', {
            type: Sequelize.TEXT,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addIndex('tasks', ['assigned_to'], {
            name: 'tasks_assigned_to_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', 'tasks_assigned_to_idx');
        await queryInterface.removeColumn('tasks', 'involves');
        await queryInterface.removeColumn('tasks', 'assigned_to');
    },
};
