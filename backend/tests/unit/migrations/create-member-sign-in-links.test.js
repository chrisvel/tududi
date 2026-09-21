const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { sequelize } = require('../../../models');
const migration = require('../../../migrations/20260921000002-create-member-sign-in-links');

const FIXTURE_DIR = path.join(__dirname, '../../fixtures/legacy');
const FIXTURES = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.sqlite3'))
    .sort();

const INDEXES = [
    'member_sign_in_links_user_id',
    'member_sign_in_links_created_by_user_id',
];

describe('migration 20260921000002-create-member-sign-in-links', () => {
    // The database the tests run on, SQLite or PostgreSQL.
    describe('on the test database', () => {
        const qi = () => sequelize.getQueryInterface();
        const hasTable = async () =>
            (await qi().showAllTables())
                .map((t) => (typeof t === 'string' ? t : t.tableName))
                .includes('member_sign_in_links');

        afterAll(async () => {
            await migration.up(qi(), Sequelize);
            await sequelize.close();
        });

        it('starts from the model, which already has the table', async () => {
            await migration.up(qi(), Sequelize);

            expect(await hasTable()).toBe(true);
        });

        it('creates the table and its indexes after it was removed', async () => {
            await migration.down(qi());
            expect(await hasTable()).toBe(false);

            await migration.up(qi(), Sequelize);

            expect(await hasTable()).toBe(true);
            const names = (await qi().showIndex('member_sign_in_links')).map(
                (i) => i.name
            );
            for (const name of INDEXES) expect(names).toContain(name);
        });

        it('allows one link per member', async () => {
            await migration.up(qi(), Sequelize);

            const index = (await qi().showIndex('member_sign_in_links')).find(
                (i) => i.name === 'member_sign_in_links_user_id'
            );

            expect(index.unique).toBe(true);
        });

        it('has the columns the model uses', async () => {
            await migration.up(qi(), Sequelize);

            const columns = await qi().describeTable('member_sign_in_links');

            expect(Object.keys(columns).sort()).toEqual(
                [
                    'created_at',
                    'created_by_user_id',
                    'expires_at',
                    'id',
                    'token_hash',
                    'uid',
                    'updated_at',
                    'used_at',
                    'user_id',
                ].sort()
            );
            expect(columns.token_hash.allowNull).toBe(false);
            expect(columns.used_at.allowNull).toBe(true);
            expect(columns.created_by_user_id.allowNull).toBe(true);
        });

        it('does nothing when the table is already there', async () => {
            await migration.up(qi(), Sequelize);
            const before = await qi().describeTable('member_sign_in_links');

            await migration.up(qi(), Sequelize);

            expect(await qi().describeTable('member_sign_in_links')).toEqual(
                before
            );
        });
    });

    describe.each(FIXTURES)('on a copy of %s', (fixture) => {
        let dir, db, qi;

        const rows = (sql) => db.query(sql, { type: QueryTypes.SELECT });
        const run = () => migration.up(qi, Sequelize);
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

        beforeEach(() => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sign-in-links-'));
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

        it('adds the table and only the table', async () => {
            const before = await counts();
            expect(before.member_sign_in_links).toBeUndefined();

            await run();

            const after = await counts();
            expect(after.member_sign_in_links).toBe(0);
            delete after.member_sign_in_links;
            expect(after).toEqual(before);
            expect(await rows('PRAGMA foreign_key_check')).toEqual([]);
        });

        it('allows one link per member', async () => {
            await run();

            const index = (
                await rows('PRAGMA index_list(member_sign_in_links)')
            ).find((i) => i.name === 'member_sign_in_links_user_id');

            expect(index.unique).toBe(1);
        });

        it('indexes it by name', async () => {
            await run();

            const names = (await qi.showIndex('member_sign_in_links')).map(
                (i) => i.name
            );
            for (const name of INDEXES) expect(names).toContain(name);
        });

        it('points at users: links go with the member, and the creator can go', async () => {
            await run();

            const keys = await rows(
                'PRAGMA foreign_key_list(member_sign_in_links)'
            );
            const rule = (column) =>
                keys.find((k) => k.from === column && k.table === 'users')
                    .on_delete;

            expect(rule('user_id')).toBe('CASCADE');
            expect(rule('created_by_user_id')).toBe('SET NULL');
        });

        it('can be run again without changing anything', async () => {
            await run();
            const first = await qi.describeTable('member_sign_in_links');

            await run();

            expect(await qi.describeTable('member_sign_in_links')).toEqual(
                first
            );
        });

        it('can be undone', async () => {
            const before = await counts();
            await run();

            await migration.down(qi);

            expect(await counts()).toEqual(before);
        });
    });
});
