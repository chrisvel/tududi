const { DataTypes } = require('sequelize');

// One row per user in hosted mode, created lazily on first entitlement
// lookup. Everything Stripe tells us about the subscription lands here;
// override_* is the admin's way to comp or restrict an account.
const STATUSES = [
    'none',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'incomplete',
    'incomplete_expired',
    'paused',
];

module.exports = (sequelize) => {
    const BillingAccount = sequelize.define(
        'BillingAccount',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'CASCADE',
            },
            stripe_customer_id: {
                type: DataTypes.STRING(64),
                allowNull: true,
                unique: true,
            },
            stripe_subscription_id: {
                type: DataTypes.STRING(64),
                allowNull: true,
                unique: true,
            },
            plan: {
                type: DataTypes.STRING(32),
                allowNull: false,
                defaultValue: 'free',
            },
            status: {
                type: DataTypes.STRING(32),
                allowNull: false,
                defaultValue: 'none',
                validate: { isIn: [STATUSES] },
            },
            price_id: {
                type: DataTypes.STRING(64),
                allowNull: true,
            },
            billing_interval: {
                type: DataTypes.STRING(16),
                allowNull: true,
            },
            current_period_start: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            current_period_end: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            trial_ends_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            cancel_at_period_end: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            canceled_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            last_payment_failed_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            override_plan: {
                type: DataTypes.STRING(32),
                allowNull: true,
            },
            override_expires_at: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            override_reason: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            override_by_user_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            last_stripe_event_created: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
        },
        {
            tableName: 'billing_accounts',
            indexes: [{ fields: ['status'] }],
        }
    );

    BillingAccount.STATUSES = STATUSES;

    return BillingAccount;
};
