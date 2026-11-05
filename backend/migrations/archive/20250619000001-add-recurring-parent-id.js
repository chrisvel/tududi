'use strict';

const {
    safeAddColumns,
    safeAddIndex,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'recurring_parent_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                    references: {
                        model: 'tasks',
                        key: 'id',
                    },
                    onUpdate: 'CASCADE',
                    onDelete: 'SET NULL',
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['recurring_parent_id']);
    },

    down: async (queryInterface) => {
        try {
            await queryInterface.removeIndex('tasks', ['recurring_parent_id']);
        } catch (error) {
            console.log(
                'Could not remove index recurring_parent_id:',
                error.message
            );
        }
        await safeRemoveColumn(queryInterface, 'tasks', 'recurring_parent_id');
    },
};
