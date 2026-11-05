#!/usr/bin/env node

// Run before migrations on every start. Makes sure the database is reachable
// and, when it is empty, creates the schema from the models and records every
// migration file in SequelizeMeta as already applied ("baseline"), since the
// models already describe the schema those migrations would produce.
//
// The 1.x migrations live in migrations/archive and never run. An existing
// database has to have been brought up to date by the final 1.x release
// before 2.0 can take over; otherwise this refuses to continue.

try {
    require('dotenv').config();
} catch (_) {}

const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const { sequelize, Setting } = require('../models');
const { getConfig } = require('../config/config');
const { guardAgainstLeftoverSqlite } = require('../config/legacySqlite');

const META_TABLE = 'SequelizeMeta';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');
const ARCHIVE_DIR = path.join(MIGRATIONS_DIR, 'archive');

function listMigrationFiles(dir = MIGRATIONS_DIR) {
    return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.js'))
        .sort();
}

// The newest migration shipped in 1.x. A database that has not run it was
// last started on an older release and would miss part of the schema.
function lastV1Migration() {
    const archived = listMigrationFiles(ARCHIVE_DIR);
    return archived[archived.length - 1];
}

async function assertUpgradedFromFinalV1(queryInterface) {
    const required = lastV1Migration();
    if (!required) return;

    const [rows] = (await tableExists(queryInterface, META_TABLE))
        ? await sequelize.query(
              `SELECT name FROM "${META_TABLE}" WHERE name = :name`,
              { replacements: { name: required } }
          )
        : [[]];
    if (rows.length > 0) return;

    throw new Error(
        'This database was last used by an older tududi 1.x release. ' +
            'Start the final 1.x release once so it finishes its migrations, then upgrade to 2.0. ' +
            `(SequelizeMeta is missing ${required})`
    );
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
    // The archived 1.x names are recorded too, so the upgrade check below
    // passes on every later start of this database.
    const missing = [
        ...listMigrationFiles(ARCHIVE_DIR),
        ...listMigrationFiles(),
    ].filter((file) => !applied.has(file));

    if (missing.length === 0) return 0;

    await queryInterface.bulkInsert(
        META_TABLE,
        missing.map((name) => ({ name }))
    );
    return missing.length;
}

async function seedReferenceData() {
    // Mirrors the seed rows that the 1.x migrations inserted.
    await Setting.findOrCreate({
        where: { key: 'registration_enabled' },
        defaults: { key: 'registration_enabled', value: 'false' },
    });
}

async function prepareDatabase() {
    const queryInterface = sequelize.getQueryInterface();

    guardAgainstLeftoverSqlite(getConfig().legacySqliteFiles);

    console.log('Preparing database...');
    await sequelize.authenticate();

    const fresh = !(await tableExists(queryInterface, 'users'));

    if (!fresh) {
        await assertUpgradedFromFinalV1(queryInterface);
        console.log('✅ Existing database detected, schema left to migrations');
        return;
    }

    console.log('Empty database detected, creating schema from models...');
    await sequelize.sync();

    const recorded = await recordBaseline(queryInterface);
    await seedReferenceData();
    const { ensureSearchIndexes } = require('../utils/searchIndexes');
    await ensureSearchIndexes(sequelize);
    console.log(
        `✅ Schema created and ${recorded} migration(s) recorded as baseline`
    );
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
