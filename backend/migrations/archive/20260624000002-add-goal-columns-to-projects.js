'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'projects', [
            {
                name: 'goal_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'goals',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
            },
            {
                name: 'is_maintenance',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'projects', ['goal_id'], {
            name: 'projects_goal_id_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('projects', 'projects_goal_id_idx');
        await queryInterface.removeColumn('projects', 'is_maintenance');
        await queryInterface.removeColumn('projects', 'goal_id');
    },
};
