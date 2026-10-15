'use strict';

const { QueryTypes } = require('sequelize');
const { safeChangeColumn } = require('../utils/migration-utils');

// Migration 20250805000001 declared every uid column as `STRING`. SQLite gives
// a declared type it does not recognise NUMERIC affinity, so a uid that looks
// like a number was stored as an integer. The driver then hands that back as a
// JavaScript number, and anything past 2^53 loses its value: the CalDAV uid
// 4240044138289854915 was read as 4240044138289855000, so the web UI asked for
// a task id that does not exist and the row could not be opened, edited or
// completed. Declaring the column VARCHAR(255) gives it text affinity, which
// keeps new uids as text and converts the stored integers back to their exact
// value while the table is copied.
// Every table 20250805000001 rebuilt through safeChangeColumn. `tasks`,
// `projects`, `areas` and `notes` are declared STRING in the databases this
// runs against, so they carry the bug; `tags` was in the same migration and the
// same call renders its uid as STRING too, even though the databases seen so
// far already have VARCHAR(255) there. It is converted when it needs to be and
// skipped when it does not.
const TABLES = ['tasks', 'projects', 'areas', 'notes', 'tags'];

// SQLite's affinity rules, https://sqlite.org/datatype3.html#affname. Only a
// column with TEXT affinity is safe for a uid.
function affinityOf(declaredType) {
    const type = String(declaredType || '')
        .trim()
        .toUpperCase();

    if (type.includes('INT')) return 'INTEGER';
    if (
        type.includes('CHAR') ||
        type.includes('CLOB') ||
        type.includes('TEXT')
    ) {
        return 'TEXT';
    }
    if (type === '' || type.includes('BLOB')) return 'BLOB';
    if (
        type.includes('REAL') ||
        type.includes('FLOA') ||
        type.includes('DOUB')
    ) {
        return 'REAL';
    }
    return 'NUMERIC';
}

// The rebuild replaces the table, which drops its indexes, so they are captured
// and recreated. A unique index covering only uid is left out: the rebuild
// declares the column UNIQUE, and recreating the index would add the same
// constraint a second time.
async function indexesToRestore(sequelize, table) {
    const indexes = await sequelize.query(
        `SELECT name, sql FROM sqlite_master
          WHERE type = 'index' AND tbl_name = :table AND sql IS NOT NULL`,
        { replacements: { table }, type: QueryTypes.SELECT }
    );

    const restore = [];
    for (const index of indexes) {
        const quoted = `'${String(index.name).replace(/'/g, "''")}'`;
        const fields = await sequelize.query(`PRAGMA index_info(${quoted})`, {
            type: QueryTypes.SELECT,
        });
        const columns = fields.map((field) => field.name);
        if (columns.length === 1 && columns[0] === 'uid') continue;
        restore.push(index.sql);
    }

    return restore;
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Only SQLite invents affinity for a type it does not know; PostgreSQL
        // stored these uids in a real varchar from the start.
        if (queryInterface.sequelize.getDialect() !== 'sqlite') {
            return;
        }

        const { sequelize } = queryInterface;
        const present = await queryInterface.showAllTables();
        const converted = [];

        for (const table of TABLES) {
            if (!present.includes(table)) continue;

            const columns = await queryInterface.describeTable(table);
            if (!columns.uid) continue;
            if (affinityOf(columns.uid.type) === 'TEXT') continue;

            const restore = await indexesToRestore(sequelize, table);

            // A rebuild that fails part way leaves the tables it already
            // finished converted and the rest as they were. That is safe to
            // resume - the next run skips the converted ones - but the message
            // has to say which table stopped it and what state the file is in,
            // rather than reporting one shared error for all of them.
            try {
                await safeChangeColumn(queryInterface, table, 'uid', {
                    type: Sequelize.STRING,
                    allowNull: false,
                    unique: true,
                });

                for (const sql of restore) {
                    await sequelize.query(sql);
                }

                // Copies made before the column was rebuilt can still hold an
                // integer, and SQLite converts one to text exactly.
                await sequelize.query(
                    `UPDATE "${table}" SET uid = CAST(uid AS TEXT)
                      WHERE typeof(uid) <> 'text'`
                );
            } catch (error) {
                error.message =
                    `${table}.uid could not be converted to text affinity: ` +
                    `${error.message}. Converted so far: ` +
                    `${converted.length ? converted.join(', ') : 'none'}; ` +
                    `the tables listed as unconverted are unchanged. Re-running ` +
                    `the migration resumes from ${table}.`;
                throw error;
            }

            converted.push(table);
        }
    },

    async down() {
        // Restoring NUMERIC affinity would mangle these uids again, and an
        // integer that came back as text cannot be told apart from a uid a
        // client picked itself. The repaired columns stay.
    },
};
