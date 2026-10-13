const { DataTypes } = require('sequelize');

// One row per browser or installed app that agreed to receive Web Push
// notifications. The endpoint and keys come from PushManager.subscribe() on
// the device; a row disappears when the push service says the subscription
// is gone, or when the user turns push off on that device.
module.exports = (sequelize) => {
    const PushSubscription = sequelize.define(
        'PushSubscription',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            endpoint: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            endpoint_hash: {
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            p256dh: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            auth: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },
            user_agent: {
                type: DataTypes.STRING(512),
                allowNull: true,
            },
            last_success_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            failure_count: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
        },
        {
            tableName: 'push_subscriptions',
            indexes: [
                { fields: ['user_id'] },
                { fields: ['endpoint_hash'], unique: true },
            ],
        }
    );

    return PushSubscription;
};
