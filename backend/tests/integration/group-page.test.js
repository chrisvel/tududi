const request = require('supertest');
const app = require('../../app');
const {
    Role,
    Project,
    Task,
    UserGroup,
    UserGroupMember,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const allTaskNames = (columns) =>
    columns.flatMap((c) =>
        [
            ...c.overdue,
            ...c.today,
            ...c.tomorrow,
            ...c.upcoming,
            ...c.no_date,
        ].map((t) => t.name)
    );

describe('GET /api/groups/:uid', () => {
    let admin, alice, bob, carol, group;
    let aliceAgent, bobAgent, carolAgent, adminAgent, bobSelf;

    beforeEach(async () => {
        const stamp = Date.now();
        admin = await createTestUser({
            email: `gp_admin_${stamp}@example.com`,
        });
        alice = await createTestUser({
            email: `gp_alice_${stamp}@example.com`,
            name: 'Alice',
        });
        bob = await createTestUser({
            email: `gp_bob_${stamp}@example.com`,
            name: 'Bob',
        });
        carol = await createTestUser({
            email: `gp_carol_${stamp}@example.com`,
            name: 'Carol',
        });
        await Role.destroy({ where: {} });
        await Role.create({ user_id: admin.id, is_admin: true });

        await peopleService.createSelfPerson(alice);
        bobSelf = await peopleService.createSelfPerson(bob);
        await peopleService.createSelfPerson(carol);

        group = await UserGroup.create({ name: 'Family' });
        await UserGroupMember.bulkCreate([
            { group_id: group.id, user_id: alice.id },
            { group_id: group.id, user_id: bob.id },
        ]);

        aliceAgent = await login(alice);
        bobAgent = await login(bob);
        carolAgent = await login(carol);
        adminAgent = await login(admin);
    });

    it('rejects unauthenticated requests', async () => {
        const res = await request(app).get(`/api/groups/${group.uid}`);
        expect(res.status).toBe(401);
    });

    it('shows a member a column per member with assigned tasks', async () => {
        await Task.create({
            name: 'Feed the cat',
            user_id: alice.id,
            assigned_to: bobSelf.uid,
            due_date: new Date(),
        });

        const res = await aliceAgent.get(`/api/groups/${group.uid}`);
        expect(res.status).toBe(200);
        expect(res.body.group).toMatchObject({
            uid: group.uid,
            name: 'Family',
            member_count: 2,
        });
        expect(res.body.columns).toHaveLength(2);
        expect(res.body.summary.people).toBe(2);
        const bobColumn = res.body.columns.find(
            (c) => c.person.uid === bobSelf.uid
        );
        expect(bobColumn.today.map((t) => t.name)).toContain('Feed the cat');
        expect(res.body.summary.total).toBe(1);
    });

    it('keeps a member with no tasks as an empty column', async () => {
        const res = await aliceAgent.get(`/api/groups/${group.uid}`);
        expect(res.status).toBe(200);
        expect(res.body.columns).toHaveLength(2);
        expect(res.body.summary.total).toBe(0);
    });

    it('returns 404 to a signed-in user outside the group', async () => {
        const res = await carolAgent.get(`/api/groups/${group.uid}`);
        expect(res.status).toBe(404);
    });

    it('returns 404 for an unknown group', async () => {
        const res = await aliceAgent.get('/api/groups/does-not-exist');
        expect(res.status).toBe(404);
    });

    it('lets an admin open a group they are not in', async () => {
        const res = await adminAgent.get(`/api/groups/${group.uid}`);
        expect(res.status).toBe(200);
        expect(res.body.group.name).toBe('Family');
    });

    it('hides a member task the viewer cannot read', async () => {
        const priv = await Project.create({
            name: 'Bob private',
            user_id: bob.id,
        });
        await Task.create({
            name: 'Secret errand',
            user_id: bob.id,
            project_id: priv.id,
            assigned_to: bobSelf.uid,
            due_date: new Date(),
        });

        const asAlice = await aliceAgent.get(`/api/groups/${group.uid}`);
        expect(allTaskNames(asAlice.body.columns)).not.toContain(
            'Secret errand'
        );

        const asBob = await bobAgent.get(`/api/groups/${group.uid}`);
        expect(allTaskNames(asBob.body.columns)).toContain('Secret errand');
    });

    it('drops a removed member from the page', async () => {
        await UserGroupMember.destroy({
            where: { group_id: group.id, user_id: bob.id },
        });
        const res = await aliceAgent.get(`/api/groups/${group.uid}`);
        expect(res.body.columns).toHaveLength(1);
        expect((await bobAgent.get(`/api/groups/${group.uid}`)).status).toBe(
            404
        );
    });

    it('flags the groups the user belongs to in the picker list', async () => {
        await UserGroup.create({ name: 'Other' });
        const res = await aliceAgent.get('/api/groups');
        const byName = Object.fromEntries(
            res.body.groups.map((g) => [g.name, g.is_member])
        );
        expect(byName).toEqual({ Family: true, Other: false });
    });
});
