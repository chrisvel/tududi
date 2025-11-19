'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'tasks', [
            {
                name: 'recurrence_weekdays',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment:
                        'JSON array of weekday numbers for weekly recurrence (e.g., "[1,3,5]" for Mon, Wed, Fri)',
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await safeRemoveColumn(queryInterface, 'tasks', 'recurrence_weekdays');
    },
};
