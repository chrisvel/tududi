'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'oidc_identities', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            provider_slug: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            subject: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            email: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            given_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            family_name: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            picture: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            raw_claims: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            first_login_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_login_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await safeAddIndex(queryInterface, 'oidc_identities', ['user_id']);
        await safeAddIndex(queryInterface, 'oidc_identities', [
            'provider_slug',
        ]);
        await safeAddIndex(queryInterface, 'oidc_identities', ['email']);
        await safeAddIndex(
            queryInterface,
            'oidc_identities',
            ['provider_slug', 'subject'],
            { unique: true }
        );
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('oidc_identities', [
            'provider_slug',
            'subject',
        ]);
        await queryInterface.removeIndex('oidc_identities', ['email']);
        await queryInterface.removeIndex('oidc_identities', ['provider_slug']);
        await queryInterface.removeIndex('oidc_identities', ['user_id']);

        await queryInterface.dropTable('oidc_identities');
    },
};
