'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const columns = [
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
        ];

        await safeAddColumns(queryInterface, 'tasks', columns);
        await safeAddIndex(queryInterface, 'tasks', ['parent_task_id']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', ['parent_task_id']);
        await queryInterface.removeColumn('tasks', 'parent_task_id');
    },
};
