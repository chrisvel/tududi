'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'calendar_tokens', {
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
                onDelete: 'CASCADE',
            },
            provider: {
                type: Sequelize.STRING,
                allowNull: false,
                defaultValue: 'google',
            },
            access_token: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            refresh_token: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            token_type: {
                type: Sequelize.STRING,
                allowNull: true,
                defaultValue: 'Bearer',
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            scope: {
                type: Sequelize.TEXT,
                allowNull: true,
            },
            connected_email: {
                type: Sequelize.STRING,
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

        await safeAddIndex(
            queryInterface,
            'calendar_tokens',
            ['user_id', 'provider'],
            { unique: true, name: 'calendar_tokens_user_provider_unique' }
        );
        await safeAddIndex(queryInterface, 'calendar_tokens', ['user_id'], {
            name: 'calendar_tokens_user_id_index',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('calendar_tokens');
    },
};
