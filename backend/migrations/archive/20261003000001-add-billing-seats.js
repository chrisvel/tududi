'use strict';

const {
    safeAddColumns,
    safeRemoveColumn,
} = require('../utils/migration-utils');

module.exports = {
    // Seats on a subscription: the provider's line item whose quantity is the
    // number of paid seats (the owner plus the members it added), and that
    // quantity as last reported.
    async up(queryInterface, Sequelize) {
        await safeAddColumns(queryInterface, 'billing_accounts', [
            {
                name: 'provider_subscription_item_id',
                definition: { type: Sequelize.STRING(64), allowNull: true },
            },
            {
                name: 'seat_quantity',
                definition: { type: Sequelize.INTEGER, allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        await safeRemoveColumn(
            queryInterface,
            'billing_accounts',
            'seat_quantity'
        );
        await safeRemoveColumn(
            queryInterface,
            'billing_accounts',
            'provider_subscription_item_id'
        );
    },
};
