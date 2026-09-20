const fs = require('fs');
const os = require('os');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const { sequelize, User, Role, Person } = require('../../../models');
const addCreatedBy = require('../../../migrations/20260920000003-add-created-by-to-users');
const migration = require('../../../migrations/20260921000001-backfill-created-by-from-contact-links');

const FIXTURE_DIR = path.join(__dirname, '../../fixtures/legacy');
const FIXTURES = fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.sqlite3'))
    .sort();

describe('migration 20260921000001-backfill-created-by-from-contact-links', () => {
    describe('on the test database', () => {
        const qi = () => sequelize.getQueryInterface();
        const run = () => migration.up(qi(), Sequelize);

        let admin, other, kid;

        // Accounts are made one after the other: the first one is the admin.
        const makeUser = (email, extra = {}) =>
            User.create({ email, name: email.split('@')[0], ...extra });

        const creatorOf = async (user) =>
            (await User.findByPk(user.id)).created_by_user_id;

        const link = (owner, account, extra = {}) =>
            Person.create({
                user_id: owner.id,
                name: `Card of ${account.email}`,
                linked_user_id: account.id,
                ...extra,
            });

        beforeEach(async () => {
            admin = await makeUser('admin@example.com');
            other = await makeUser('other@example.com');
            kid = await makeUser('kid@example.com');
        });

        afterAll(async () => {
            await sequelize.close();
        });

        it('records the admin who owns a contact card linked to the account', async () => {
            await link(admin, kid);

            await run();

            expect(await creatorOf(kid)).toBe(admin.id);
        });

        it('leaves an account that already has a creator alone', async () => {
            await User.update(
                { created_by_user_id: other.id },
                { where: { id: kid.id } }
            );
            await link(admin, kid);

            await run();

            expect(await creatorOf(kid)).toBe(other.id);
        });

        it('ignores a card owned by an ordinary user', async () => {
            await link(other, kid);

            await run();

            expect(await creatorOf(kid)).toBeNull();
        });

        it("ignores the account's own self card", async () => {
            await Role.update(
                { role: 'admin', is_admin: true },
                {
                    where: { user_id: kid.id },
                }
            );
            await Person.destroy({ where: { user_id: kid.id } });
            await link(kid, kid);

            await run();

            expect(await creatorOf(kid)).toBeNull();
        });

        it('skips an admin who has since been demoted', async () => {
            await Role.update(
                { role: 'admin', is_admin: true },
                { where: { user_id: other.id } }
            );
            await link(other, kid);
            await Role.update(
                { role: 'user', is_admin: false },
                { where: { user_id: other.id } }
            );

            await run();

            expect(await creatorOf(kid)).toBeNull();
        });

        it('takes the oldest card when two admins have one', async () => {
            await Role.update(
                { role: 'admin', is_admin: true },
                { where: { user_id: other.id } }
            );
            await link(other, kid);
            await link(admin, kid);

            await run();

            expect(await creatorOf(kid)).toBe(other.id);
        });

        it('leaves an account with no card without a creator', async () => {
            await run();

            expect(await creatorOf(kid)).toBeNull();
            expect(await creatorOf(other)).toBeNull();
            expect(await creatorOf(admin)).toBeNull();
        });

        it('can be run again without changing anything', async () => {
            await link(admin, kid);
            await run();
            const first = await User.findAll({
                order: [['id', 'ASC']],
                raw: true,
            });

            await run();

            expect(
                await User.findAll({ order: [['id', 'ASC']], raw: true })
            ).toEqual(first);
        });

        it('leaves the contact cards as they were', async () => {
            await link(admin, kid);
            const before = await Person.findAll({
                order: [['id', 'ASC']],
                raw: true,
            });

            await run();

            expect(
                await Person.findAll({ order: [['id', 'ASC']], raw: true })
            ).toEqual(before);
        });

        it('has nothing to undo', async () => {
            await link(admin, kid);
            await run();

            await migration.down(qi());

            expect(await creatorOf(kid)).toBe(admin.id);
        });
    });

    describe.each(FIXTURES)('on a copy of %s', (fixture) => {
        let dir, db, qi;

        const rows = (sql) => db.query(sql, { type: QueryTypes.SELECT });
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

        beforeEach(async () => {
            dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backfill-created-'));
            const dbPath = path.join(dir, 'db.sqlite3');
            fs.copyFileSync(path.join(FIXTURE_DIR, fixture), dbPath);
            db = new Sequelize({
                dialect: 'sqlite',
                storage: dbPath,
                logging: false,
            });
            qi = db.getQueryInterface();
            await addCreatedBy.up(qi, Sequelize);
        });

        afterEach(async () => {
            await db.close();
            fs.rmSync(dir, { recursive: true, force: true });
        });

        it('runs without changing a single row count', async () => {
            const before = await counts();

            await migration.up(qi);

            expect(await counts()).toEqual(before);
            expect(await rows('PRAGMA foreign_key_check')).toEqual([]);
        });

        it('only ever fills in a creator that is an admin with a card for the account', async () => {
            await migration.up(qi);

            const filled = await rows(
                'SELECT id, created_by_user_id FROM users WHERE created_by_user_id IS NOT NULL'
            );
            for (const { id, created_by_user_id } of filled) {
                const cards = await rows(
                    `SELECT p.id FROM people p
                     INNER JOIN roles r ON r.user_id = p.user_id
                     WHERE r.is_admin = 1 AND p.user_id = ${created_by_user_id}
                       AND p.linked_user_id = ${id}`
                );
                expect(cards.length).toBeGreaterThan(0);
            }
        });

        it('can be run again without changing anything', async () => {
            await migration.up(qi);
            const first = await rows(
                'SELECT id, created_by_user_id FROM users ORDER BY id'
            );

            await migration.up(qi);

            expect(
                await rows(
                    'SELECT id, created_by_user_id FROM users ORDER BY id'
                )
            ).toEqual(first);
        });
    });
});
