'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'completed_at',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['completed_at']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('tasks', ['completed_at']);
        await queryInterface.removeColumn('tasks', 'completed_at');
    },
};
