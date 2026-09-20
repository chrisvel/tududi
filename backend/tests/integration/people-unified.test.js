const request = require('supertest');
const app = require('../../app');
const {
    User,
    Person,
    UserGroup,
    UserGroupMember,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const loginAgent = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

const selfPerson = (user) =>
    Person.findOne({ where: { user_id: user.id, linked_user_id: user.id } });

describe('The People list', () => {
    let admin, wife, kid, stranger;
    let wifeAgent, strangerAgent;
    let plumber, strangerContact;

    const list = async (agent, query = '') => {
        const res = await agent.get(`/api/people${query}`);
        expect(res.status).toBe(200);
        return res.body.people;
    };
    const byName = (people, name) => people.find((p) => p.name === name);

    beforeEach(async () => {
        admin = await createTestUser({
            email: 'admin@example.com',
            name: 'Admin',
        });
        wife = await createTestUser({
            email: 'wife@example.com',
            name: 'Wife',
        });
        // A member with no email and no password, like a child.
        kid = await User.create({ name: 'Kid', created_by_user_id: admin.id });
        stranger = await createTestUser({
            email: 'stranger@example.com',
            name: 'Stranger',
        });

        const group = await UserGroup.create({ name: 'Family' });
        await UserGroupMember.bulkCreate(
            [admin, wife, kid].map((u) => ({
                group_id: group.id,
                user_id: u.id,
            }))
        );

        plumber = await Person.create({
            user_id: wife.id,
            name: 'Plumber',
            relationship_type: 'work',
            phone: '555-0100',
            notes: 'cash only',
        });
        strangerContact = await Person.create({
            user_id: stranger.id,
            name: 'Strangers Contact',
            notes: 'private',
        });

        wifeAgent = await loginAgent(wife.email);
        strangerAgent = await loginAgent(stranger.email);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('who is in it', () => {
        it('has your own person, your contacts and the members of your workspace', async () => {
            const people = await list(wifeAgent);

            expect(people.map((p) => p.name).sort()).toEqual(
                ['Admin', 'Kid', 'Plumber', 'Wife'].sort()
            );
        });

        it('leaves out people who are not in your workspace, and their contacts', async () => {
            const names = (await list(wifeAgent)).map((p) => p.name);

            expect(names).not.toContain('Stranger');
            expect(names).not.toContain('Strangers Contact');
        });

        it('does not show a stranger the family either', async () => {
            const names = (await list(strangerAgent)).map((p) => p.name);

            expect(names.sort()).toEqual(['Stranger', 'Strangers Contact']);
        });

        it('lists a contact linked to a member once, as the member', async () => {
            await Person.create({
                user_id: wife.id,
                linked_user_id: kid.id,
                name: 'Kiddo',
            });

            const people = await list(wifeAgent);

            expect(
                people.filter((p) => p.linked_user_id === kid.id)
            ).toHaveLength(1);
            expect(byName(people, 'Kiddo')).toBeUndefined();
            expect(byName(people, 'Kid')).toBeDefined();
        });

        it('keeps a linked contact when its account is not in your workspace', async () => {
            await Person.create({
                user_id: wife.id,
                linked_user_id: stranger.id,
                name: 'Old link',
            });

            const people = await list(wifeAgent);

            expect(byName(people, 'Old link')).toBeDefined();
            expect(byName(people, 'Stranger')).toBeUndefined();
        });
    });

    describe('what each entry says', () => {
        it('marks members and contacts', async () => {
            const people = await list(wifeAgent);

            expect(byName(people, 'Wife').kind).toBe('member');
            expect(byName(people, 'Admin').kind).toBe('member');
            expect(byName(people, 'Kid').kind).toBe('member');
            expect(byName(people, 'Plumber').kind).toBe('contact');
        });

        it('says whether a member can sign in', async () => {
            const people = await list(wifeAgent);

            expect(byName(people, 'Kid').account_status).toBe('no_sign_in');
            expect(byName(people, 'Wife').account_status).toBe('active');
            expect(byName(people, 'Admin').account_status).toBe('active');
            expect(byName(people, 'Plumber').account_status).toBeUndefined();
        });

        it('marks your own person', async () => {
            const people = await list(wifeAgent);

            expect(byName(people, 'Wife').is_self).toBe(true);
            expect(byName(people, 'Kid').is_self).toBe(false);
        });

        it('says which entries you can change', async () => {
            const people = await list(wifeAgent);

            expect(byName(people, 'Wife').can_edit).toBe(true);
            expect(byName(people, 'Plumber').can_edit).toBe(true);
            expect(byName(people, 'Kid').can_edit).toBe(false);
            expect(byName(people, 'Admin').can_edit).toBe(false);
        });

        it('shows another member by name and color only', async () => {
            const kidPerson = await selfPerson(kid);
            await kidPerson.update({
                phone: '555-0199',
                notes: 'kid notes',
                color: '#00ff00',
            });

            const entry = byName(await list(wifeAgent), 'Kid');

            expect(entry.color).toBe('#00ff00');
            expect(entry.phone).toBeUndefined();
            expect(entry.notes).toBeUndefined();
            expect(entry.email).toBeUndefined();
        });

        it('shows you everything about your own contacts', async () => {
            const entry = byName(await list(wifeAgent), 'Plumber');

            expect(entry.phone).toBe('555-0100');
            expect(entry.notes).toBe('cash only');
        });
    });

    describe('filters', () => {
        it('only returns your own cards for a relationship', async () => {
            const people = await list(wifeAgent, '?relationship_type=work');

            expect(people.map((p) => p.name)).toEqual(['Plumber']);
        });

        it('only returns your own unlinked cards when asked for them', async () => {
            const people = await list(wifeAgent, '?unlinked=true');

            expect(people.map((p) => p.name)).toEqual(['Plumber']);
        });

        it('does not mix members into the archive', async () => {
            await plumber.update({ archived: true });

            const archived = await list(wifeAgent, '?archived=true');
            const active = await list(wifeAgent);

            expect(archived.map((p) => p.name)).toEqual(['Plumber']);
            expect(active.map((p) => p.name)).not.toContain('Plumber');
        });
    });

    describe('opening one', () => {
        it('opens your own contact with everything on it', async () => {
            const res = await wifeAgent.get(`/api/people/${plumber.uid}`);

            expect(res.status).toBe(200);
            expect(res.body.phone).toBe('555-0100');
            expect(res.body.can_edit).toBe(true);
            expect(res.body.kind).toBe('contact');
        });

        it('opens another member, read only and without their details', async () => {
            const kidPerson = await selfPerson(kid);
            await kidPerson.update({ phone: '555-0199', notes: 'kid notes' });

            const res = await wifeAgent.get(`/api/people/${kidPerson.uid}`);

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('Kid');
            expect(res.body.kind).toBe('member');
            expect(res.body.can_edit).toBe(false);
            expect(res.body.phone).toBeUndefined();
            expect(res.body.notes).toBeUndefined();
        });

        it('does not open a member from outside your workspace', async () => {
            const strangerPerson = await selfPerson(stranger);

            const res = await wifeAgent.get(
                `/api/people/${strangerPerson.uid}`
            );

            expect(res.status).toBe(404);
        });

        it("does not open someone else's contact", async () => {
            const res = await wifeAgent.get(
                `/api/people/${strangerContact.uid}`
            );

            expect(res.status).toBe(404);
        });
    });

    describe("changing someone else's entry", () => {
        it('cannot rename another member', async () => {
            const kidPerson = await selfPerson(kid);

            const res = await wifeAgent
                .patch(`/api/people/${kidPerson.uid}`)
                .send({ name: 'Renamed' });

            expect(res.status).toBe(404);
            expect((await kidPerson.reload()).name).toBe('Kid');
        });

        it('cannot delete another member', async () => {
            const kidPerson = await selfPerson(kid);

            const res = await wifeAgent.delete(`/api/people/${kidPerson.uid}`);

            expect(res.status).toBe(404);
            expect(
                await Person.findOne({ where: { uid: kidPerson.uid } })
            ).toBeTruthy();
        });
    });

    describe('the person that stands for your own account', () => {
        it('cannot be deleted', async () => {
            const own = await selfPerson(wife);

            const res = await wifeAgent.delete(`/api/people/${own.uid}`);

            expect(res.status).toBe(400);
            expect(
                await Person.findOne({ where: { uid: own.uid } })
            ).toBeTruthy();
        });

        it('can be edited', async () => {
            const own = await selfPerson(wife);

            const res = await wifeAgent
                .patch(`/api/people/${own.uid}`)
                .send({ phone: '555-0111' });

            expect(res.status).toBe(200);
        });

        it('leaves your contacts deletable', async () => {
            const res = await wifeAgent.delete(`/api/people/${plumber.uid}`);

            expect([200, 204]).toContain(res.status);
            expect(
                await Person.findOne({ where: { uid: plumber.uid } })
            ).toBeNull();
        });
    });

    describe('the assignee lists', () => {
        it('say the same things about each entry', async () => {
            const res = await wifeAgent.get('/api/people/assignable');

            const kidEntry = byName(res.body.people, 'Kid');
            expect(kidEntry.kind).toBe('member');
            expect(kidEntry.can_edit).toBe(false);
            expect(kidEntry.account_status).toBe('no_sign_in');
            expect(byName(res.body.people, 'Plumber').kind).toBe('contact');
        });
    });
});
