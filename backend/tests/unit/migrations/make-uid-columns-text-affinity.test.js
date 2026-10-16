// Migration 20250805000001 declared every uid column as `STRING`. SQLite does
// not recognise that type, so the column got NUMERIC affinity and a numeric uid
// was stored as an integer. The row these tests build is the one that came out
// of a CalDAV client uploading a value above 2^53: the web UI could list it but
// never open, edit or complete it, because every request asked for a uid the
// database does not contain.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const migration = require('../../../migrations/20261013000001-make-uid-columns-text-affinity');

// The uid a client uploaded, and what reading it as a JavaScript number gives.
const NUMERIC_UID = '4240044138289854915';
const MANGLED_UID = '4240044138289855000';

async function one(sequelize, sql, replacements) {
    const rows = await sequelize.query(sql, {
        replacements,
        type: QueryTypes.SELECT,
    });
    return rows[0];
}

describe('migration 20261013000001-make-uid-columns-text-affinity', () => {
    let dir;
    let sequelize;
    let queryInterface;

    beforeAll(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-uid-affinity-'));
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: path.join(dir, 'legacy.sqlite3'),
            logging: false,
        });
        queryInterface = sequelize.getQueryInterface();

        // The shape the uid migration left behind: `uid STRING NOT NULL UNIQUE`
        // plus the indexes a real tasks table carries.
        await sequelize.query(
            `CREATE TABLE "tasks" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "uid" STRING NOT NULL UNIQUE,
                "name" TEXT,
                "updated_at" DATETIME
            )`
        );
        await sequelize.query(
            'CREATE INDEX "idx_tasks_updated_at" ON "tasks" ("updated_at")'
        );
    });

    afterAll(async () => {
        await sequelize.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('stores a numeric uid as an integer before the fix', async () => {
        await sequelize.query(
            "INSERT INTO tasks (uid, name) VALUES (:uid, 'ghost')",
            { replacements: { uid: NUMERIC_UID } }
        );

        const stored = await one(
            sequelize,
            'SELECT typeof(uid) AS storage, uid FROM tasks'
        );

        // The application passed a string; the column turned it into a number.
        expect(stored.storage).toBe('integer');
        expect(stored.uid).not.toBe(NUMERIC_UID);
        expect(String(stored.uid)).toBe(MANGLED_UID);
    });

    it('repairs the stored uid and gives the column text affinity', async () => {
        await migration.up(queryInterface, Sequelize);

        const stored = await one(
            sequelize,
            'SELECT typeof(uid) AS storage, uid FROM tasks'
        );
        expect(stored.storage).toBe('text');
        expect(stored.uid).toBe(NUMERIC_UID);

        const columns = await queryInterface.describeTable('tasks');
        expect(columns.uid.type).toBe('VARCHAR(255)');
    });

    it('keeps a numeric uid a client sends later as text', async () => {
        const laterUid = '9007199254740993';

        await sequelize.query(
            "INSERT INTO tasks (uid, name) VALUES (:uid, 'later')",
            { replacements: { uid: laterUid } }
        );

        const stored = await one(
            sequelize,
            'SELECT typeof(uid) AS storage, uid FROM tasks WHERE name = :name',
            { name: 'later' }
        );
        expect(stored.storage).toBe('text');
        expect(stored.uid).toBe(laterUid);
    });

    it('restores the indexes the rebuild drops and keeps uid unique', async () => {
        const indexes = await sequelize.query(
            `SELECT name FROM sqlite_master
              WHERE type = 'index' AND tbl_name = 'tasks' AND sql IS NOT NULL`,
            { type: QueryTypes.SELECT }
        );
        expect(indexes.map((index) => index.name)).toContain(
            'idx_tasks_updated_at'
        );

        await expect(
            sequelize.query(
                "INSERT INTO tasks (uid, name) VALUES (:uid, 'duplicate')",
                { replacements: { uid: NUMERIC_UID } }
            )
        ).rejects.toThrow();
    });

    it('is a no-op when the column already has text affinity', async () => {
        await migration.up(queryInterface, Sequelize);
        await migration.up(queryInterface, Sequelize);

        const stored = await one(
            sequelize,
            'SELECT typeof(uid) AS storage, uid FROM tasks WHERE name = :name',
            { name: 'later' }
        );
        expect(stored.storage).toBe('text');
        expect(stored.uid).toBe('9007199254740993');
    });

    // 20250805000001 rebuilt `tags` through the same safeChangeColumn call as
    // the other four tables, so it can carry the same STRING declaration. The
    // databases that have been inspected happen to hold VARCHAR(255) there
    // already, but the migration has to convert it when it does not.
    it('converts tags when its uid is declared STRING', async () => {
        await sequelize.query(
            `CREATE TABLE "tags" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "uid" STRING NOT NULL UNIQUE,
                "name" VARCHAR(255) NOT NULL
            )`
        );
        await sequelize.query(
            'CREATE UNIQUE INDEX "tags_user_id_name_unique" ON "tags" ("name")'
        );
        await sequelize.query(
            "INSERT INTO tags (uid, name) VALUES (:uid, 'inbox')",
            { replacements: { uid: NUMERIC_UID } }
        );

        const before = await one(
            sequelize,
            'SELECT typeof(uid) AS storage FROM tags'
        );
        expect(before.storage).toBe('integer');

        await migration.up(queryInterface, Sequelize);

        const after = await one(
            sequelize,
            'SELECT typeof(uid) AS storage, uid FROM tags'
        );
        expect(after.storage).toBe('text');
        expect(after.uid).toBe(NUMERIC_UID);

        const columns = await queryInterface.describeTable('tags');
        expect(columns.uid.type).toBe('VARCHAR(255)');

        const indexes = await sequelize.query(
            `SELECT name FROM sqlite_master
              WHERE type = 'index' AND tbl_name = 'tags' AND sql IS NOT NULL`,
            { type: QueryTypes.SELECT }
        );
        expect(indexes.map((index) => index.name)).toContain(
            'tags_user_id_name_unique'
        );
    });
});

