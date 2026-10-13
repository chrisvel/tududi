const request = require('supertest');
const app = require('../../app');
const { Area, Goal, Permission } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Areas and goals shared with another user (#1665)', () => {
    let owner, member, stranger, memberAgent, strangerAgent, area, goal;

    const share = (resourceType, uid, accessLevel) =>
        Permission.create({
            user_id: member.id,
            resource_type: resourceType,
            resource_uid: uid,
            access_level: accessLevel,
            propagation: 'direct',
            granted_by_user_id: owner.id,
        });

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({ email: `owner_${stamp}@example.com` });
        member = await createTestUser({ email: `member_${stamp}@example.com` });
        stranger = await createTestUser({
            email: `stranger_${stamp}@example.com`,
        });
        memberAgent = await login(member);
        strangerAgent = await login(stranger);

        area = await Area.create({ name: 'Family', user_id: owner.id });
        goal = await Goal.create({
            title: 'Move house',
            user_id: owner.id,
            area_id: area.id,
        });
    });

    describe('read access', () => {
        beforeEach(async () => {
            await share('area', area.uid, 'ro');
            await share('goal', goal.uid, 'ro');
        });

        it('lists and opens a shared area', async () => {
            const list = await memberAgent.get('/api/areas');
            expect(list.status).toBe(200);
            expect(list.body.map((a) => a.uid)).toContain(area.uid);

            const one = await memberAgent.get(`/api/areas/${area.uid}`);
            expect(one.status).toBe(200);
            expect(one.body.name).toBe('Family');
        });

        it('lists and opens a shared goal, also by its area', async () => {
            const list = await memberAgent.get('/api/goals');
            expect(list.body.goals.map((g) => g.uid)).toContain(goal.uid);

            const byArea = await memberAgent.get(
                `/api/goals?area_uid=${area.uid}`
            );
            expect(byArea.body.goals.map((g) => g.uid)).toContain(goal.uid);

            const one = await memberAgent.get(`/api/goals/${goal.uid}`);
            expect(one.status).toBe(200);
            expect(one.body.goal.title).toBe('Move house');
        });

        it('does not let a read-only member edit', async () => {
            const areaRes = await memberAgent
                .patch(`/api/areas/${area.uid}`)
                .send({ name: 'Renamed' });
            expect(areaRes.status).toBe(403);

            const goalRes = await memberAgent
                .patch(`/api/goals/${goal.uid}`)
                .send({ title: 'Renamed' });
            expect(goalRes.status).toBe(403);
        });
    });

    describe('read-write access', () => {
        beforeEach(async () => {
            await share('area', area.uid, 'rw');
            await share('goal', goal.uid, 'rw');
        });

        it('lets the member edit but not delete', async () => {
            const edit = await memberAgent
                .patch(`/api/areas/${area.uid}`)
                .send({ name: 'Home' });
            expect(edit.status).toBe(200);
            expect((await Area.findByPk(area.id)).name).toBe('Home');

            const goalEdit = await memberAgent
                .patch(`/api/goals/${goal.uid}`)
                .send({ title: 'Move soon' });
            expect(goalEdit.status).toBe(200);

            expect(
                (await memberAgent.delete(`/api/areas/${area.uid}`)).status
            ).toBe(403);
            expect(
                (await memberAgent.delete(`/api/goals/${goal.uid}`)).status
            ).toBe(403);
            expect(await Area.findByPk(area.id)).not.toBeNull();
            expect(await Goal.findByPk(goal.id)).not.toBeNull();
        });

        it('lets the member file a task under the shared area and goal', async () => {
            const res = await memberAgent.post('/api/task').send({
                name: 'Pack boxes',
                area_id: area.id,
                goal_id: goal.id,
            });
            expect(res.status).toBe(201);
        });
    });

    it('keeps unshared areas and goals hidden from other users', async () => {
        const areas = await strangerAgent.get('/api/areas');
        expect(areas.body.map((a) => a.uid)).not.toContain(area.uid);
        expect((await strangerAgent.get(`/api/areas/${area.uid}`)).status).toBe(
            404
        );

        const byArea = await strangerAgent.get(`/api/goals?area_id=${area.id}`);
        expect(byArea.body.goals).toEqual([]);
        expect((await strangerAgent.get(`/api/goals/${goal.uid}`)).status).toBe(
            404
        );

        const task = await strangerAgent.post('/api/task').send({
            name: 'Sneaky',
            area_id: area.id,
        });
        expect(task.status).toBe(400);
    });
});
