'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'users', [
            {
                name: 'apprise_url',
                definition: { type: Sequelize.TEXT, allowNull: true },
            },
            {
                name: 'apprise_key',
                definition: { type: Sequelize.TEXT, allowNull: true },
            },
            {
                name: 'apprise_tags',
                definition: { type: Sequelize.STRING(200), allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(queryInterface, 'users', 'apprise_tags');
        await safeRemoveColumn(queryInterface, 'users', 'apprise_key');
        await safeRemoveColumn(queryInterface, 'users', 'apprise_url');
    },
};
