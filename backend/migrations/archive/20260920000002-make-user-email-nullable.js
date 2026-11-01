'use strict';

const fs = require('fs');
const path = require('path');

const NAME = '20260920000002-make-user-email-nullable';
const TEMP_TABLE = 'users_new';

// SQLite cannot drop NOT NULL from a column, so the users table is rebuilt the
// way the SQLite documentation describes for changes ALTER TABLE cannot make:
// build the new table, copy the rows, drop the old one, rename the new one.
//
// The new table is created from the definition already stored in the
// database with only the NOT NULL on email removed. Nothing is written out by
// hand, so every column, default, unique constraint and the autoincrement id
// survive whatever the table looked like in an earlier release. An earlier
// rebuild that hard-coded the columns lost data on installs that had extra
// ones.
//
// The rebuild runs in a single transaction on the default connection with
// foreign keys switched off (the switch has no effect inside a transaction, and
// Sequelize gives a transaction option its own connection). If any step fails,
// or the copy or the foreign key check does not add up, everything rolls back
// and the table is untouched.

const query = (queryInterface, sql, options) =>
    queryInterface.sequelize.query(sql, options);

const select = (queryInterface, sql) =>
    query(queryInterface, sql, { type: 'SELECT' });

const quote = (name) => `"${String(name).replace(/"/g, '""')}"`;

// Splits a column list on the commas that are not inside parentheses or quotes.
function splitTopLevel(body) {
    const parts = [];
    let depth = 0;
    let quoteChar = null;
    let current = '';
    for (const ch of body) {
        if (quoteChar) {
            current += ch;
            if (ch === quoteChar) quoteChar = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            quoteChar = ch;
            current += ch;
        } else if (ch === '(') {
            depth += 1;
            current += ch;
        } else if (ch === ')') {
            depth -= 1;
            current += ch;
        } else if (ch === ',' && depth === 0) {
            parts.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    parts.push(current);
    return parts;
}

function makeEmailNullable(createSql) {
    const open = createSql.indexOf('(');
    const close = createSql.lastIndexOf(')');
    if (open < 0 || close < open) {
        throw new Error('Cannot read the users table definition');
    }

    const head = createSql
        .slice(0, open)
        .replace(
            /^(\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?)(["`[]?)users(["`\]]?)/i,
            `$1$2${TEMP_TABLE}$3`
        );
    const parts = splitTopLevel(createSql.slice(open + 1, close));
    const tail = createSql.slice(close);

    const index = parts.findIndex((part) =>
        /^\s*["`[]?email["`\]]?\s/i.test(part)
    );
    if (index < 0) {
        throw new Error('Cannot find the email column in the users table');
    }
    parts[index] = parts[index].replace(/\s+NOT\s+NULL/i, '');

    return `${head}(${parts.join(',')}${tail}`;
}

const emailIsRequired = async (queryInterface) => {
    const info = await queryInterface.describeTable('users');
    return Boolean(info.email) && info.email.allowNull === false;
};

// A copy of the database next to it, outside the rotation of automatic
// backups, which a failing container that keeps restarting can wear away.
async function takeSnapshot(queryInterface) {
    const storage = queryInterface.sequelize.options.storage;
    if (!storage || storage === ':memory:') return;

    const snapshot = path.join(
        path.dirname(storage),
        `db-premigrate-${NAME}.sqlite3`
    );
    if (fs.existsSync(snapshot)) return;

    await query(
        queryInterface,
        `VACUUM INTO '${snapshot.replace(/'/g, "''")}'`
    );
}

async function rebuildSqlite(queryInterface) {
    const [table] = await select(
        queryInterface,
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    );
    const dependents = await select(
        queryInterface,
        `SELECT type, name, sql FROM sqlite_master
         WHERE tbl_name = 'users' AND type IN ('index', 'trigger') AND sql IS NOT NULL`
    );
    const columns = (
        await select(queryInterface, 'PRAGMA table_info(users)')
    ).map((column) => quote(column.name));
    const [{ count: expectedRows }] = await select(
        queryInterface,
        'SELECT COUNT(*) AS count FROM users'
    );
    const [sequence] = await select(
        queryInterface,
        "SELECT seq FROM sqlite_sequence WHERE name = 'users'"
    );
    const [{ foreign_keys: foreignKeysWereOn }] = await select(
        queryInterface,
        'PRAGMA foreign_keys'
    );
    const problemsBefore = (
        await select(queryInterface, 'PRAGMA foreign_key_check')
    ).length;

    await takeSnapshot(queryInterface);

    const newSql = makeEmailNullable(table.sql);
    const columnList = columns.join(', ');

    await query(queryInterface, 'PRAGMA foreign_keys = OFF');
    try {
        await query(queryInterface, 'BEGIN IMMEDIATE');
        try {
            await query(queryInterface, `DROP TABLE IF EXISTS ${TEMP_TABLE}`);
            await query(queryInterface, newSql);
            await query(
                queryInterface,
                `INSERT INTO ${TEMP_TABLE} (${columnList}) SELECT ${columnList} FROM users`
            );

            const [{ count: copiedRows }] = await select(
                queryInterface,
                `SELECT COUNT(*) AS count FROM ${TEMP_TABLE}`
            );
            if (copiedRows !== expectedRows) {
                throw new Error(
                    `Copied ${copiedRows} of ${expectedRows} users, leaving the table as it was`
                );
            }

            await query(queryInterface, 'DROP TABLE users');
            await query(
                queryInterface,
                `ALTER TABLE ${TEMP_TABLE} RENAME TO users`
            );

            for (const item of dependents) {
                await query(queryInterface, item.sql);
            }
            // The copy restarts the id counter at the highest id in use.
            // Keeping the old counter stops the id of a deleted account from
            // being handed to a new one.
            if (sequence) {
                await query(
                    queryInterface,
                    "UPDATE sqlite_sequence SET seq = :seq WHERE name = 'users' AND seq < :seq",
                    { replacements: { seq: sequence.seq } }
                );
            }

            const problemsAfter = (
                await select(queryInterface, 'PRAGMA foreign_key_check')
            ).length;
            if (problemsAfter > problemsBefore) {
                throw new Error(
                    `Rebuilding users broke ${problemsAfter - problemsBefore} foreign key(s), leaving the table as it was`
                );
            }
            if (await emailIsRequired(queryInterface)) {
                throw new Error(
                    'The rebuilt users table still requires an email, leaving the table as it was'
                );
            }

            await query(queryInterface, 'COMMIT');
        } catch (error) {
            await query(queryInterface, 'ROLLBACK').catch(() => {});
            throw error;
        }
    } finally {
        if (foreignKeysWereOn) {
            await query(queryInterface, 'PRAGMA foreign_keys = ON');
        }
    }
}

module.exports = {
    async up(queryInterface) {
        if (!(await emailIsRequired(queryInterface))) return;

        if (queryInterface.sequelize.getDialect() === 'postgres') {
            await query(
                queryInterface,
                'ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL'
            );
            return;
        }

        await rebuildSqlite(queryInterface);
    },

    // Not reversible: once an account without an email exists the column
    // cannot be required again without losing it.
    async down() {},

    helpers: { makeEmailNullable },
};
