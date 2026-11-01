'use strict';

const { safeAddColumns, safeCreateTable } = require('../utils/migration-utils');

const INDEXES = [
    { table: 'users', name: 'users_account_id' },
    { table: 'user_groups', name: 'user_groups_account_id' },
];

// safeAddIndex skips an index when any of its columns is already indexed, so
// the indexes are added directly and guarded by name.
async function addIndexOnce(queryInterface, table, name) {
    const indexes = await queryInterface.showIndex(table);
    if (indexes.some((index) => index.name === name)) return;
    await queryInterface.addIndex(table, ['account_id'], { name });
}

// Group names become unique per account instead of per instance, so two
// families can both have a "Kids" group. The service checks the name. Only
// PostgreSQL drops the old constraint: on SQLite it is part of the table and
// would need a rebuild, and a self-hosted instance has a single account.
async function dropGroupNameUnique(queryInterface) {
    if (queryInterface.sequelize.getDialect() !== 'postgres') return;
    const [rows] = await queryInterface.sequelize.query(`
        SELECT con.conname AS name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att
            ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
        WHERE rel.relname = 'user_groups'
            AND con.contype = 'u'
            AND array_length(con.conkey, 1) = 1
            AND att.attname = 'name'
    `);
    for (const row of rows) {
        await queryInterface.sequelize.query(
            `ALTER TABLE "user_groups" DROP CONSTRAINT IF EXISTS "${row.name}"`
        );
    }
}

module.exports = {
    // Accounts for a hosted instance (see models/account.js). Everything is
    // added, nothing existing is rebuilt, and a self-hosted instance leaves
    // the new table and columns empty. Existing customers are put into
    // accounts when a hosted instance starts (services/accountsService.js).
    async up(queryInterface, Sequelize) {
        await safeCreateTable(queryInterface, 'accounts', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            uid: {
                type: Sequelize.STRING(15),
                allowNull: false,
                unique: true,
            },
            owner_user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: true,
            },
            created_at: { type: Sequelize.DATE, allowNull: false },
            updated_at: { type: Sequelize.DATE, allowNull: false },
        });

        // Plain numbers, not foreign keys, so users is only added to and
        // never rebuilt.
        for (const table of ['users', 'user_groups']) {
            await safeAddColumns(queryInterface, table, [
                {
                    name: 'account_id',
                    definition: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        defaultValue: null,
                    },
                },
            ]);
        }
        for (const { table, name } of INDEXES) {
            await addIndexOnce(queryInterface, table, name);
        }

        await dropGroupNameUnique(queryInterface);
    },

    async down(queryInterface) {
        for (const { table, name } of INDEXES) {
            const indexes = await queryInterface.showIndex(table);
            if (indexes.some((index) => index.name === name)) {
                await queryInterface.removeIndex(table, name);
            }
        }
        for (const table of ['users', 'user_groups']) {
            const info = await queryInterface.describeTable(table);
            if ('account_id' in info) {
                // removeColumn would rebuild the table on SQLite.
                await queryInterface.sequelize.query(
                    `ALTER TABLE "${table}" DROP COLUMN "account_id"`
                );
            }
        }
        await queryInterface.dropTable('accounts');
    },
};
