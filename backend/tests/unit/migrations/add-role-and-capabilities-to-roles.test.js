const { Sequelize } = require('sequelize');
const { sequelize } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');
const migration = require('../../../migrations/20260920000001-add-role-and-capabilities-to-roles');

const queryInterface = () => sequelize.getQueryInterface();

// Puts the roles table back to how an install from before this change has it.
async function toLegacyShape() {
    const info = await queryInterface().describeTable('roles');
    if ('capabilities' in info) {
        await queryInterface().removeColumn('roles', 'capabilities');
    }
    if ('role' in info) {
        await queryInterface().removeColumn('roles', 'role');
    }
}

async function insertLegacyRole(userId, isAdmin) {
    await sequelize.query(
        `INSERT INTO roles (user_id, is_admin, created_at, updated_at)
         VALUES (:userId, :isAdmin, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        { replacements: { userId, isAdmin } }
    );
}

const readRoles = async () => {
    const [rows] = await sequelize.query(
        'SELECT user_id, is_admin, role, capabilities FROM roles ORDER BY user_id'
    );
    return rows;
};

const runUp = () => migration.up(queryInterface(), Sequelize);

describe('migration 20260920000001-add-role-and-capabilities-to-roles', () => {
    let ids;

    beforeEach(async () => {
        const users = [];
        for (const name of ['one', 'two', 'three']) {
            users.push(await createTestUser({ email: `${name}@example.com` }));
        }
        ids = users.map((u) => u.id);
        await sequelize.query('DELETE FROM roles');
        await toLegacyShape();
    });

    afterAll(async () => {
        await runUp();
        await sequelize.close();
    });

    it('adds the role and capabilities columns', async () => {
        await runUp();

        const info = await queryInterface().describeTable('roles');
        expect(info.role).toBeDefined();
        expect(info.role.allowNull).toBe(false);
        expect(info.capabilities).toBeDefined();
        expect(info.capabilities.allowNull).toBe(true);
    });

    it('keeps an existing admin as an admin and everyone else as a user', async () => {
        await insertLegacyRole(ids[0], true);
        await insertLegacyRole(ids[1], false);
        await insertLegacyRole(ids[2], false);

        await runUp();

        const rows = await readRoles();
        expect(rows.map((r) => [r.user_id, r.role])).toEqual([
            [ids[0], 'admin'],
            [ids[1], 'user'],
            [ids[2], 'user'],
        ]);
        expect(rows.every((r) => r.capabilities === null)).toBe(true);
    });

    it('leaves the admin flag untouched', async () => {
        await insertLegacyRole(ids[0], true);
        await insertLegacyRole(ids[1], false);

        await runUp();

        const rows = await readRoles();
        expect(rows.map((r) => Boolean(r.is_admin))).toEqual([true, false]);
    });

    it('can be run again without changing anything', async () => {
        await insertLegacyRole(ids[0], true);
        await insertLegacyRole(ids[1], false);

        await runUp();
        const first = await readRoles();
        await runUp();

        expect(await readRoles()).toEqual(first);
    });

    it('does not overwrite a guest when it runs again', async () => {
        await insertLegacyRole(ids[0], false);
        await runUp();
        await sequelize.query(
            "UPDATE roles SET role = 'guest' WHERE user_id = :id",
            { replacements: { id: ids[0] } }
        );

        await runUp();

        expect((await readRoles())[0].role).toBe('guest');
    });

    it('can be undone', async () => {
        await runUp();

        await migration.down(queryInterface());

        const info = await queryInterface().describeTable('roles');
        expect(info.role).toBeUndefined();
        expect(info.capabilities).toBeUndefined();
    });
});
