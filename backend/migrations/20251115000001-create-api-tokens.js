'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'api_tokens', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            token_hash: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            token_prefix: {
                type: Sequelize.STRING(32),
                allowNull: false,
            },
            abilities: {
                type: Sequelize.JSON,
                allowNull: true,
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_used_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            revoked_at: {
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

        await safeAddIndex(queryInterface, 'api_tokens', ['user_id']);
        await safeAddIndex(queryInterface, 'api_tokens', ['token_prefix'], {
            name: 'api_tokens_token_prefix_idx',
            unique: false,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('api_tokens');
    },
};
