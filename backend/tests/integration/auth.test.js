const request = require('supertest');
const app = require('../../app');
const { User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Auth Routes', () => {
    describe('POST /api/login', () => {
        let user;

        beforeEach(async () => {
            user = await createTestUser({
                email: 'test@example.com',
            });
        });

        it('should login with valid credentials', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'test@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(200);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.user.id).toBe(user.id);
            expect(response.body.user.language).toBe('en');
            expect(response.body.user.appearance).toBe('light');
            expect(response.body.user.timezone).toBe('UTC');
        });

        it('should return 400 for missing email', async () => {
            const response = await request(app).post('/api/login').send({
                password: 'password123',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid login parameters.');
        });

        it('should return 400 for missing password', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'test@example.com',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid login parameters.');
        });

        it('should return 401 for non-existent user', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'nonexistent@example.com',
                password: 'password123',
            });

            expect(response.status).toBe(401);
            expect(response.body.errors).toEqual(['Invalid credentials']);
        });

        it('should return 401 for invalid password', async () => {
            const response = await request(app).post('/api/login').send({
                email: 'test@example.com',
                password: 'wrongpassword',
            });

            expect(response.status).toBe(401);
            expect(response.body.errors).toEqual(['Invalid credentials']);
        });
    });

    describe('GET /api/current_user', () => {
        let user;

        beforeEach(async () => {
            user = await createTestUser({
                email: 'test@example.com',
            });
        });

        it('should return current user when logged in', async () => {
            const agent = request.agent(app);

            // Login first
            await agent.post('/api/login').send({
                email: 'test@example.com',
                password: 'password123',
            });

            // Check current user
            const response = await agent.get('/api/current_user');

            expect(response.status).toBe(200);
            expect(response.body.user).toBeDefined();
            expect(response.body.user.email).toBe('test@example.com');
            expect(response.body.user.id).toBe(user.id);
        });

        it('should return null user when not logged in', async () => {
            const response = await request(app).get('/api/current_user');

            expect(response.status).toBe(200);
            expect(response.body.user).toBeNull();
        });
    });

    describe('GET /api/logout', () => {
        let user;

        beforeEach(async () => {
            user = await createTestUser({
                email: 'test@example.com',
            });
        });

        it('should logout successfully', async () => {
            const agent = request.agent(app);

            // Login first
            await agent.post('/api/login').send({
                email: 'test@example.com',
                password: 'password123',
            });

            // Logout
            const response = await agent.get('/api/logout');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Logged out successfully');

            // Verify user is logged out
            const currentUserResponse = await agent.get('/api/current_user');
            expect(currentUserResponse.body.user).toBeNull();
        });

        it('should handle logout when not logged in', async () => {
            const response = await request(app).get('/api/logout');

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Logged out successfully');
        });
    });
});
