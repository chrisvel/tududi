'use strict';

const { safeAddColumns } = require('../utils/migration-utils');

// Billing gains a second payment provider (Lemon Squeezy), so the columns
// that named Stripe become provider-neutral. RENAME COLUMN is supported by
// PostgreSQL and by the SQLite build node-sqlite3 ships (3.25+), and keeps
// the unique indexes attached to the column.

const RENAMES = [
    ['billing_accounts', 'stripe_customer_id', 'provider_customer_id'],
    ['billing_accounts', 'stripe_subscription_id', 'provider_subscription_id'],
    ['billing_accounts', 'last_stripe_event_created', 'last_provider_event_at'],
    ['billing_events', 'stripe_event_id', 'provider_event_id'],
];

async function renameIfPresent(queryInterface, table, from, to) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(table)) return;
    const columns = await queryInterface.describeTable(table);
    if (!columns[from] || columns[to]) return;
    const q = queryInterface.quoteIdentifier.bind(queryInterface);
    await queryInterface.sequelize.query(
        `ALTER TABLE ${q(table)} RENAME COLUMN ${q(from)} TO ${q(to)}`
    );
}

module.exports = {
    async up(queryInterface, Sequelize) {
        for (const [table, from, to] of RENAMES) {
            await renameIfPresent(queryInterface, table, from, to);
        }
        await safeAddColumns(queryInterface, 'billing_accounts', [
            {
                name: 'provider',
                definition: { type: Sequelize.STRING(32), allowNull: true },
            },
        ]);
    },

    async down(queryInterface) {
        for (const [table, from, to] of RENAMES) {
            await renameIfPresent(queryInterface, table, to, from);
        }
        const columns = await queryInterface.describeTable('billing_accounts');
        if (columns.provider) {
            await queryInterface.removeColumn('billing_accounts', 'provider');
        }
    },
};
