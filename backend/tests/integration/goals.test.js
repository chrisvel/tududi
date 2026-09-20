const request = require('supertest');
const app = require('../../app');
const { Goal, User, Area } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Goals Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({ email: 'goaltest@example.com' });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'goaltest@example.com',
            password: 'password123',
        });
    });

    describe('area ownership', () => {
        let ownArea, foreignArea;

        beforeEach(async () => {
            const other = await createTestUser({
                email: 'goal-area-other@example.com',
            });
            ownArea = await Area.create({ name: 'Mine', user_id: user.id });
            foreignArea = await Area.create({
                name: 'Not mine',
                user_id: other.id,
            });
        });

        it('should place a goal in an area the user owns', async () => {
            const response = await agent
                .post('/api/goals')
                .send({ title: 'In my area', area_id: ownArea.id });

            expect(response.status).toBe(201);
            expect(response.body.goal.area_id).toBe(ownArea.id);
        });

        it("should refuse a goal in another user's area on create", async () => {
            const response = await agent
                .post('/api/goals')
                .send({ title: 'Sneaky', area_id: foreignArea.id });

            expect(response.status).toBe(400);
            expect(await Goal.count({ where: { user_id: user.id } })).toBe(0);
        });

        it("should refuse moving a goal into another user's area", async () => {
            const created = await agent
                .post('/api/goals')
                .send({ title: 'Movable', area_id: ownArea.id });

            const response = await agent
                .patch(`/api/goals/${created.body.goal.uid}`)
                .send({ area_id: foreignArea.id });

            expect(response.status).toBe(400);
            const stored = await Goal.findOne({
                where: { uid: created.body.goal.uid },
            });
            expect(stored.area_id).toBe(ownArea.id);
        });

        it('should answer the same for a nonexistent area as for a foreign one', async () => {
            const response = await agent
                .post('/api/goals')
                .send({ title: 'Ghost', area_id: 999999 });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid area');
        });

        it('should still allow clearing the area', async () => {
            const created = await agent
                .post('/api/goals')
                .send({ title: 'Clearable', area_id: ownArea.id });

            const response = await agent
                .patch(`/api/goals/${created.body.goal.uid}`)
                .send({ area_id: null });

            expect(response.status).toBe(200);
            expect(response.body.goal.area_id).toBeNull();
        });
    });

    describe('POST /api/goals', () => {
        it('should create a goal with a color', async () => {
            const response = await agent.post('/api/goals').send({
                title: 'Run a marathon',
                horizon: 'year',
                status: 'active',
                color: '#1d4ed8',
            });

            expect(response.status).toBe(201);
            expect(response.body.goal.color).toBe('#1d4ed8');
        });

        it('should create a goal without a color', async () => {
            const response = await agent.post('/api/goals').send({
                title: 'Read more books',
                horizon: 'season',
                status: 'active',
            });

            expect(response.status).toBe(201);
            expect(response.body.goal.color).toBeNull();
        });
    });

    describe('PATCH /api/goals/:uid', () => {
        it('should update a goal color', async () => {
            const created = await agent.post('/api/goals').send({
                title: 'Learn guitar',
                horizon: 'year',
                status: 'active',
            });
            const uid = created.body.goal.uid;

            const response = await agent.patch(`/api/goals/${uid}`).send({
                color: '#15803d',
            });

            expect(response.status).toBe(200);
            expect(response.body.goal.color).toBe('#15803d');
        });

        it('should clear a goal color when set to null', async () => {
            const created = await agent.post('/api/goals').send({
                title: 'Learn piano',
                horizon: 'year',
                status: 'active',
                color: '#b91c1c',
            });
            const uid = created.body.goal.uid;

            const response = await agent.patch(`/api/goals/${uid}`).send({
                color: null,
            });

            expect(response.status).toBe(200);
            expect(response.body.goal.color).toBeNull();
        });
    });
});
