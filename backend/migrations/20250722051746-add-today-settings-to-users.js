'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'today_settings',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: {
                        showMetrics: false,
                        showProductivity: false,
                        showNextTaskSuggestion: false,
                        showSuggestions: false,
                        showDueToday: true,
                        showCompleted: true,
                        showProgressBar: true,
                        showDailyQuote: true,
                    },
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'today_settings');
    },
};
