'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('tasks', 'area_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'areas',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('tasks', ['area_id'], {
            name: 'tasks_area_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', 'tasks_area_id_idx');
        await queryInterface.removeColumn('tasks', 'area_id');
    },
};
