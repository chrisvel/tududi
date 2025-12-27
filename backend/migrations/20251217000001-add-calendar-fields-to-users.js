'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'calendar_enabled',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
            {
                name: 'ical_feed_enabled',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
            {
                name: 'ical_feed_token',
                definition: {
                    type: Sequelize.STRING(255),
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'ical_feed_token');
        await safeRemoveColumn(queryInterface, 'users', 'ical_feed_enabled');
        await safeRemoveColumn(queryInterface, 'users', 'calendar_enabled');
    },
};
