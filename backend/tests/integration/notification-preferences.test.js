const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Notification Preferences', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: `test_${Date.now()}@example.com`,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });
    });

    describe('GET /api/profile - notification_preferences', () => {
        it('should include notification_preferences in profile response', async () => {
            const response = await agent.get('/api/profile');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('notification_preferences');
        });

        it('should return default notification_preferences for new users', async () => {
            const response = await agent.get('/api/profile');

            expect(response.status).toBe(200);
            expect(response.body.notification_preferences).toEqual({
                dueTasks: { inApp: true, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: true, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            });
        });

        it('should return saved notification_preferences', async () => {
            const preferences = {
                dueTasks: { inApp: false, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: false, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            };

            await User.update(
                { notification_preferences: preferences },
                { where: { id: user.id } }
            );

            const response = await agent.get('/api/profile');

            expect(response.status).toBe(200);
            expect(response.body.notification_preferences).toEqual(preferences);
        });
    });

    describe('PATCH /api/profile - notification_preferences', () => {
        it('should update notification preferences', async () => {
            const preferences = {
                dueTasks: { inApp: false, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: false, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            };

            const response = await agent
                .patch('/api/profile')
                .send({ notification_preferences: preferences });

            expect(response.status).toBe(200);
            expect(response.body.notification_preferences).toEqual(preferences);

            // Verify it was saved to database
            const updatedUser = await User.findByPk(user.id);
            expect(updatedUser.notification_preferences).toEqual(preferences);
        });

        it('should allow partial notification preference updates', async () => {
            // Set initial preferences
            const initialPreferences = {
                dueTasks: { inApp: true, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: true, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            };

            await agent
                .patch('/api/profile')
                .send({ notification_preferences: initialPreferences });

            // Update only some types
            const updatedPreferences = {
                dueTasks: { inApp: false, email: false, push: false },
                overdueTasks: { inApp: false, email: false, push: false },
                dueProjects: { inApp: true, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            };

            const response = await agent
                .patch('/api/profile')
                .send({ notification_preferences: updatedPreferences });

            expect(response.status).toBe(200);
            expect(response.body.notification_preferences).toEqual(
                updatedPreferences
            );
        });

        it('should allow setting preferences to null', async () => {
            // First set some preferences
            await agent.patch('/api/profile').send({
                notification_preferences: {
                    dueTasks: { inApp: false, email: false, push: false },
                    overdueTasks: { inApp: true, email: false, push: false },
                    dueProjects: { inApp: false, email: false, push: false },
                    overdueProjects: { inApp: true, email: false, push: false },
                    deferUntil: { inApp: true, email: false, push: false },
                },
            });

            // Then set to null
            const response = await agent
                .patch('/api/profile')
                .send({ notification_preferences: null });

            expect(response.status).toBe(200);
            expect(response.body.notification_preferences).toBeNull();
        });

        it('should not affect other profile fields', async () => {
            const preferences = {
                dueTasks: { inApp: false, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: false, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            };

            const response = await agent
                .patch('/api/profile')
                .send({ notification_preferences: preferences });

            expect(response.status).toBe(200);
            expect(response.body.email).toBe(user.email);
            expect(response.body.appearance).toBe(user.appearance);
            expect(response.body.language).toBe(user.language);
        });

        it('should require authentication', async () => {
            const preferences = {
                dueTasks: { inApp: false, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: false, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            };

            const response = await request(app)
                .patch('/api/profile')
                .send({ notification_preferences: preferences });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should work with other profile updates in same request', async () => {
            const updateData = {
                appearance: 'dark',
                language: 'es',
                notification_preferences: {
                    dueTasks: { inApp: false, email: false, push: false },
                    overdueTasks: { inApp: true, email: false, push: false },
                    dueProjects: { inApp: false, email: false, push: false },
                    overdueProjects: { inApp: true, email: false, push: false },
                    deferUntil: { inApp: true, email: false, push: false },
                },
            };

            const response = await agent.patch('/api/profile').send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.appearance).toBe('dark');
            expect(response.body.language).toBe('es');
            expect(response.body.notification_preferences).toEqual(
                updateData.notification_preferences
            );
        });
    });
});
