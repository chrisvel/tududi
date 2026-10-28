const request = require('supertest');
const app = require('../../app');
const { Task, DailyPlan } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Task API today flag', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'todayflag@example.com',
            timezone: 'Europe/Athens',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'todayflag@example.com',
            password: 'password123',
        });
    });

    const planUids = async () => {
        const res = await agent.get('/api/daily-plan');
        return (res.body.plan?.items || []).map((item) => item.task_uid);
    };

    it('adds a new task to today when created with today: true', async () => {
        const res = await agent
            .post('/api/task')
            .send({ name: 'Call the bank', today: true });

        expect(res.status).toBe(201);
        expect(await planUids()).toEqual([res.body.uid]);
    });

    it('leaves today alone when created without the flag', async () => {
        const res = await agent.post('/api/task').send({ name: 'Someday' });

        expect(res.status).toBe(201);
        expect(await DailyPlan.count({ where: { user_id: user.id } })).toBe(0);
    });

    it('appends after tasks already planned and does not add twice', async () => {
        const first = await Task.create({ name: 'First', user_id: user.id });
        const second = await Task.create({ name: 'Second', user_id: user.id });
        await agent.put('/api/daily-plan/today').send({
            items: [{ task_uid: first.uid, start_minute: 540 }],
        });

        await agent.patch(`/api/task/${second.uid}`).send({ today: true });
        await agent.patch(`/api/task/${second.uid}`).send({ today: true });

        expect(await planUids()).toEqual([first.uid, second.uid]);
    });

    it('takes a task off today with today: false', async () => {
        const first = await Task.create({ name: 'First', user_id: user.id });
        const second = await Task.create({ name: 'Second', user_id: user.id });
        await agent.put('/api/daily-plan/today').send({
            items: [
                { task_uid: first.uid, start_minute: 540 },
                { task_uid: second.uid, start_minute: null },
            ],
        });

        const res = await agent
            .patch(`/api/task/${first.uid}`)
            .send({ today: false });

        expect(res.status).toBe(200);
        expect(await planUids()).toEqual([second.uid]);
    });

    it('does not create a plan when removing from an unplanned day', async () => {
        const task = await Task.create({ name: 'Loose', user_id: user.id });

        const res = await agent
            .patch(`/api/task/${task.uid}`)
            .send({ today: false });

        expect(res.status).toBe(200);
        expect(await DailyPlan.count({ where: { user_id: user.id } })).toBe(0);
    });
});
