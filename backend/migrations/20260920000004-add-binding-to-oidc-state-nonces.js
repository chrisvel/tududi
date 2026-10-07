'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'oidc_state_nonces', [
            {
                name: 'binding_hash',
                definition: {
                    type: Sequelize.STRING(64),
                    allowNull: true,
                },
            },
            {
                name: 'user_id',
                definition: {
                    type: Sequelize.INTEGER,
                    allowNull: true,
                },
            },
        ]);
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('oidc_state_nonces', 'binding_hash');
        await queryInterface.removeColumn('oidc_state_nonces', 'user_id');
    },
};
