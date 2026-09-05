'use strict';

const { safeCreateTable, safeAddIndex } = require('../utils/migration-utils');

module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'billing_accounts', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            stripe_customer_id: {
                type: Sequelize.STRING(64),
                allowNull: true,
                unique: true,
            },
            stripe_subscription_id: {
                type: Sequelize.STRING(64),
                allowNull: true,
                unique: true,
            },
            plan: {
                type: Sequelize.STRING(32),
                allowNull: false,
                defaultValue: 'free',
            },
            status: {
                type: Sequelize.STRING(32),
                allowNull: false,
                defaultValue: 'none',
            },
            price_id: { type: Sequelize.STRING(64), allowNull: true },
            billing_interval: { type: Sequelize.STRING(16), allowNull: true },
            current_period_start: { type: Sequelize.DATE, allowNull: true },
            current_period_end: { type: Sequelize.DATE, allowNull: true },
            trial_ends_at: { type: Sequelize.DATE, allowNull: true },
            cancel_at_period_end: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            canceled_at: { type: Sequelize.DATE, allowNull: true },
            last_payment_failed_at: { type: Sequelize.DATE, allowNull: true },
            override_plan: { type: Sequelize.STRING(32), allowNull: true },
            override_expires_at: { type: Sequelize.DATE, allowNull: true },
            override_reason: { type: Sequelize.STRING(255), allowNull: true },
            override_by_user_id: { type: Sequelize.INTEGER, allowNull: true },
            last_stripe_event_created: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        });

        await safeAddIndex(queryInterface, 'billing_accounts', ['status'], {
            name: 'billing_accounts_status',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('billing_accounts');
    },
};
