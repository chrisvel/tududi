#!/usr/bin/env node

/**
 * Database Prepare Script
 *
 * Run before migrations on every start. Makes sure the database is reachable
 * and, when it is empty, creates the schema from the models.
 *
 * SQLite: same behaviour as before (sync, then let every migration run; the
 * migrations are idempotent over a synced schema).
 *
 * PostgreSQL: after syncing, every existing migration file is recorded in
 * SequelizeMeta as already applied ("baseline"). The historical migrations
 * contain SQLite-only SQL and never need to replay on a fresh Postgres
 * database, whose schema comes straight from the models. Migrations added
 * after this point run normally on both dialects.
 */

try {
    require('dotenv').config();
} catch (_) {}

const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const { getConfig } = require('../config/config');
const { sequelize, Setting } = require('../models');

const META_TABLE = 'SequelizeMeta';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

function listMigrationFiles() {
    return fs
        .readdirSync(MIGRATIONS_DIR)
        .filter((file) => file.endsWith('.js'))
        .sort();
}

async function tableExists(queryInterface, tableName) {
    const tables = await queryInterface.showAllTables();
    return tables.map(String).includes(tableName);
}

async function ensureMetaTable(queryInterface) {
    if (await tableExists(queryInterface, META_TABLE)) return;

    // Same shape sequelize-cli / umzug create themselves.
    await queryInterface.createTable(META_TABLE, {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true,
        },
    });
}

async function recordBaseline(queryInterface) {
    await ensureMetaTable(queryInterface);

    const [rows] = await sequelize.query(`SELECT name FROM "${META_TABLE}"`);
    const applied = new Set(rows.map((row) => row.name));
    const missing = listMigrationFiles().filter((file) => !applied.has(file));

    if (missing.length === 0) return 0;

    await queryInterface.bulkInsert(
        META_TABLE,
        missing.map((name) => ({ name }))
    );
    return missing.length;
}

async function seedReferenceData() {
    // Mirrors the seed rows that historical migrations insert on SQLite.
    await Setting.findOrCreate({
        where: { key: 'registration_enabled' },
        defaults: { key: 'registration_enabled', value: 'false' },
    });
}

// A DATABASE_URL or DB_DIALECT left in the environment silently moves an
// existing SQLite deployment onto an empty PostgreSQL schema: the app comes up
// with no data while the SQLite file sits untouched. Refuse to continue when
// the SQLite file that this deployment would otherwise use holds data, unless
// the operator confirms the switch.
function guardAgainstAccidentalDialectSwitch(dialect) {
    if (dialect !== 'postgres') return;
    if (process.env.TUDUDI_ALLOW_DIALECT_SWITCH === 'true') return;

    const sqliteFile = getConfig().dbFile;
    if (!sqliteFile) return;

    let size = 0;
    try {
        size = fs.statSync(sqliteFile).size;
    } catch (_) {
        return;
    }
    if (size === 0) return;

    console.error('');
    console.error(
        '❌ PostgreSQL is selected (DATABASE_URL or DB_DIALECT is set), but an existing SQLite database was found:'
    );
    console.error(`   ${sqliteFile} (${size} bytes)`);
    console.error('');
    console.error(
        '   There is no automatic transfer between engines. Starting now would bring up an empty PostgreSQL'
    );
    console.error('   database and your SQLite data would not be visible.');
    console.error('');
    console.error(
        '   To keep using SQLite: unset DATABASE_URL and DB_DIALECT.'
    );
    console.error(
        '   To start on PostgreSQL anyway (fresh data, or data already imported): set TUDUDI_ALLOW_DIALECT_SWITCH=true.'
    );
    console.error('');
    process.exit(1);
}

async function prepareDatabase() {
    const dialect = sequelize.getDialect();
    const queryInterface = sequelize.getQueryInterface();

    guardAgainstAccidentalDialectSwitch(dialect);

    console.log(`Preparing ${dialect} database...`);
    await sequelize.authenticate();

    const fresh = !(await tableExists(queryInterface, 'users'));

    if (!fresh) {
        console.log('✅ Existing database detected, schema left to migrations');
        return;
    }

    console.log('Empty database detected, creating schema from models...');
    await sequelize.sync();

    if (dialect === 'postgres') {
        const recorded = await recordBaseline(queryInterface);
        await seedReferenceData();
        console.log(
            `✅ Schema created and ${recorded} migration(s) recorded as baseline`
        );
    } else {
        console.log('✅ Schema created');
    }
}

prepareDatabase()
    .then(async () => {
        await sequelize.close();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('❌ Database preparation failed:', error.message);
        try {
            await sequelize.close();
        } catch (_) {}
        process.exit(1);
    });
