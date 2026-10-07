'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // Lets a feed be hidden from the Calendar page without disconnecting it,
    // so its meetings still block time on the Today planner.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'calendar_feeds', [
            {
                name: 'show_on_calendar',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'calendar_feeds',
            'show_on_calendar'
        );
    },
};
