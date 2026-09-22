'use strict';

const { safeChangeColumn } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'oidc_identities', 'picture', {
            type: Sequelize.TEXT('long'),
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await safeChangeColumn(queryInterface, 'oidc_identities', 'picture', {
            type: Sequelize.STRING,
            allowNull: true,
        });
    },
};
