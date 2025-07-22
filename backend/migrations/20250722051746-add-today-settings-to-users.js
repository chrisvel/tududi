'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        try {
            const tableInfo = await queryInterface.describeTable('users');

            // Check if today_settings column already exists
            if (!('today_settings' in tableInfo)) {
                await queryInterface.addColumn('users', 'today_settings', {
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
                });
            }
        } catch (error) {
            console.log('Migration error:', error.message);
            throw error;
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'today_settings');
    },
};
