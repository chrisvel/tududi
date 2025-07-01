const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Users Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/profile', () => {
        it('should get user profile', async () => {
            const response = await agent.get('/api/profile');

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(user.id);
            expect(response.body.email).toBe(user.email);
            expect(response.body).toHaveProperty('appearance');
            expect(response.body).toHaveProperty('language');
            expect(response.body).toHaveProperty('timezone');
            expect(response.body).toHaveProperty('avatar_image');
            expect(response.body).toHaveProperty('telegram_bot_token');
            expect(response.body).toHaveProperty('telegram_chat_id');
            expect(response.body).toHaveProperty('task_summary_enabled');
            expect(response.body).toHaveProperty('task_summary_frequency');
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/profile');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should return 401 when session user no longer exists', async () => {
            await User.destroy({ where: { id: user.id } });

            const response = await agent.get('/api/profile');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('PATCH /api/profile', () => {
        it('should update user profile', async () => {
            const updateData = {
                appearance: 'dark',
                language: 'es',
                timezone: 'UTC',
                avatar_image: 'new-avatar.png',
                telegram_bot_token: 'new-token',
            };

            const response = await agent.patch('/api/profile').send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.appearance).toBe(updateData.appearance);
            expect(response.body.language).toBe(updateData.language);
            expect(response.body.timezone).toBe(updateData.timezone);
            expect(response.body.avatar_image).toBe(updateData.avatar_image);
            expect(response.body.telegram_bot_token).toBe(
                updateData.telegram_bot_token
            );
        });

        it('should allow partial updates', async () => {
            const updateData = {
                appearance: 'dark',
            };

            const response = await agent.patch('/api/profile').send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.appearance).toBe(updateData.appearance);
            expect(response.body.language).toBe(user.language);
        });

        it('should require authentication', async () => {
            const updateData = {
                appearance: 'dark',
            };

            const response = await request(app)
                .patch('/api/profile')
                .send(updateData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should return 401 when session user no longer exists', async () => {
            await User.destroy({ where: { id: user.id } });

            const response = await agent
                .patch('/api/profile')
                .send({ appearance: 'dark' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('POST /api/profile/task-summary/toggle', () => {
        beforeEach(async () => {
            await user.update({ task_summary_enabled: false });
        });

        it('should toggle task summary on', async () => {
            const response = await agent.post(
                '/api/profile/task-summary/toggle'
            );

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.enabled).toBe(true);
            expect(response.body.message).toBe(
                'Task summary notifications have been enabled.'
            );
        });

        it('should toggle task summary off', async () => {
            await user.update({ task_summary_enabled: true });

            const response = await agent.post(
                '/api/profile/task-summary/toggle'
            );

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.enabled).toBe(false);
            expect(response.body.message).toBe(
                'Task summary notifications have been disabled.'
            );
        });

        it('should require authentication', async () => {
            const response = await request(app).post(
                '/api/profile/task-summary/toggle'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should return 401 when session user no longer exists', async () => {
            await User.destroy({ where: { id: user.id } });

            const response = await agent.post(
                '/api/profile/task-summary/toggle'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('POST /api/profile/task-summary/frequency', () => {
        it('should update task summary frequency', async () => {
            const response = await agent
                .post('/api/profile/task-summary/frequency')
                .send({ frequency: 'daily' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.frequency).toBe('daily');
            expect(response.body.message).toBe(
                'Task summary frequency has been set to daily.'
            );
        });

        it('should require frequency parameter', async () => {
            const response = await agent
                .post('/api/profile/task-summary/frequency')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Frequency is required.');
        });

        it('should validate frequency value', async () => {
            const response = await agent
                .post('/api/profile/task-summary/frequency')
                .send({ frequency: 'invalid' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid frequency value.');
        });

        it('should accept valid frequencies', async () => {
            const validFrequencies = [
                'daily',
                'weekdays',
                'weekly',
                '1h',
                '2h',
                '4h',
                '8h',
                '12h',
            ];

            for (const frequency of validFrequencies) {
                const response = await agent
                    .post('/api/profile/task-summary/frequency')
                    .send({ frequency });

                expect(response.status).toBe(200);
                expect(response.body.frequency).toBe(frequency);
            }
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/profile/task-summary/frequency')
                .send({ frequency: 'daily' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should return 401 when session user no longer exists', async () => {
            await User.destroy({ where: { id: user.id } });

            const response = await agent
                .post('/api/profile/task-summary/frequency')
                .send({ frequency: 'daily' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('POST /api/profile/task-summary/send-now', () => {
        it('should require telegram configuration', async () => {
            const response = await agent.post(
                '/api/profile/task-summary/send-now'
            );

            expect(response.status).toBe(400);
            expect(response.body.error).toBe(
                'Telegram bot is not properly configured.'
            );
        });

        it('should require authentication', async () => {
            const response = await request(app).post(
                '/api/profile/task-summary/send-now'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should return 401 when session user no longer exists', async () => {
            await User.destroy({ where: { id: user.id } });

            const response = await agent.post(
                '/api/profile/task-summary/send-now'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('User not found');
        });
    });

    describe('GET /api/profile/task-summary/status', () => {
        it('should get task summary status', async () => {
            await user.update({
                task_summary_enabled: true,
                task_summary_frequency: 'daily',
            });

            const response = await agent.get(
                '/api/profile/task-summary/status'
            );

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.enabled).toBe(true);
            expect(response.body.frequency).toBe('daily');
            expect(response.body).toHaveProperty('last_run');
            expect(response.body).toHaveProperty('next_run');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(
                '/api/profile/task-summary/status'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should return 401 when session user no longer exists', async () => {
            await User.destroy({ where: { id: user.id } });

            const response = await agent.get(
                '/api/profile/task-summary/status'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('User not found');
        });
    });
});
