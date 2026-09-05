'use strict';

const { Op } = require('sequelize');
const { getDialect } = require('../config/db');

// The one place application code is allowed to branch on the database engine.

function isPostgres() {
    return getDialect() === 'postgres';
}

function isSqlite() {
    return getDialect() === 'sqlite';
}

// Case-insensitive LIKE. SQLite's LIKE already ignores ASCII case;
// PostgreSQL needs ILIKE for the same behaviour.
function ciLike(pattern) {
    return isPostgres() ? { [Op.iLike]: pattern } : { [Op.like]: pattern };
}

// Runs `fn` with SQLite foreign key enforcement switched off. On PostgreSQL
// constraints cannot be toggled per connection, so `fn` just runs as-is and
// the caller must delete rows in dependency order (which every current
// caller already does).
async function withForeignKeyChecksDisabled(sequelize, fn, options = {}) {
    if (!isSqlite()) {
        return fn();
    }

    const queryOptions = options.transaction
        ? { transaction: options.transaction }
        : undefined;

    await sequelize.query('PRAGMA foreign_keys = OFF', queryOptions);
    try {
        return await fn();
    } finally {
        await sequelize.query('PRAGMA foreign_keys = ON', queryOptions);
    }
}

// Empties the given tables. Intended for tests and seed scripts.
// On PostgreSQL the rows are deleted with constraints enforced, so pass the
// tables children first (join tables before tasks, tasks before users, ...).
// DELETE is used rather than TRUNCATE because TRUNCATE takes exclusive locks
// and is far slower on many small tables.
async function truncateTables(sequelize, tableNames) {
    if (tableNames.length === 0) return;

    if (isPostgres()) {
        for (const tableName of tableNames) {
            await sequelize.query(`DELETE FROM "${tableName}"`);
        }
        return;
    }

    await withForeignKeyChecksDisabled(sequelize, async () => {
        for (const tableName of tableNames) {
            await sequelize.query(`DELETE FROM ${tableName}`);
        }
    });
}

module.exports = {
    isPostgres,
    isSqlite,
    ciLike,
    withForeignKeyChecksDisabled,
    truncateTables,
};
