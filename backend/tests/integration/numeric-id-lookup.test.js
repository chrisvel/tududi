const request = require('supertest');
const app = require('../../app');
const { Task, Project, Area } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Numeric id lookup on REST routes (#1552)', () => {
    let user;
    let other;
    let agent;

    beforeEach(async () => {
        user = await createTestUser({ email: `owner_${Date.now()}@test.com` });
        other = await createTestUser({ email: `other_${Date.now()}@test.com` });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('tasks', () => {
        it('gets a task by its numeric id', async () => {
            const task = await Task.create({ name: 'By id', user_id: user.id });

            const res = await agent.get(`/api/task/${task.id}`).expect(200);

            expect(res.body.uid).toBe(task.uid);
            expect(res.body.name).toBe('By id');
        });

        it('still gets a task by its uid', async () => {
            const task = await Task.create({
                name: 'By uid',
                user_id: user.id,
            });

            const res = await agent.get(`/api/task/${task.uid}`).expect(200);

            expect(res.body.id).toBe(task.id);
        });

        it('updates a task by its numeric id', async () => {
            const task = await Task.create({ name: 'Old', user_id: user.id });

            await agent
                .patch(`/api/task/${task.id}`)
                .send({ name: 'New' })
                .expect(200);

            await task.reload();
            expect(task.name).toBe('New');
        });

        it('resolves the numeric id on task sub-routes', async () => {
            const parent = await Task.create({ name: 'P', user_id: user.id });
            await Task.create({
                name: 'C',
                user_id: user.id,
                parent_task_id: parent.id,
            });

            const subtasks = await agent
                .get(`/api/task/${parent.id}/subtasks`)
                .expect(200);
            expect(subtasks.body).toHaveLength(1);

            await agent.get(`/api/task/${parent.id}/timeline`).expect(200);
        });

        it("does not reveal another user's task through its numeric id", async () => {
            const foreign = await Task.create({
                name: 'Private',
                user_id: other.id,
            });
            const missingId = foreign.id + 100000;

            const foreignRes = await agent.get(`/api/task/${foreign.id}`);
            const missingRes = await agent.get(`/api/task/${missingId}`);

            expect(foreignRes.status).toBe(missingRes.status);
            expect(foreignRes.body).toEqual(missingRes.body);
            expect(JSON.stringify(foreignRes.body)).not.toContain('Private');
        });

        it("cannot update another user's task through its numeric id", async () => {
            const foreign = await Task.create({
                name: 'Private',
                user_id: other.id,
            });

            const res = await agent
                .patch(`/api/task/${foreign.id}`)
                .send({ name: 'Hijacked' });

            expect(res.status).toBeGreaterThanOrEqual(400);
            await foreign.reload();
            expect(foreign.name).toBe('Private');
        });

        it('returns not found for a numeric id that does not exist', async () => {
            const res = await agent.get('/api/task/987654');

            expect(res.status).toBe(404);
        });
    });

    describe('projects', () => {
        it('gets a project by its numeric id', async () => {
            const project = await Project.create({
                name: 'Proj',
                user_id: user.id,
            });

            const res = await agent
                .get(`/api/project/${project.id}`)
                .expect(200);

            expect(res.body.uid).toBe(project.uid);
        });

        it('updates a project by its numeric id', async () => {
            const project = await Project.create({
                name: 'Old',
                user_id: user.id,
            });

            await agent
                .patch(`/api/project/${project.id}`)
                .send({ name: 'Renamed' })
                .expect(200);

            await project.reload();
            expect(project.name).toBe('Renamed');
        });

        it("does not reveal another user's project through its numeric id", async () => {
            const foreign = await Project.create({
                name: 'Secret',
                user_id: other.id,
            });

            const foreignRes = await agent.get(`/api/project/${foreign.id}`);
            const missingRes = await agent.get(
                `/api/project/${foreign.id + 100000}`
            );

            expect(foreignRes.status).toBe(missingRes.status);
            expect(JSON.stringify(foreignRes.body)).not.toContain('Secret');
        });
    });

    describe('areas', () => {
        it('gets an area by its numeric id', async () => {
            const area = await Area.create({ name: 'Home', user_id: user.id });

            const res = await agent.get(`/api/areas/${area.id}`).expect(200);

            expect(res.body.uid).toBe(area.uid);
        });

        it("does not reveal another user's area through its numeric id", async () => {
            const foreign = await Area.create({
                name: 'Secret area',
                user_id: other.id,
            });

            const foreignRes = await agent.get(`/api/areas/${foreign.id}`);
            const missingRes = await agent.get(
                `/api/areas/${foreign.id + 100000}`
            );

            expect(foreignRes.status).toBe(missingRes.status);
            expect(JSON.stringify(foreignRes.body)).not.toContain(
                'Secret area'
            );
        });
    });
});
