'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'assigned_to',
                definition: {
                    type: Sequelize.STRING(15),
                    allowNull: true,
                    defaultValue: null,
                    references: {
                        model: 'people',
                        key: 'uid',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
            },
            {
                name: 'involves',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['assigned_to'], {
            name: 'tasks_assigned_to_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', 'tasks_assigned_to_idx');
        await queryInterface.removeColumn('tasks', 'involves');
        await queryInterface.removeColumn('tasks', 'assigned_to');
    },
};
