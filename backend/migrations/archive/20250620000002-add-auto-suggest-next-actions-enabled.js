'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'auto_suggest_next_actions_enabled',
                definition: {
                    type: Sequelize.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                },
            },
        ]);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.removeColumn(
            'users',
            'auto_suggest_next_actions_enabled'
        );
    },
};
