'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Outgoing webhooks: the addresses a user registered, and one row per
// message sent (or still to send) to one of them. Purely additive.
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'webhooks', {
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
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            url: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            secret: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            events: {
                type: Sequelize.JSON,
                allowNull: false,
            },
            summary_hour: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 8,
            },
            last_summary_on: {
                type: Sequelize.STRING(10),
                allowNull: true,
            },
            enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            failure_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            disabled_reason: {
                type: Sequelize.STRING(32),
                allowNull: true,
            },
            last_delivery_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_delivery_status: {
                type: Sequelize.STRING(16),
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

        await addIndexOnce(queryInterface, 'webhooks', ['user_id'], {
            name: 'webhooks_user_id',
        });

        await safeCreateTable(queryInterface, 'webhook_deliveries', {
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
            webhook_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'webhooks', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            event: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            payload: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            status: {
                type: Sequelize.STRING(16),
                allowNull: false,
                defaultValue: 'pending',
            },
            attempts: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            next_attempt_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            response_status: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            error: {
                type: Sequelize.STRING(500),
                allowNull: true,
            },
            delivered_at: {
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

        await addIndexOnce(
            queryInterface,
            'webhook_deliveries',
            ['status', 'next_attempt_at'],
            { name: 'webhook_deliveries_status_next' }
        );
        await addIndexOnce(
            queryInterface,
            'webhook_deliveries',
            ['webhook_id', 'created_at'],
            { name: 'webhook_deliveries_webhook_created' }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('webhook_deliveries');
        await queryInterface.dropTable('webhooks');
    },
};
