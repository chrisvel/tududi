'use strict';

const { safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('push_subscriptions', {
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
            endpoint: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            keys: {
                type: Sequelize.JSON,
                allowNull: false,
                comment: 'Contains p256dh and auth keys for encryption',
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

        await safeAddIndex(queryInterface, 'push_subscriptions', ['user_id'], {
            name: 'push_subscriptions_user_id_idx',
        });

        await safeAddIndex(queryInterface, 'push_subscriptions', ['endpoint'], {
            name: 'push_subscriptions_endpoint_idx',
            unique: true,
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('push_subscriptions');
    },
};

