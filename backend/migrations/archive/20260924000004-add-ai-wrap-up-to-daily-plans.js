'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // The AI end-of-day summary for a plan, kept so it is not regenerated
    // (and paid for) on every visit to Today.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'daily_plans', [
            {
                name: 'ai_wrap_up',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'daily_plans', 'ai_wrap_up');
    },
};
