'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'defer',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    comment: 'Defer timeframe filter',
                },
            },
            {
                name: 'extras',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    comment: 'JSON array of extras filters',
                },
            },
        ]);
    },

    down: async (queryInterface) => {
        await safeRemoveColumn(queryInterface, 'views', 'extras');
        await safeRemoveColumn(queryInterface, 'views', 'defer');
    },
};
