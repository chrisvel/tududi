const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Deferred Planned Task - Status Preservation (#851)', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'deferred-planned@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'deferred-planned@example.com',
            password: 'password123',
        });
    });

    describe('PATCH /api/task/:uid - defer_until without status', () => {
        it('should preserve planned status when only defer_until is updated', async () => {
            const task = await Task.create({
                name: 'Planned Deferred Task',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
            });

            const tomorrow = new Date(
                Date.now() + 24 * 60 * 60 * 1000
            ).toISOString();

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ defer_until: tomorrow })
                .expect(200);

            // Status should be preserved as PLANNED (numeric 6)
            expect(response.body.status).toBe(Task.STATUS.PLANNED);

            // Verify in DB
            const updated = await Task.findByPk(task.id);
            expect(updated.status).toBe(Task.STATUS.PLANNED);
        });

        it('should preserve in_progress status when only defer_until is updated', async () => {
            const task = await Task.create({
                name: 'In Progress Deferred Task',
                user_id: user.id,
                status: Task.STATUS.IN_PROGRESS,
            });

            const tomorrow = new Date(
                Date.now() + 24 * 60 * 60 * 1000
            ).toISOString();

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ defer_until: tomorrow })
                .expect(200);

            expect(response.body.status).toBe(Task.STATUS.IN_PROGRESS);
        });

        it('should preserve waiting status when only note is updated', async () => {
            const task = await Task.create({
                name: 'Waiting Task',
                user_id: user.id,
                status: Task.STATUS.WAITING,
            });

            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ note: 'Updated note' })
                .expect(200);

            expect(response.body.status).toBe(Task.STATUS.WAITING);
        });
    });

    describe('GET /api/tasks?type=today&include_lists=true - defer_until filtering', () => {
        it('should exclude planned tasks with future defer_until from today plan', async () => {
            const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

            await Task.create({
                name: 'Future Deferred Planned',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                defer_until: futureDate,
            });

            await Task.create({
                name: 'Active Planned',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            expect(response.body.tasks_today_plan).toBeDefined();
            const names = response.body.tasks_today_plan.map((t) => t.name);
            expect(names).toContain('Active Planned');
            expect(names).not.toContain('Future Deferred Planned');
        });

        it('should include planned tasks whose defer_until has passed', async () => {
            const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

            await Task.create({
                name: 'Past Deferred Planned',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                defer_until: pastDate,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            const names = response.body.tasks_today_plan.map((t) => t.name);
            expect(names).toContain('Past Deferred Planned');
        });

        it('should include planned tasks with null defer_until', async () => {
            await Task.create({
                name: 'No Defer Planned',
                user_id: user.id,
                status: Task.STATUS.PLANNED,
                defer_until: null,
            });

            const response = await agent
                .get('/api/tasks?type=today&include_lists=true')
                .expect(200);

            const names = response.body.tasks_today_plan.map((t) => t.name);
            expect(names).toContain('No Defer Planned');
        });
    });
});
