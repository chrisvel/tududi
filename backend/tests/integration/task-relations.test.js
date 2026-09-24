const request = require('supertest');
const app = require('../../app');
const { TaskRelation, TaskEvent } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task relations', () => {
    let user, agent, outsiderAgent;

    const login = async (email) => {
        const a = request.agent(app);
        await a.post('/api/login').send({ email, password: 'password123' });
        return a;
    };

    const makeTask = async (name, a = agent) => {
        const res = await a.post('/api/task').send({ name });
        return res.body;
    };

    const link = (from, to, type, a = agent) =>
        a
            .post(`/api/task/${from.uid}/relations`)
            .send({ target_uid: to.uid, type });

    beforeEach(async () => {
        user = await createTestUser({
            email: `rel_${Date.now()}@test.com`,
            timezone: 'UTC',
        });
        const outsider = await createTestUser({
            email: `rel_out_${Date.now()}@test.com`,
            timezone: 'UTC',
        });
        agent = await login(user.email);
        outsiderAgent = await login(outsider.email);
    });

    it('stores one row and shows the inverse from the other side', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');

        const res = await link(a, b, 'blocks');
        expect(res.status).toBe(201);
        expect(res.body.type).toBe('blocks');

        expect(await TaskRelation.count()).toBe(1);

        const fromA = await agent.get(`/api/task/${a.uid}/relations`);
        expect(fromA.body.relations).toHaveLength(1);
        expect(fromA.body.relations[0]).toMatchObject({
            type: 'blocks',
            task: { uid: b.uid, name: 'B' },
        });

        const fromB = await agent.get(`/api/task/${b.uid}/relations`);
        expect(fromB.body.relations[0]).toMatchObject({
            type: 'blocked_by',
            task: { uid: a.uid },
        });
    });

    it('accepts blocked_by and duplicated_by as the reverse direction', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');

        await link(a, b, 'blocked_by');
        const fromB = await agent.get(`/api/task/${b.uid}/relations`);
        expect(fromB.body.relations[0].type).toBe('blocks');

        const c = await makeTask('C');
        await link(a, c, 'duplicated_by');
        const fromC = await agent.get(`/api/task/${c.uid}/relations`);
        expect(fromC.body.relations[0].type).toBe('duplicates');
    });

    it('treats related_to as symmetric and refuses a second copy', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');

        expect((await link(a, b, 'related_to')).status).toBe(201);
        expect((await link(b, a, 'related_to')).status).toBe(409);
        expect(await TaskRelation.count()).toBe(1);
    });

    it('refuses self links, duplicates of an existing link, and bad types', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');

        expect((await link(a, a, 'blocks')).status).toBe(400);
        expect((await link(a, b, 'nonsense')).status).toBe(400);
        expect((await link(a, b, 'blocks')).status).toBe(201);
        expect((await link(a, b, 'blocks')).status).toBe(409);
    });

    it('refuses circular blocking chains', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');
        const c = await makeTask('C');

        await link(a, b, 'blocks');
        await link(b, c, 'blocks');

        const res = await link(c, a, 'blocks');
        expect(res.status).toBe(409);
        expect((await link(b, a, 'blocks')).status).toBe(409);
    });

    it('does not reveal or link tasks the caller cannot access', async () => {
        const mine = await makeTask('Mine');
        const theirs = await makeTask('Theirs', outsiderAgent);

        const res = await link(mine, theirs, 'blocks');
        expect(res.status).toBe(404);

        const read = await outsiderAgent.get(`/api/task/${mine.uid}/relations`);
        expect([403, 404]).toContain(read.status);
    });

    it('flags a task as blocked until the blocker is resolved', async () => {
        const a = await makeTask('Blocker');
        const b = await makeTask('Blocked');
        await link(a, b, 'blocks');

        let fetched = (await agent.get(`/api/task/${b.uid}`)).body;
        expect(fetched.is_blocked).toBe(true);
        expect(fetched.blocked_by_count).toBe(1);

        await agent.patch(`/api/task/${a.uid}`).send({ status: 'done' });

        fetched = (await agent.get(`/api/task/${b.uid}`)).body;
        expect(fetched.is_blocked).toBe(false);
    });

    it('does not stop a blocked task from being completed', async () => {
        const a = await makeTask('Blocker');
        const b = await makeTask('Blocked');
        await link(a, b, 'blocks');

        const res = await agent
            .patch(`/api/task/${b.uid}`)
            .send({ status: 'done' });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe(2);
    });

    it('filters lists by blocked state only when asked', async () => {
        const a = await makeTask('Blocker');
        const b = await makeTask('Blocked');
        const c = await makeTask('Free');
        await link(a, b, 'blocks');

        const names = (res) => res.body.tasks.map((t) => t.name).sort();

        const all = await agent.get('/api/tasks?type=all');
        expect(names(all)).toEqual(['Blocked', 'Blocker', 'Free']);

        const blocked = await agent.get('/api/tasks?type=all&blocked=true');
        expect(names(blocked)).toEqual(['Blocked']);

        const unblocked = await agent.get('/api/tasks?type=all&blocked=false');
        expect(names(unblocked)).toEqual(['Blocker', 'Free']);
        expect(c.uid).toBeDefined();
    });

    it('removes a relation from either side and logs events', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');
        const created = await link(a, b, 'blocks');

        const res = await agent.delete(
            `/api/task/${b.uid}/relations/${created.body.uid}`
        );
        expect(res.status).toBe(204);
        expect(await TaskRelation.count()).toBe(0);

        const types = (await TaskEvent.findAll()).map((e) => e.event_type);
        expect(types).toContain('relation_added');
        expect(types).toContain('relation_removed');
    });

    it('removes relations when a task is deleted', async () => {
        const a = await makeTask('A');
        const b = await makeTask('B');
        await link(a, b, 'blocks');

        const res = await agent.delete(`/api/task/${a.uid}`);
        expect(res.status).toBe(200);
        expect(await TaskRelation.count()).toBe(0);
    });
});
