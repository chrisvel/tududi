// The User model hooks create a self-person and seed the system tags for
// every new account. Since the PostgreSQL work they run inside a savepoint
// (runNonFatalHook in models/index.js), on a fresh transaction when the caller
// passed none. Failures are swallowed by design, so these tests make sure the
// rows actually appear on both dialects and through every creation path.

const { sequelize, User, Person, Tag, Setting } = require('../../../models');
const { SYSTEM_TAGS } = require('../../../modules/tags/systemTags');
const {
    createUnverifiedUser,
} = require('../../../modules/auth/registrationService');
const { isSqlite } = require('../../../utils/db-dialect');

async function selfPersonsOf(user) {
    return Person.findAll({
        where: { user_id: user.id, linked_user_id: user.id },
    });
}

async function systemTagsOf(user) {
    return Tag.findAll({
        where: { user_id: user.id, tag_type: 'system' },
        order: [['name', 'ASC']],
    });
}

async function expectSeeded(user, expectedName) {
    expect(user.id).toBeTruthy();
    const people = await selfPersonsOf(user);
    expect(people).toHaveLength(1);
    expect(people[0].email).toBe(user.email);
    if (expectedName) expect(people[0].name).toBe(expectedName);

    const tags = await systemTagsOf(user);
    expect(tags.map((tag) => tag.name)).toEqual([...SYSTEM_TAGS].sort());
}

describe('User creation hooks', () => {
    it('seeds a self-person and system tags for User.create without a transaction', async () => {
        const user = await User.create({
            email: 'hooks-plain@example.com',
            password: 'password123',
            name: 'Plain',
            surname: 'Hooks',
        });
        expect(user.email).toBe('hooks-plain@example.com');
        await expectSeeded(user, 'Plain Hooks');
    });

    it('falls back to the email local part for the self-person name', async () => {
        const user = await User.create({
            email: 'hooks-noname@example.com',
            password: 'password123',
        });
        expect(user.name).toBeFalsy();
        await expectSeeded(user, 'hooks-noname');
    });

    it('seeds inside a caller-managed transaction that commits', async () => {
        const user = await sequelize.transaction((transaction) =>
            User.create(
                { email: 'hooks-tx@example.com', password: 'password123' },
                { transaction }
            )
        );
        expect(await User.findByPk(user.id)).not.toBeNull();
        await expectSeeded(user);
    });

    it('leaves nothing behind when the caller rolls back', async () => {
        let userId;
        await expect(
            sequelize.transaction(async (transaction) => {
                const user = await User.create(
                    {
                        email: 'hooks-rollback@example.com',
                        password: 'password123',
                    },
                    { transaction }
                );
                userId = user.id;
                throw new Error('abort');
            })
        ).rejects.toThrow('abort');

        expect(await User.findByPk(userId)).toBeNull();
        expect(
            await Person.findAll({ where: { linked_user_id: userId } })
        ).toHaveLength(0);
        expect(await Tag.findAll({ where: { user_id: userId } })).toHaveLength(
            0
        );
    });

    it('seeds through User.findOrCreate (scripts/user-create.js path)', async () => {
        const [user, created] = await User.findOrCreate({
            where: { email: 'hooks-foc@example.com' },
            defaults: {
                email: 'hooks-foc@example.com',
                password: 'password123',
            },
        });
        expect(created).toBe(true);
        await expectSeeded(user);

        // A second call must not duplicate anything.
        const [again, createdAgain] = await User.findOrCreate({
            where: { email: 'hooks-foc@example.com' },
            defaults: { email: 'hooks-foc@example.com', password: 'other' },
        });
        expect(createdAgain).toBe(false);
        expect(again.id).toBe(user.id);
        await expectSeeded(user);
    });

    it('seeds through the registration path', async () => {
        await Setting.upsert({ key: 'registration_enabled', value: 'true' });
        const user = await sequelize.transaction(async (transaction) => {
            const result = await createUnverifiedUser(
                'hooks-register@example.com',
                'password123',
                transaction
            );
            return result.user;
        });
        expect(user.email_verified).toBe(false);
        await expectSeeded(user, 'hooks-register');
    });

    it('keeps the self-person in sync with later profile changes', async () => {
        const user = await User.create({
            email: 'hooks-sync@example.com',
            password: 'password123',
            name: 'Before',
        });
        await user.update({ name: 'After', surname: 'Change' });
        const [person] = await selfPersonsOf(user);
        expect(person.name).toBe('After Change');

        await person.update({ name: 'Renamed Person' });
        await user.reload();
        expect(user.name).toBe('Renamed');
        expect(user.surname).toBe('Person');
    });

    // Reproduces the scenario the old code comment warned about: another
    // connection holds the write lock while the hook opens its own
    // transaction. Costs a full busy_timeout, so it only runs on demand.
    const busyProbe =
        isSqlite() && process.env.SQLITE_BUSY_PROBE === '1' ? it : it.skip;
    busyProbe(
        'still seeds when a concurrent writer briefly holds the lock',
        async () => {
            const blocker = await sequelize.transaction();
            await Setting.upsert(
                { key: 'busy_probe', value: 'x' },
                { transaction: blocker }
            );
            const release = setTimeout(() => blocker.commit(), 1500);

            const user = await User.create({
                email: 'hooks-busy@example.com',
                password: 'password123',
            });
            clearTimeout(release);
            if (!blocker.finished) await blocker.commit();
            await expectSeeded(user);
        },
        30000
    );
});
