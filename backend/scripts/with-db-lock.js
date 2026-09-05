#!/usr/bin/env node

// Runs a command while holding a PostgreSQL advisory lock, so two app
// containers starting at the same time cannot both create the schema or run
// migrations. On SQLite (one process by definition) the command just runs.
//
// Usage: node scripts/with-db-lock.js <command> [args...]

try {
    require('dotenv').config();
} catch (_) {}

const { spawn } = require('child_process');
const { Sequelize } = require('sequelize');
const { buildSequelizeOptions } = require('../config/db');
const { getConfig } = require('../config/config');

// Any fixed key works; it only has to be the same in every process.
const SCHEMA_LOCK_KEY = 7263001;

function runCommand(argv) {
    return new Promise((resolve) => {
        const child = spawn(argv[0], argv.slice(1), {
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        child.on('exit', (code) => resolve(code ?? 1));
        child.on('error', () => resolve(1));
    });
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0) {
        console.error('Usage: with-db-lock.js <command> [args...]');
        process.exit(2);
    }

    const config = getConfig();
    if (config.db.dialect !== 'postgres') {
        process.exit(await runCommand(argv));
    }

    const sequelize = new Sequelize(buildSequelizeOptions({ logging: false }));
    let exitCode = 1;
    try {
        await sequelize.authenticate();
        const tx = await sequelize.transaction();
        console.log('Waiting for the schema lock...');
        await sequelize.query('SELECT pg_advisory_xact_lock(:key)', {
            replacements: { key: SCHEMA_LOCK_KEY },
            transaction: tx,
        });
        console.log('Schema lock acquired');
        try {
            exitCode = await runCommand(argv);
        } finally {
            await tx.rollback();
        }
    } catch (error) {
        console.error('Could not take the schema lock:', error.message);
        exitCode = 1;
    } finally {
        await sequelize.close().catch(() => {});
    }
    process.exit(exitCode);
}

main();
