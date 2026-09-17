'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'ai_api_key',
                definition: {
                    type: Sequelize.TEXT,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'ai_base_url',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: null,
                },
            },
            {
                name: 'ai_model',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: null,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('users', 'ai_api_key');
        await queryInterface.removeColumn('users', 'ai_base_url');
        await queryInterface.removeColumn('users', 'ai_model');
    },
};
