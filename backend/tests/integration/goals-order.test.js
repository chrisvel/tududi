const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Goals custom order', () => {
    let owner, member, ownerAgent, memberAgent, goals;

    const orderOf = (body) =>
        body.goals
            .filter((g) => g.sort_position !== null)
            .sort((a, b) => a.sort_position - b.sort_position)
            .map((g) => g.uid);

    beforeEach(async () => {
        owner = await createTestUser({ email: `owner_${Date.now()}@test.com` });
        member = await createTestUser({
            email: `member_${Date.now()}@test.com`,
        });
        ownerAgent = request.agent(app);
        memberAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });
        await memberAgent
            .post('/api/login')
            .send({ email: member.email, password: 'password123' });

        goals = [];
        for (const title of ['Alpha', 'Bravo', 'Charlie']) {
            const res = await ownerAgent
                .post('/api/goals')
                .send({ title, horizon: 'season' });
            goals.push(res.body.goal);
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('returns null sort_position before any reorder', async () => {
        const res = await ownerAgent.get('/api/goals');
        expect(res.status).toBe(200);
        res.body.goals.forEach((g) => expect(g.sort_position).toBeNull());
    });

    it('saves and returns the custom order', async () => {
        const order = [goals[2].uid, goals[0].uid, goals[1].uid];
        const put = await ownerAgent
            .put('/api/goals/order')
            .send({ goal_uids: order });
        expect(put.status).toBe(200);
        expect(put.body.goal_uids).toEqual(order);

        const res = await ownerAgent.get('/api/goals');
        expect(orderOf(res.body)).toEqual(order);
    });

    it('rejects duplicate and non-list payloads', async () => {
        const dupes = await ownerAgent
            .put('/api/goals/order')
            .send({ goal_uids: [goals[0].uid, goals[0].uid] });
        expect(dupes.status).toBe(400);

        const notList = await ownerAgent
            .put('/api/goals/order')
            .send({ goal_uids: 'nope' });
        expect(notList.status).toBe(400);
    });

    it('rejects goals the user cannot see', async () => {
        const res = await memberAgent
            .put('/api/goals/order')
            .send({ goal_uids: [goals[0].uid] });
        expect(res.status).toBe(404);
    });
});
