'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'webhook_endpoints', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            url: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            secret: {
                // Stores the encrypted form (see secretCipher.js), which is
                // longer than the plaintext HMAC secret it wraps.
                type: Sequelize.TEXT,
                allowNull: false,
            },
            event_types: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
            },
            active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            last_delivery_at: { type: Sequelize.DATE, allowNull: true },
            last_delivery_status: {
                type: Sequelize.STRING(16),
                allowNull: true,
            },
            last_delivery_error: { type: Sequelize.TEXT, allowNull: true },
            failure_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        });

        await safeAddIndex(queryInterface, 'webhook_endpoints', ['user_id'], {
            name: 'webhook_endpoints_user_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('webhook_endpoints');
    },
};