// A rebuild that stops part way leaves the file in a state that is safe to
// resume from, so the failure has to say which table stopped it and which ones
// were already converted. The tables are built in the order the migration walks
// them, with the failure landing on the last one.
describe('migration 20261013000001 part-way through', () => {
    let dir;
    let sequelize;
    let queryInterface;
    let failing;

    beforeAll(async () => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tududi-uid-partial-'));
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: path.join(dir, 'legacy.sqlite3'),
            logging: false,
        });
        queryInterface = sequelize.getQueryInterface();

        for (const table of ['tasks', 'tags']) {
            await sequelize.query(
                `CREATE TABLE "${table}" (
                    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                    "uid" STRING NOT NULL UNIQUE,
                    "name" TEXT
                )`
            );
        }

        // Refuse the rebuild of `tags` with a proxy rather than a stub, so the
        // query interface keeps every other method it has.
        const refusing = new Proxy(queryInterface.sequelize, {
            get(target, property, receiver) {
                if (property === 'query') {
                    return (sql, options) => {
                        if (/CREATE TABLE tags_new/.test(String(sql))) {
                            throw new Error('disk I/O error');
                        }
                        return target.query(sql, options);
                    };
                }
                return Reflect.get(target, property, receiver);
            },
        });
        failing = new Proxy(queryInterface, {
            get(target, property, receiver) {
                if (property === 'sequelize') return refusing;
                return Reflect.get(target, property, receiver);
            },
        });
    });

    afterAll(async () => {
        await sequelize.close();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('names the table that failed and the ones already converted', async () => {
        let error = null;
        await migration.up(failing, Sequelize).catch((thrown) => {
            error = thrown;
        });

        expect(error).toBeInstanceOf(Error);
        expect(error.message).toMatch(
            /tags\.uid could not be converted to text affinity/
        );
        // `tasks` came before `tags` in the walk and was rebuilt.
        expect(error.message).toMatch(/Converted so far: tasks/);
        expect(error.message).toMatch(
            /Re-running the migration resumes from tags/
        );
    });

    it('leaves the converted table repaired and the failed one untouched', async () => {
        const tasks = await queryInterface.describeTable('tasks');
        expect(tasks.uid.type).toBe('VARCHAR(255)');

        const tags = await queryInterface.describeTable('tags');
        expect(tags.uid.type).toBe('STRING');
    });

    it('finishes the remaining table on the next run', async () => {
        await migration.up(queryInterface, Sequelize);

        const tags = await queryInterface.describeTable('tags');
        expect(tags.uid.type).toBe('VARCHAR(255)');
    });
});
