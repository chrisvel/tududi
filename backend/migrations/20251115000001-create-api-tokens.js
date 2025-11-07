'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        const tableName = 'api_tokens';
        let tableExists = false;
        try {
            await queryInterface.describeTable(tableName);
            tableExists = true;
        } catch (error) {
            tableExists = false;
        }

        if (!tableExists) {
            await queryInterface.createTable(tableName, {
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
        }

        await safeAddIndex(queryInterface, tableName, ['user_id']);
        await safeAddIndex(queryInterface, tableName, ['token_prefix'], {
            name: 'api_tokens_token_prefix_idx',
            unique: false,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('api_tokens');
    },
};
