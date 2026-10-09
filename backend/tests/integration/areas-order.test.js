const request = require('supertest');
const app = require('../../app');
const { sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Areas custom order', () => {
    let owner, member, ownerAgent, memberAgent, areas;

    const orderOf = (body) =>
        body
            .filter((a) => a.sort_position !== null)
            .sort((a, b) => a.sort_position - b.sort_position)
            .map((a) => a.uid);

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

        areas = [];
        for (const name of ['Home', 'Work', 'Health']) {
            const res = await ownerAgent.post('/api/areas').send({ name });
            areas.push(res.body);
        }
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('returns null sort_position before any reorder', async () => {
        const res = await ownerAgent.get('/api/areas');
        expect(res.status).toBe(200);
        res.body.forEach((a) => expect(a.sort_position).toBeNull());
    });

    it('saves and returns the custom order', async () => {
        const order = [areas[2].uid, areas[0].uid, areas[1].uid];
        const put = await ownerAgent
            .put('/api/areas/order')
            .send({ area_uids: order });
        expect(put.status).toBe(200);
        expect(put.body.area_uids).toEqual(order);

        const res = await ownerAgent.get('/api/areas');
        expect(orderOf(res.body)).toEqual(order);
    });

    it('rejects duplicate and non-list payloads', async () => {
        const dupes = await ownerAgent
            .put('/api/areas/order')
            .send({ area_uids: [areas[0].uid, areas[0].uid] });
        expect(dupes.status).toBe(400);

        const notList = await ownerAgent
            .put('/api/areas/order')
            .send({ area_uids: 'nope' });
        expect(notList.status).toBe(400);
    });

    it('rejects areas the user cannot see', async () => {
        const res = await memberAgent
            .put('/api/areas/order')
            .send({ area_uids: [areas[0].uid] });
        expect(res.status).toBe(404);
    });
});
