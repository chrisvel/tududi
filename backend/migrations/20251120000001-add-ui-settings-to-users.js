'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'ui_settings',
                definition: {
                    type: Sequelize.JSON,
                    allowNull: true,
                    defaultValue: JSON.stringify({
                        project: { details: { showMetrics: true } },
                    }),
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'ui_settings');
    },
};
