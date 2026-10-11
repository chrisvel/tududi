'use strict';

const { safeCreateTable } = require('../utils/migration-utils');

async function addIndexOnce(queryInterface, table, fields, options) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((i) => i.name === options.name)) {
        return;
    }
    await queryInterface.addIndex(table, fields, options);
}

// Life-to-Day (T-305): stored responses for Idempotency-Key, so a retried
// POST/PATCH (offline replay, flaky network) returns the first response
// instead of creating a duplicate row. Purely additive. Keys expire after
// seven days (purged lazily by the module, indexed on created_at).
module.exports = {
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'ltd_idempotency_keys', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            key: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: { model: 'users', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            method: {
                type: Sequelize.STRING(10),
                allowNull: false,
            },
            path: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            status: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            response: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        await addIndexOnce(
            queryInterface,
            'ltd_idempotency_keys',
            ['user_id', 'key'],
            {
                unique: true,
                name: 'ltd_idempotency_keys_user_key_unique',
            }
        );
        await addIndexOnce(
            queryInterface,
            'ltd_idempotency_keys',
            ['created_at'],
            {
                name: 'ltd_idempotency_keys_created_at',
            }
        );
    },

    async down(queryInterface) {
        await queryInterface.dropTable('ltd_idempotency_keys');
    },
};
