'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'views', [
            {
                name: 'recurring',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await safeRemoveColumn(queryInterface, 'views', 'recurring');
    },
};
