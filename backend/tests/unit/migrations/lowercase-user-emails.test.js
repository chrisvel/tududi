const { Sequelize } = require('sequelize');
const { sequelize, User, Person } = require('../../../models');
const migration = require('../../../migrations/20260906000001-lowercase-user-emails');

// Rows are inserted with raw SQL because the User model lowercases emails on
// write, which is exactly the normalisation legacy rows never received.
async function insertUser(email, name) {
    const [result] = await sequelize.query(
        `INSERT INTO users (uid, email, name, password_digest, created_at, updated_at)
         VALUES (:uid, :email, :name, 'x', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        {
            replacements: {
                uid: `uid-${Math.random().toString(36).slice(2, 12)}`,
                email,
                name,
            },
        }
    );
    const user = await User.findOne({ where: { name } });
    expect(user).toBeTruthy();
    return user || result;
}

async function insertSelfPerson(user, email) {
    await sequelize.query(
        `INSERT INTO people (uid, user_id, linked_user_id, name, email, relationship_type, archived, created_at, updated_at)
         VALUES (:uid, :id, :id, :name, :email, 'other', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        {
            replacements: {
                uid: `puid-${Math.random().toString(36).slice(2, 12)}`,
                id: user.id,
                name: user.name,
                email,
            },
        }
    );
}

function runUp() {
    return migration.up(sequelize.getQueryInterface(), Sequelize);
}

describe('migration 20260906000001-lowercase-user-emails', () => {
    let warn;

    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('lowercases mixed-case emails and the linked self-person', async () => {
        const legacy = await insertUser('Alice.Legacy@Example.COM', 'alice');
        await insertSelfPerson(legacy, 'Alice.Legacy@Example.COM');
        const modern = await insertUser('bob@example.com', 'bob');

        await runUp();

        await legacy.reload();
        await modern.reload();
        expect(legacy.email).toBe('alice.legacy@example.com');
        expect(modern.email).toBe('bob@example.com');
        const person = await Person.findOne({
            where: { user_id: legacy.id, linked_user_id: legacy.id },
        });
        expect(person.email).toBe('alice.legacy@example.com');
        expect(warn).not.toHaveBeenCalled();
    });

    it('leaves accounts alone when lowercasing would collide', async () => {
        const first = await insertUser('carol@example.com', 'carol');
        const second = await insertUser('Carol@Example.com', 'carol2');

        await runUp();

        await first.reload();
        await second.reload();
        expect(first.email).toBe('carol@example.com');
        expect(second.email).toBe('Carol@Example.com');
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(`users.id=${second.id}`);
        expect(warn.mock.calls[0][0]).toContain(`users.id=${first.id}`);
    });

    it('is a no-op when every email is already lowercase', async () => {
        const user = await insertUser('dave@example.com', 'dave');
        const before = user.updated_at;

        await runUp();

        await user.reload();
        expect(user.email).toBe('dave@example.com');
        expect(user.updated_at).toEqual(before);
        expect(warn).not.toHaveBeenCalled();
    });

    it('makes the legacy account reachable through the login lookup', async () => {
        await insertUser('Erin@Example.ORG', 'erin');
        expect(
            await User.findOne({ where: { email: 'erin@example.org' } })
        ).toBeNull();

        await runUp();

        expect(
            await User.findOne({ where: { email: 'erin@example.org' } })
        ).not.toBeNull();
    });
});
