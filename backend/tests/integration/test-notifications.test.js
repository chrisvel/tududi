const request = require('supertest');
const app = require('../../app');
const { Notification } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Test Notifications API', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `test_${Date.now()}@example.com`,
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('POST /api/test-notifications/trigger', () => {
        it('should create test notification for task_due_soon', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('notification');
            expect(response.body.notification).toHaveProperty('id');
            expect(response.body.notification).toHaveProperty('type');
            expect(response.body.notification).toHaveProperty('title');
            expect(response.body.notification).toHaveProperty('message');
            expect(response.body.notification).toHaveProperty('sources');
            expect(response.body.notification.title).toContain('Test:');
        });

        it('should create test notification for task_overdue', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_overdue' });

            expect(response.status).toBe(200);
            expect(response.body.notification.title).toContain('Overdue');
        });

        it('should create test notification for defer_until', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'defer_until' });

            expect(response.status).toBe(200);
            expect(response.body.notification.title).toContain('Now Active');
        });

        it('should create test notification for project_due_soon', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'project_due_soon' });

            expect(response.status).toBe(200);
            expect(response.body.notification.title).toContain('Project');
        });

        it('should create test notification for project_overdue', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'project_overdue' });

            expect(response.status).toBe(200);
            expect(response.body.notification.title).toContain('Project');
            expect(response.body.notification.title).toContain('Overdue');
        });

        it('should return 400 if type is missing', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Notification type is required');
        });

        it('should return 500 for invalid type', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'invalid_type' });

            expect(response.status).toBe(500);
            expect(response.body.error).toContain('Invalid test type');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should actually create notification in database', async () => {
            const beforeCount = await Notification.count({
                where: { user_id: user.id },
            });

            await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            const afterCount = await Notification.count({
                where: { user_id: user.id },
            });

            expect(afterCount).toBe(beforeCount + 1);
        });

        it('should include telegram in sources if telegram is configured', async () => {
            await user.update({
                telegram_bot_token: 'test-token',
                telegram_chat_id: '123456',
                notification_preferences: {
                    dueTasks: {
                        inApp: true,
                        telegram: true,
                        email: false,
                        push: false,
                    },
                },
            });

            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(200);
            expect(response.body.notification.sources).toContain('telegram');
        });

        it('should not include telegram in sources if not configured', async () => {
            const response = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(response.status).toBe(200);
            expect(response.body.notification.sources).not.toContain('telegram');
        });
    });
});
