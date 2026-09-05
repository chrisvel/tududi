#!/usr/bin/env node

// Prints a dialect-neutral JSON description of the connected database schema
// (tables, columns, indexes) to stdout. Used by the schema parity tests to
// compare a synced schema, a migrated SQLite file and a PostgreSQL database.
//
// Usage: DB_FILE=/path.sqlite3 node scripts/schema-snapshot.js
//        DATABASE_URL=postgres://... node scripts/schema-snapshot.js

try {
    require('dotenv').config();
} catch (_) {
    // dotenv is optional
}

const { Sequelize } = require('sequelize');
const { buildSequelizeOptions } = require('../config/db');

const IGNORED_TABLES = new Set([
    'SequelizeMeta',
    'Sessions',
    'sqlite_sequence',
]);

function normaliseType(rawType) {
    const type = String(rawType || '')
        .trim()
        .toUpperCase();
    const lengthMatch = type.match(/\((\d+)\)/);
    const length = lengthMatch ? Number(lengthMatch[1]) : null;

    if (/^(TINYINT\(1\)|BOOLEAN|BOOL)$/.test(type))
        return { bucket: 'boolean' };
    if (/^(INTEGER|INT|BIGINT|SMALLINT|SERIAL|BIGSERIAL)/.test(type))
        return { bucket: 'integer' };
    if (/^(FLOAT|REAL|DOUBLE|DOUBLE PRECISION|DECIMAL|NUMERIC)/.test(type))
        return { bucket: 'number' };
    if (/^(DATETIME|TIMESTAMP)/.test(type)) return { bucket: 'datetime' };
    if (type === 'DATE') return { bucket: 'date' };
    if (/^(JSON|JSONB)$/.test(type)) return { bucket: 'json' };
    if (
        /^(VARCHAR|CHARACTER VARYING|TEXT|LONGTEXT|MEDIUMTEXT|STRING|CHAR|CLOB)/.test(
            type
        )
    )
        return { bucket: 'string', length };
    if (/^(ENUM|USER-DEFINED)/.test(type)) return { bucket: 'enum' };
    return { bucket: `other:${type}` };
}

function sortObject(obj) {
    return Object.fromEntries(
        Object.keys(obj)
            .sort()
            .map((key) => [key, obj[key]])
    );
}

async function main() {
    const sequelize = new Sequelize(buildSequelizeOptions({ logging: false }));
    const queryInterface = sequelize.getQueryInterface();
    const dialect = sequelize.getDialect();

    await sequelize.authenticate();

    const tableNames = (await queryInterface.showAllTables())
        .map((entry) =>
            typeof entry === 'string' ? entry : entry.tableName || entry.name
        )
        .filter((name) => !IGNORED_TABLES.has(name) && !/_backup$/.test(name))
        .sort();

    const tables = {};
    for (const table of tableNames) {
        const described = await queryInterface.describeTable(table);
        const columns = {};
        for (const [name, column] of Object.entries(described)) {
            const type = normaliseType(column.type);
            const enumValues =
                Array.isArray(column.special) && column.special.length > 0
                    ? [...column.special].sort()
                    : null;
            columns[name] = {
                type: type.bucket,
                length: type.length === undefined ? null : type.length,
                allowNull: column.allowNull !== false,
                primaryKey: !!column.primaryKey,
                hasDefault:
                    column.defaultValue !== null &&
                    column.defaultValue !== undefined,
                enumValues,
            };
        }

        let indexes = [];
        try {
            const raw = await queryInterface.showIndex(table);
            // Primary keys are kept and reported as unique so a composite
            // primary key (junction tables) compares equal to the unique
            // autoindex SQLite reports for the same columns.
            indexes = raw
                .map((index) => ({
                    fields: (index.fields || [])
                        .map((field) =>
                            typeof field === 'string'
                                ? field
                                : field.attribute || field.name
                        )
                        .sort(),
                    unique: !!index.unique || !!index.primary,
                }))
                .filter((index) => index.fields.length > 0)
                .sort((a, b) =>
                    `${a.unique}:${a.fields.join(',')}`.localeCompare(
                        `${b.unique}:${b.fields.join(',')}`
                    )
                );
        } catch (_) {
            indexes = [];
        }

        tables[table] = { columns: sortObject(columns), indexes };
    }

    await sequelize.close();
    // Single line so callers can ignore whatever config/config.js logged
    // above it and parse the last line of stdout.
    process.stdout.write(JSON.stringify({ dialect, tables }) + '\n');
}

main().catch((error) => {
    console.error('schema-snapshot failed:', error.message);
    process.exit(1);
});
