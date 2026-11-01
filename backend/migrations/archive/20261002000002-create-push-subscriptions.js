'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'push_subscriptions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            endpoint: { type: Sequelize.TEXT, allowNull: false },
            // Endpoints can be longer than a portable unique index allows,
            // so uniqueness is enforced on a sha256 of the endpoint instead.
            endpoint_hash: { type: Sequelize.STRING(64), allowNull: false },
            p256dh: { type: Sequelize.STRING(255), allowNull: false },
            auth: { type: Sequelize.STRING(255), allowNull: false },
            user_agent: { type: Sequelize.STRING(512), allowNull: true },
            last_success_at: { type: Sequelize.DATE, allowNull: true },
            failure_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
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
        await safeAddIndex(queryInterface, 'push_subscriptions', ['user_id']);
        await safeAddIndex(
            queryInterface,
            'push_subscriptions',
            ['endpoint_hash'],
            { unique: true }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('push_subscriptions');
    },
};
