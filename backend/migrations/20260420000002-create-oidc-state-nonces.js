'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'oidc_state_nonces', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            state: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            nonce: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            provider_slug: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            code_verifier: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            redirect_uri: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'oidc_state_nonces', ['state'], {
            unique: true,
        });
        await safeAddIndex(queryInterface, 'oidc_state_nonces', ['expires_at']);
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('oidc_state_nonces', ['expires_at']);
        await queryInterface.removeIndex('oidc_state_nonces', ['state']);

        await queryInterface.dropTable('oidc_state_nonces');
    },
};
