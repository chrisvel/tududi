'use strict';

const { safeAddColumns, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'defer_until',
                definition: {
                    type: Sequelize.DATE,
                    allowNull: true,
                    comment:
                        'Date and time when the task becomes visible/actionable',
                },
            },
        ]);

        await safeAddIndex(queryInterface, 'tasks', ['defer_until']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('tasks', ['defer_until']);
        await queryInterface.removeColumn('tasks', 'defer_until');
    },
};
