'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // A rough length for the task, offered as 15m / 30m / 1h / 2h chips and
    // used as the default block size when the task is added to a day plan.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'estimated_minutes',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'tasks', 'estimated_minutes');
    },
};
