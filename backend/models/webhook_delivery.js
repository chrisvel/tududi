const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

// One event sent, or still to send, to one webhook. `payload` is the exact
// JSON body, so a retry sends the same bytes and the same signature input.
// Status moves pending -> sending -> delivered, or back to pending with a
// later `next_attempt_at` until the attempts run out and it is 'failed'.
module.exports = (sequelize) => {
    const WebhookDelivery = sequelize.define(
        'WebhookDelivery',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
                defaultValue: uid,
            },
            webhook_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'webhooks', key: 'id' },
            },
            event: {
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            payload: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            status: {
                type: DataTypes.STRING(16),
                allowNull: false,
                defaultValue: 'pending',
            },
            attempts: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            next_attempt_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            response_status: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            error: {
                type: DataTypes.STRING(500),
                allowNull: true,
            },
            delivered_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'webhook_deliveries',
            indexes: [
                {
                    fields: ['status', 'next_attempt_at'],
                    name: 'webhook_deliveries_status_next',
                },
                {
                    fields: ['webhook_id', 'created_at'],
                    name: 'webhook_deliveries_webhook_created',
                },
            ],
        }
    );

    return WebhookDelivery;
};
