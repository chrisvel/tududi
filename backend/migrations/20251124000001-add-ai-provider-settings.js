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
                name: 'ai_provider',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: false,
                    defaultValue: 'openai',
                },
            },
            {
                name: 'openai_api_key',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                },
            },
            {
                name: 'ollama_base_url',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: 'http://localhost:11434',
                },
            },
            {
                name: 'ollama_model',
                definition: {
                    type: Sequelize.STRING,
                    allowNull: true,
                    defaultValue: 'llama3',
                },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'ai_provider');
        await safeRemoveColumn(queryInterface, 'users', 'openai_api_key');
        await safeRemoveColumn(queryInterface, 'users', 'ollama_base_url');
        await safeRemoveColumn(queryInterface, 'users', 'ollama_model');
    },
};
