const { DataTypes } = require('sequelize');

// Every payment-provider webhook event we have seen, keyed by the
// provider's event id, so a redelivered event is recognised and applied once.
module.exports = (sequelize) => {
    const BillingEvent = sequelize.define(
        'BillingEvent',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            provider_event_id: {
                type: DataTypes.STRING(64),
                allowNull: false,
                unique: true,
            },
            type: {
                type: DataTypes.STRING(64),
                allowNull: false,
            },
            status: {
                type: DataTypes.STRING(16),
                allowNull: false,
                defaultValue: 'received',
                validate: {
                    isIn: [['received', 'processed', 'skipped', 'failed']],
                },
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            error: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            processed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: 'billing_events',
            indexes: [{ fields: ['type'] }, { fields: ['created_at'] }],
        }
    );

    return BillingEvent;
};
