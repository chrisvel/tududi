const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function migrationFiles() {
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((name) => name.endsWith('.js'))
        .sort();
}

// Migration files on disk that SequelizeMeta has not recorded. A non-empty
// list means the entrypoint's migrate step did not run or failed.
async function pendingMigrations() {
    const [rows] = await sequelize.query('SELECT name FROM "SequelizeMeta"');
    const applied = new Set(rows.map((row) => row.name));
    return migrationFiles().filter((name) => !applied.has(name));
}

// Liveness: the process is up. Readiness: it can actually serve, meaning
// the database answers and the schema is current.
async function readiness() {
    const started = Date.now();
    try {
        await sequelize.query('SELECT 1');
        const pending = await pendingMigrations();
        return {
            status: pending.length === 0 ? 'ok' : 'degraded',
            database: 'ok',
            databaseLatencyMs: Date.now() - started,
            pendingMigrations: pending,
        };
    } catch (error) {
        return {
            status: 'error',
            database: 'error',
            error: error.message,
            pendingMigrations: null,
        };
    }
}

module.exports = { readiness, pendingMigrations };
