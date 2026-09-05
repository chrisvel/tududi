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

async function prepareDatabase() {
    const dialect = sequelize.getDialect();
    const queryInterface = sequelize.getQueryInterface();

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
