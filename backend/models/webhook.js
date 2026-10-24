const { DataTypes } = require('sequelize');
const { uid } = require('../utils/uid');

// An address a user asked tududi to POST events to. `url` and `secret` are
// encrypted with secretCipher: chat and automation webhook addresses work
// like passwords. `events` lists the event names this webhook wants (see
// backend/modules/webhooks/events.js). After too many failed deliveries in a
// row the webhook turns itself off and `disabled_reason` says why.
module.exports = (sequelize) => {
    const Webhook = sequelize.define(
        'Webhook',
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
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
            },
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            url: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            secret: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            events: {
                type: DataTypes.JSON,
                allowNull: false,
                defaultValue: [],
            },
            // Local hour (in the user's timezone) for the daily summary.
            summary_hour: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 8,
                validate: { min: 0, max: 23 },
            },
            // Local date (YYYY-MM-DD) of the last daily summary sent.
            last_summary_on: {
                type: DataTypes.STRING(10),
                allowNull: true,
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            failure_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            disabled_reason: {
                type: DataTypes.STRING(32),
                allowNull: true,
            },
            last_delivery_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            // 'delivered' or 'failed'
            last_delivery_status: {
                type: DataTypes.STRING(16),
                allowNull: true,
            },
        },
        {
            tableName: 'webhooks',
            indexes: [{ fields: ['user_id'], name: 'webhooks_user_id' }],
        }
    );

    return Webhook;
};
