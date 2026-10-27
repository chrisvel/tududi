const request = require('supertest');
const app = require('../../app');
const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Start date and time', () => {
    let agent;

    beforeEach(async () => {
        const user = await createTestUser({
            email: 'start-dates@example.com',
            timezone: 'Europe/Athens',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('tasks', () => {
        it('stores a whole-day start as the start of the local day', async () => {
            const res = await agent
                .post('/api/task')
                .send({ name: 'Paint the hall', start_date: '2026-11-02' });

            expect(res.status).toBe(201);
            expect(res.body.start_date).toBe('2026-11-02');
            expect(res.body.start_time).toBeNull();

            const row = await Task.findOne({ where: { uid: res.body.uid } });
            expect(row.start_has_time).toBe(false);
            expect(row.start_date.toISOString()).toBe(
                '2026-11-01T22:00:00.000Z'
            );
        });

        it('stores a timed start in the user timezone', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Call the movers',
                start_date: '2026-11-02',
                start_time: '09:30',
            });

            expect(res.status).toBe(201);
            expect(res.body.start_date).toBe('2026-11-02');
            expect(res.body.start_time).toBe('09:30');

            const row = await Task.findOne({ where: { uid: res.body.uid } });
            expect(row.start_has_time).toBe(true);
            expect(row.start_date.toISOString()).toBe(
                '2026-11-02T07:30:00.000Z'
            );
        });

        it('keeps the day when only the time changes and drops the time when only the day changes', async () => {
            const created = await agent.post('/api/task').send({
                name: 'Pack books',
                start_date: '2026-11-02',
                start_time: '09:30',
            });

            const timeOnly = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ start_time: '14:00' });
            expect(timeOnly.status).toBe(200);
            expect(timeOnly.body.start_date).toBe('2026-11-02');
            expect(timeOnly.body.start_time).toBe('14:00');

            const dayOnly = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ start_date: '2026-11-05' });
            expect(dayOnly.body.start_date).toBe('2026-11-05');
            expect(dayOnly.body.start_time).toBeNull();
        });

        it('clears the start', async () => {
            const created = await agent.post('/api/task').send({
                name: 'Clear me',
                start_date: '2026-11-02',
                start_time: '09:30',
            });

            const res = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ start_date: null });
            expect(res.status).toBe(200);
            expect(res.body.start_date).toBeNull();
            expect(res.body.start_time).toBeNull();
        });

        it('leaves the start alone when other fields change', async () => {
            const created = await agent.post('/api/task').send({
                name: 'Untouched',
                start_date: '2026-11-02',
                start_time: '09:30',
            });

            const res = await agent
                .patch(`/api/task/${created.body.uid}`)
                .send({ name: 'Renamed', due_date: '2026-11-09' });
            expect(res.body.start_date).toBe('2026-11-02');
            expect(res.body.start_time).toBe('09:30');
        });

        it('rejects a malformed start time', async () => {
            const res = await agent.post('/api/task').send({
                name: 'Bad time',
                start_date: '2026-11-02',
                start_time: '25:00',
            });
            expect(res.status).toBe(400);
        });
    });

    describe('projects', () => {
        it('creates, reads and updates a project start', async () => {
            const created = await agent.post('/api/project').send({
                name: 'Kitchen renovation',
                start_date: '2026-10-19',
                start_time: '08:00',
            });
            expect(created.status).toBe(201);
            expect(created.body.start_date).toBe('2026-10-19');
            expect(created.body.start_time).toBe('08:00');

            const row = await Project.findOne({
                where: { uid: created.body.uid },
            });
            expect(row.start_date_at.toISOString()).toBe(
                '2026-10-19T05:00:00.000Z'
            );
            expect(row.start_has_time).toBe(true);

            const fetched = await agent.get(`/api/project/${created.body.uid}`);
            expect(fetched.body.start_date).toBe('2026-10-19');
            expect(fetched.body.start_time).toBe('08:00');

            const listed = await agent.get('/api/projects');
            const projects = listed.body.projects || listed.body;
            const inList = projects.find((p) => p.uid === created.body.uid);
            expect(inList.start_date).toBe('2026-10-19');

            const updated = await agent
                .patch(`/api/project/${created.body.uid}`)
                .send({ start_date: '2026-10-21' });
            expect(updated.status).toBe(200);
            expect(updated.body.start_date).toBe('2026-10-21');
            expect(updated.body.start_time).toBeNull();

            const cleared = await agent
                .patch(`/api/project/${created.body.uid}`)
                .send({ start_date: '' });
            expect(cleared.body.start_date).toBeNull();
        });

        it('includes task starts on the project page', async () => {
            const project = await agent
                .post('/api/project')
                .send({ name: 'Garden' });
            await agent.post('/api/task').send({
                name: 'Plant bulbs',
                project_id: project.body.id,
                start_date: '2026-10-28',
                start_time: '10:00',
            });

            const fetched = await agent.get(`/api/project/${project.body.uid}`);
            const task = fetched.body.Tasks.find(
                (t) => t.name === 'Plant bulbs'
            );
            expect(task.start_date).toBe('2026-10-28');
            expect(task.start_time).toBe('10:00');
        });

        it('lists blocks links between the project tasks for the timeline', async () => {
            const project = await agent
                .post('/api/project')
                .send({ name: 'Move flat' });
            const lease = await agent.post('/api/task').send({
                name: 'Sign lease',
                project_id: project.body.id,
            });
            const movers = await agent.post('/api/task').send({
                name: 'Book movers',
                project_id: project.body.id,
            });
            const linked = await agent
                .post(`/api/task/${lease.body.uid}/relations`)
                .send({ target_uid: movers.body.uid, type: 'blocks' });
            expect(linked.status).toBe(201);

            const fetched = await agent.get(`/api/project/${project.body.uid}`);
            expect(fetched.body.task_links).toEqual([
                { from_uid: lease.body.uid, to_uid: movers.body.uid },
            ]);
        });

        it('rejects a malformed project start date', async () => {
            const res = await agent
                .post('/api/project')
                .send({ name: 'Bad', start_date: '2026-13-40' });
            expect(res.status).toBe(400);
        });
    });
});
