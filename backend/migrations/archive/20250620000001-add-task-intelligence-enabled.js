'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'task_intelligence_enabled',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: true,
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn('users', 'task_intelligence_enabled');
    },
};
