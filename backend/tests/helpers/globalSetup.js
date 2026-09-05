// Jest globalSetup: when the suite targets PostgreSQL, create one database
// per worker so test files running in parallel never share tables.
// No-op for SQLite, where each test file gets its own temporary file.

const { testDatabaseName } = require('./test-db');

module.exports = async function globalSetup(globalConfig) {
    if (!process.env.DATABASE_URL && !process.env.DB_DIALECT) {
        return;
    }

    const { Client } = require('pg');
    const {
        resolveDatabaseSettings,
    } = require('../../config/database-settings');

    const settings = resolveDatabaseSettings(process.env, null);
    if (settings.dialect !== 'postgres') {
        return;
    }

    const admin = new Client({
        host: settings.host,
        port: settings.port,
        user: settings.username,
        password: settings.password,
        // The maintenance database always exists; per-worker ones may not yet.
        database: process.env.DB_ADMIN_DATABASE || 'postgres',
        ssl: settings.ssl
            ? { rejectUnauthorized: settings.ssl.rejectUnauthorized }
            : undefined,
    });
    await admin.connect();

    try {
        const workers = Math.max(1, globalConfig.maxWorkers || 1);
        for (let worker = 1; worker <= workers; worker++) {
            const name = testDatabaseName(String(worker));
            const { rowCount } = await admin.query(
                'SELECT 1 FROM pg_database WHERE datname = $1',
                [name]
            );
            if (rowCount === 0) {
                await admin.query(`CREATE DATABASE "${name}"`);
            }
        }
    } finally {
        await admin.end();
    }
};
