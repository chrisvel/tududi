'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'notes', [
            {
                name: 'color',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await safeRemoveColumn(queryInterface, 'notes', 'color');
    },
};
