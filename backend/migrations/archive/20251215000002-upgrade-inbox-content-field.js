'use strict';

const { safeChangeColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'inbox_items', 'content', {
            type: Sequelize.TEXT('long'),
            allowNull: false,
        });
    },

    async down(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'inbox_items', 'content', {
            type: Sequelize.STRING,
            allowNull: false,
        });
    },
};
