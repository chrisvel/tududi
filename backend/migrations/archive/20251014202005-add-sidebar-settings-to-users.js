'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'sidebar_settings',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: JSON.stringify({ pinnedViewsOrder: [] }),
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'sidebar_settings');
    },
};
