const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');
const migration = require('../../../migrations/20260920000002-make-user-email-nullable');

const FIXTURE_DIR = path.join(__dirname, '../../fixtures/legacy');
const FIXTURES = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.sqlite3'))
    .sort();

const isPostgres = () => sequelize.getDialect() === 'postgres';

describe('migration 20260920000002-make-user-email-nullable', () => {
    describe('SQL rewrite', () => {
        const { makeEmailNullable } = migration.helpers;

        it('only drops NOT NULL from the email column', () => {
            const sql =
                'CREATE TABLE "users" ( id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
                'uid VARCHAR(255) NOT NULL UNIQUE, ' +
                'email VARCHAR(255) NOT NULL UNIQUE, ' +
                "name VARCHAR(255) NOT NULL DEFAULT 'x' )";

            const out = makeEmailNullable(sql);

            expect(out).toContain('email VARCHAR(255) UNIQUE');
            expect(out).toContain('uid VARCHAR(255) NOT NULL UNIQUE');
            expect(out).toContain("name VARCHAR(255) NOT NULL DEFAULT 'x'");
            expect(out).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
            expect(out.startsWith('CREATE TABLE "users_new"')).toBe(true);
        });

        it.each([
            [
                'backticks',
                'CREATE TABLE `users` (`id` INTEGER PRIMARY KEY AUTOINCREMENT, `email` VARCHAR(255) NOT NULL UNIQUE)',
            ],
            [
                'no quotes',
                'CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE)',
            ],
            [
                'if not exists',
                'CREATE TABLE IF NOT EXISTS "users" (id INTEGER PRIMARY KEY, "email" TEXT not null UNIQUE)',
            ],
        ])('handles %s', (_name, sql) => {
            const out = makeEmailNullable(sql);

            expect(out).not.toMatch(/email[^,]*not\s+null/i);
            expect(out).toMatch(/users_new/);
            expect(out).toMatch(/UNIQUE/i);
        });

        it('leaves table constraints that mention email alone', () => {
            const sql =
                'CREATE TABLE "users" (id INTEGER, email TEXT NOT NULL, ' +
                "CHECK (email <> '' AND length(email) > 3), UNIQUE (email))";

            const out = makeEmailNullable(sql);

            expect(out).toContain('email TEXT,');
            expect(out).toContain("CHECK (email <> '' AND length(email) > 3)");
            expect(out).toContain('UNIQUE (email)');
        });

        it('refuses a table it does not understand', () => {
            expect(() =>
                makeEmailNullable(
                    'CREATE TABLE "users" (id INTEGER, name TEXT)'
                )
            ).toThrow(/email column/);
        });
    });

    describe('PostgreSQL and the model schema', () => {
        it('leaves the email column nullable', async () => {
            if (isPostgres()) {
                await sequelize.query(
                    'ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL'
                );
            }

            await migration.up(sequelize.getQueryInterface(), Sequelize);

            const info = await sequelize
                .getQueryInterface()
                .describeTable('users');
            expect(info.email.allowNull).toBe(true);
        });

        it('can be run again without changing anything', async () => {
            await migration.up(sequelize.getQueryInterface(), Sequelize);
            await migration.up(sequelize.getQueryInterface(), Sequelize);

            const info = await sequelize
                .getQueryInterface()
                .describeTable('users');
            expect(info.email.allowNull).toBe(true);
        });
    });

    // The SQLite rebuild runs against copies of real databases from earlier
    // releases, so what it has to preserve is checked on real data.
    const sqliteOnly = isPostgres() ? describe.skip : describe;

    sqliteOnly.each(FIXTURES)('SQLite rebuild of %s', (fixture) => {
        let dir, dbPath, db, qi;

        const rows = (sql, replacements) =>
            db.query(sql, { type: QueryTypes.SELECT, replacements });

        const tableNames = async () =>
            (
                await rows(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                )
            ).map((r) => r.name);

        const allData = async () => {
            const out = {};
            for (const name of await tableNames()) {
                out[name] = await rows(
                    `SELECT * FROM "${name}" ORDER BY rowid`
                );
            }
            return out;
        };

        const rejectionOf = async (promise) => {
            try {
                await promise;
            } catch (error) {
                return (
                    (error.original && error.original.message) || error.message
                );
            }
            throw new Error('Expected the statement to be rejected');
        };

        const run = () => migration.up(qi, Sequelize);

        beforeEach(async () => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'email-null-'));
            dbPath = path.join(dir, 'db.sqlite3');
            fs.copyFileSync(path.join(FIXTURE_DIR, fixture), dbPath);
            db = new Sequelize({
                dialect: 'sqlite',
                storage: dbPath,
                logging: false,
            });
            qi = db.getQueryInterface();
        });

        afterEach(async () => {
            await db.close();
            fs.rmSync(dir, { recursive: true, force: true });
        });

        it('starts with a required email', async () => {
            expect((await qi.describeTable('users')).email.allowNull).toBe(
                false
            );
        });

        it('makes the email optional', async () => {
            await run();

            expect((await qi.describeTable('users')).email.allowNull).toBe(
                true
            );
        });

        it('keeps every row of every table exactly as it was', async () => {
            const before = await allData();

            await run();

            expect(await allData()).toEqual(before);
        });

        it('keeps every column, type and default of users', async () => {
            const before = await qi.describeTable('users');

            await run();

            const after = await qi.describeTable('users');
            expect(Object.keys(after)).toEqual(Object.keys(before));
            for (const [name, column] of Object.entries(before)) {
                const expected = { ...column };
                if (name === 'email') expected.allowNull = true;
                expect(after[name]).toEqual(expected);
            }
        });

        it('keeps emails unique but allows any number of missing ones', async () => {
            await run();
            const insert = (email, uid) =>
                db.query(
                    `INSERT INTO users (uid, email, created_at, updated_at)
                     VALUES (:uid, :email, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    { replacements: { uid, email } }
                );

            await insert(null, 'no-email-1');
            await insert(null, 'no-email-2');
            await insert('same@example.com', 'has-email-1');

            expect(
                await rejectionOf(insert('same@example.com', 'has-email-2'))
            ).toMatch(/UNIQUE/i);
            const [{ n }] = await rows(
                'SELECT COUNT(*) AS n FROM users WHERE email IS NULL'
            );
            expect(n).toBe(2);
        });

        it('keeps the uid unique and the other required columns required', async () => {
            await run();

            expect(
                await rejectionOf(
                    db.query(
                        `INSERT INTO users (uid, created_at, updated_at) VALUES (NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
                    )
                )
            ).toMatch(/NOT NULL/i);
        });

        it('keeps every foreign key that points at users working', async () => {
            const children = await rows(
                `SELECT m.name AS child, f."from" AS col
                 FROM sqlite_master m, pragma_foreign_key_list(m.name) f
                 WHERE m.type = 'table' AND f."table" = 'users'
                 ORDER BY m.name, f."from"`
            );
            expect(children.length).toBeGreaterThan(10);

            await run();

            expect(
                await rows(
                    `SELECT m.name AS child, f."from" AS col
                     FROM sqlite_master m, pragma_foreign_key_list(m.name) f
                     WHERE m.type = 'table' AND f."table" = 'users'
                     ORDER BY m.name, f."from"`
                )
            ).toEqual(children);
            expect(await rows('PRAGMA foreign_key_check')).toEqual([]);
            expect(await rows('PRAGMA integrity_check')).toEqual([
                { integrity_check: 'ok' },
            ]);
        });

        it('still enforces those foreign keys', async () => {
            await run();
            await db.query('PRAGMA foreign_keys = ON');

            expect(
                await rejectionOf(
                    db.query(
                        `INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, created_at, updated_at)
                         VALUES (999999, 'x', 'x', 'x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
                    )
                )
            ).toMatch(/FOREIGN KEY/i);
        });

        it('leaves foreign key checking on afterwards', async () => {
            await run();

            expect(await rows('PRAGMA foreign_keys')).toEqual([
                { foreign_keys: 1 },
            ]);
        });

        it('does not reuse the ids of deleted accounts', async () => {
            const [{ seq }] = await rows(
                "SELECT seq FROM sqlite_sequence WHERE name = 'users'"
            );
            await db.query(
                `INSERT INTO users (uid, email, created_at, updated_at)
                 VALUES ('temp-uid', 'temp@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
            );
            await db.query("DELETE FROM users WHERE uid = 'temp-uid'");
            const [{ seq: highest }] = await rows(
                "SELECT seq FROM sqlite_sequence WHERE name = 'users'"
            );
            expect(highest).toBe(seq + 1);

            await run();

            await db.query(
                `INSERT INTO users (uid, email, created_at, updated_at)
                 VALUES ('next-uid', 'next@example.com', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
            );
            const [{ id }] = await rows(
                "SELECT id FROM users WHERE uid = 'next-uid'"
            );
            expect(id).toBeGreaterThan(highest);
        });

        it('leaves no temporary table behind', async () => {
            await run();

            expect(await tableNames()).not.toContain('users_new');
        });

        it('takes a snapshot of the database first', async () => {
            const [{ n }] = await rows('SELECT COUNT(*) AS n FROM users');

            await run();

            const snapshot = path.join(
                dir,
                'db-premigrate-20260920000002-make-user-email-nullable.sqlite3'
            );
            expect(fs.existsSync(snapshot)).toBe(true);
            const copy = new Sequelize({
                dialect: 'sqlite',
                storage: snapshot,
                logging: false,
            });
            try {
                const [{ c }] = await copy.query(
                    'SELECT COUNT(*) AS c FROM users',
                    { type: QueryTypes.SELECT }
                );
                expect(c).toBe(n);
                const info = await copy
                    .getQueryInterface()
                    .describeTable('users');
                expect(info.email.allowNull).toBe(false);
            } finally {
                await copy.close();
            }
        });

        it('does nothing the second time', async () => {
            await run();
            const after = await allData();
            const snapshot = path.join(
                dir,
                'db-premigrate-20260920000002-make-user-email-nullable.sqlite3'
            );
            fs.rmSync(snapshot);

            await run();

            expect(await allData()).toEqual(after);
            expect(fs.existsSync(snapshot)).toBe(false);
        });

        it('does not fail on foreign key problems that were already there', async () => {
            await db.query('PRAGMA foreign_keys = OFF');
            await db.query(
                `INSERT INTO api_tokens (user_id, name, token_hash, token_prefix, created_at, updated_at)
                 VALUES (999999, 'orphan', 'x', 'x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
            );
            await db.query('PRAGMA foreign_keys = ON');
            const before = await rows('PRAGMA foreign_key_check');
            expect(before.length).toBe(1);

            await run();

            expect((await qi.describeTable('users')).email.allowNull).toBe(
                true
            );
            expect(await rows('PRAGMA foreign_key_check')).toEqual(before);
        });

        it('changes nothing when a step fails part way', async () => {
            const beforeData = await allData();
            const beforeSchema = await qi.describeTable('users');
            const failing = new Proxy(qi, {
                get(target, prop) {
                    if (prop === 'sequelize') {
                        return new Proxy(target.sequelize, {
                            get(inner, key) {
                                if (key === 'query') {
                                    return (sql, options) =>
                                        /^\s*DROP TABLE\s+["`]?users["`]?\s*;?\s*$/i.test(
                                            sql
                                        )
                                            ? Promise.reject(new Error('boom'))
                                            : inner.query(sql, options);
                                }
                                const value = inner[key];
                                return typeof value === 'function'
                                    ? value.bind(inner)
                                    : value;
                            },
                        });
                    }
                    const value = target[prop];
                    return typeof value === 'function'
                        ? value.bind(target)
                        : value;
                },
            });

            await expect(migration.up(failing, Sequelize)).rejects.toThrow(
                'boom'
            );

            expect(await qi.describeTable('users')).toEqual(beforeSchema);
            expect(await allData()).toEqual(beforeData);
            expect(await tableNames()).not.toContain('users_new');
            expect(await rows('PRAGMA foreign_keys')).toEqual([
                { foreign_keys: 1 },
            ]);

            await run();
            expect((await qi.describeTable('users')).email.allowNull).toBe(
                true
            );
        });
    });
});
