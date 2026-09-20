const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const migration = require('../../../migrations/20260920000003-add-created-by-to-users');

const FIXTURE_DIR = path.join(__dirname, '../../fixtures/legacy');
const FIXTURES = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.sqlite3'))
    .sort();

describe('migration 20260920000003-add-created-by-to-users', () => {
    describe.each(FIXTURES)('on a copy of %s', (fixture) => {
        let dir, db, qi;

        const rows = (sql) => db.query(sql, { type: QueryTypes.SELECT });
        const run = () => migration.up(qi, Sequelize);

        beforeEach(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'created-by-'));
            const dbPath = path.join(dir, 'db.sqlite3');
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

        it('adds an optional created_by_user_id to users', async () => {
            expect(
                (await qi.describeTable('users')).created_by_user_id
            ).toBeUndefined();

            await run();

            const column = (await qi.describeTable('users')).created_by_user_id;
            expect(column).toBeDefined();
            expect(column.allowNull).toBe(true);
            expect(column.type).toMatch(/INT/i);
        });

        it('leaves every existing account without a creator', async () => {
            const before = await rows(
                'SELECT id, uid, email FROM users ORDER BY id'
            );

            await run();

            expect(
                await rows('SELECT id, uid, email FROM users ORDER BY id')
            ).toEqual(before);
            expect(
                await rows(
                    'SELECT COUNT(*) AS n FROM users WHERE created_by_user_id IS NOT NULL'
                )
            ).toEqual([{ n: 0 }]);
        });

        it('keeps the other tables and every row exactly as it was', async () => {
            const counts = async () => {
                const tables = await rows(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                );
                const out = {};
                for (const { name } of tables) {
                    const [{ n }] = await rows(
                        `SELECT COUNT(*) AS n FROM "${name}"`
                    );
                    out[name] = n;
                }
                return out;
            };
            const before = await counts();

            await run();

            expect(await counts()).toEqual(before);
            expect(await rows('PRAGMA foreign_key_check')).toEqual([]);
        });

        it('indexes the column under a name of its own', async () => {
            await run();

            const indexes = await qi.showIndex('users');
            const index = indexes.find(
                (i) => i.name === 'users_created_by_user_id'
            );
            expect(index).toBeDefined();
            expect(index.fields.map((f) => f.attribute)).toEqual([
                'created_by_user_id',
            ]);
        });

        it('keeps the indexes the table already had', async () => {
            const before = (await qi.showIndex('users'))
                .map((i) => i.name)
                .sort();

            await run();

            const after = (await qi.showIndex('users')).map((i) => i.name);
            for (const name of before) expect(after).toContain(name);
        });

        it('can be run again without changing anything', async () => {
            await run();
            const first = await qi.describeTable('users');
            const indexes = (await qi.showIndex('users'))
                .map((i) => i.name)
                .sort();

            await run();

            expect(await qi.describeTable('users')).toEqual(first);
            expect(
                (await qi.showIndex('users')).map((i) => i.name).sort()
            ).toEqual(indexes);
        });

        it('can be undone', async () => {
            await run();

            await migration.down(qi);

            expect(
                (await qi.describeTable('users')).created_by_user_id
            ).toBeUndefined();
            expect(
                (await qi.showIndex('users')).map((i) => i.name)
            ).not.toContain('users_created_by_user_id');
        });
    });
});
