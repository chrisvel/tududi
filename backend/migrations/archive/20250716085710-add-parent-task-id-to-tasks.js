'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'parent_task_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'tasks',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'CASCADE',
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['parent_task_id']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', ['parent_task_id']);
        await queryInterface.removeColumn('tasks', 'parent_task_id');
    },
};
