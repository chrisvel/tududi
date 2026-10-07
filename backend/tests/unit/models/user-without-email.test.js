const { User, Person, sequelize } = require('../../../models');

const selfPersonOf = (user) =>
    Person.findOne({ where: { user_id: user.id, linked_user_id: user.id } });

describe('accounts without an email', () => {
    afterAll(async () => {
        await sequelize.close();
    });

    it('can be created with just a name', async () => {
        const user = await User.create({ name: 'Emma' });
        await user.reload();

        expect(user.id).toBeDefined();
        expect(user.email).toBeNull();
    });

    it('gets a person named after the account', async () => {
        const user = await User.create({ name: 'Emma', surname: 'Veleris' });

        const person = await selfPersonOf(user);

        expect(person).toBeTruthy();
        expect(person.name).toBe('Emma Veleris');
        expect(person.email).toBeNull();
    });

    it('still gets a person when it has no name either', async () => {
        const user = await User.create({});

        const person = await selfPersonOf(user);

        expect(person).toBeTruthy();
        expect(person.name).toBe('Member');
    });

    it('allows any number of accounts without an email', async () => {
        await User.create({ name: 'Emma' });
        await User.create({ name: 'Noah' });
        const third = await User.create({ name: 'Mia' });

        expect(third.id).toBeDefined();
        expect(await User.count({ where: { email: null } })).toBe(3);
    });

    it('keeps emails unique for the accounts that have one', async () => {
        await User.create({ email: 'same@example.com', name: 'One' });

        await expect(
            User.create({ email: 'same@example.com', name: 'Two' })
        ).rejects.toThrow();
    });

    it('still rejects an email that is not valid', async () => {
        await expect(
            User.create({ email: 'not-an-email', name: 'Bad' })
        ).rejects.toThrow();
    });

    it('does not turn a missing email into an empty string', async () => {
        const user = await User.create({ name: 'Emma' });

        await user.reload();

        expect(user.email).toBeNull();
    });

    it('copies an email added later onto the person', async () => {
        const user = await User.create({ name: 'Emma' });

        await user.update({ email: 'emma@example.com' });

        const person = await selfPersonOf(user);
        expect(person.email).toBe('emma@example.com');
    });

    it('renames the person when the name of an account without an email changes', async () => {
        const user = await User.create({ name: 'Emma' });

        await user.update({ name: 'Emmy' });

        expect((await selfPersonOf(user)).name).toBe('Emmy');
    });

    it('does not fail when the name of an account without an email is cleared', async () => {
        const user = await User.create({ name: 'Emma' });

        await user.update({ name: null });

        expect((await selfPersonOf(user)).name).toBe('Member');
    });
});
