const request = require('supertest');
const app = require('../../app');
const { User, ApiToken, Task, Project, Note } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('API Token Authentication', () => {
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

    describe('POST /api/profile/api-keys - Create API Key', () => {
        it('should create a new API key', async () => {
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Test API Key',
            });

            expect(response.status).toBe(201);
            expect(response.body.token).toBeDefined();
            expect(response.body.token).toMatch(/^tt_[a-zA-Z0-9]{64}$/);
            expect(response.body.apiKey).toBeDefined();
            expect(response.body.apiKey.name).toBe('Test API Key');
            expect(response.body.apiKey.token_prefix).toBeDefined();
            expect(response.body.apiKey.created_at).toBeDefined();
            expect(response.body.apiKey).not.toHaveProperty('token_hash');

            // Save for later tests
            rawToken = response.body.token;
        });

        it('should create API key with expiration date', async () => {
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Expiring Key',
                expires_at: expiresAt.toISOString(),
            });

            expect(response.status).toBe(201);
            expect(response.body.apiKey.expires_at).toBeDefined();
            expect(new Date(response.body.apiKey.expires_at)).toEqual(
                expiresAt
            );
        });

        it('should reject API key creation without name', async () => {
            const response = await agent.post('/api/profile/api-keys').send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('API key name is required.');
        });

        it('should reject invalid expiration date', async () => {
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Test Key',
                expires_at: 'invalid-date',
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe(
                'expires_at must be a valid date.'
            );
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/profile/api-keys')
                .send({
                    name: 'Test Key',
                });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/profile/api-keys - List API Keys', () => {
        beforeEach(async () => {
            // Create a few API keys
            await agent.post('/api/profile/api-keys').send({
                name: 'Key 1',
            });
            await agent.post('/api/profile/api-keys').send({
                name: 'Key 2',
            });
        });

        it('should list all API keys for the user', async () => {
            const response = await agent.get('/api/profile/api-keys');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
            expect(response.body[0]).toHaveProperty('name');
            expect(response.body[0]).toHaveProperty('token_prefix');
            expect(response.body[0]).toHaveProperty('created_at');
            expect(response.body[0]).not.toHaveProperty('token_hash');
        });

        it('should not show other users API keys', async () => {
            // Create another user with API key
            const otherUser = await createTestUser({
                email: `other_${Date.now()}@example.com`,
            });
            const otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: otherUser.email,
                password: 'password123',
            });
            await otherAgent.post('/api/profile/api-keys').send({
                name: 'Other User Key',
            });

            // Check that current user doesn't see other user's keys
            const response = await agent.get('/api/profile/api-keys');
            const hasOtherUserKey = response.body.some(
                (key) => key.name === 'Other User Key'
            );
            expect(hasOtherUserKey).toBe(false);
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/profile/api-keys');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('Bearer Token Authentication', () => {
        beforeEach(async () => {
            // Create an API token
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Test Token',
            });
            rawToken = response.body.token;
        });

        describe('Tasks API with Bearer Token', () => {
            it('should authenticate GET /api/tasks with Bearer token', async () => {
                const response = await request(app)
                    .get('/api/tasks')
                    .set('Authorization', `Bearer ${rawToken}`);

                expect(response.status).toBe(200);
                expect(response.body.tasks).toBeDefined();
            });

            it('should authenticate POST /api/task with Bearer token', async () => {
                const response = await request(app)
                    .post('/api/task')
                    .set('Authorization', `Bearer ${rawToken}`)
                    .send({
                        name: 'Test Task via API',
                        status: 'pending',
                    });

                expect(response.status).toBe(201);
                expect(response.body.name).toBe('Test Task via API');
            });

            it('should reject invalid Bearer token', async () => {
                const response = await request(app)
                    .get('/api/tasks')
                    .set('Authorization', 'Bearer invalid_token_123');

                expect(response.status).toBe(401);
            });

            it('should reject request without Bearer token', async () => {
                const response = await request(app).get('/api/tasks');

                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            });
        });

        describe('Projects API with Bearer Token', () => {
            it('should authenticate GET /api/projects with Bearer token', async () => {
                const response = await request(app)
                    .get('/api/projects')
                    .set('Authorization', `Bearer ${rawToken}`);

                expect(response.status).toBe(200);
                // Response can be either array or object with projects array
                expect(
                    Array.isArray(response.body) ||
                        Array.isArray(response.body.projects)
                ).toBe(true);
            });

            it('should authenticate POST /api/project with Bearer token', async () => {
                const response = await request(app)
                    .post('/api/project')
                    .set('Authorization', `Bearer ${rawToken}`)
                    .send({
                        name: 'Test Project via API',
                        description: 'Created with API token',
                    });

                expect(response.status).toBe(201);
                expect(response.body.name).toBe('Test Project via API');
            });
        });

        describe('Notes API with Bearer Token', () => {
            it('should authenticate GET /api/notes with Bearer token', async () => {
                const response = await request(app)
                    .get('/api/notes')
                    .set('Authorization', `Bearer ${rawToken}`);

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });

            it('should authenticate POST /api/note with Bearer token', async () => {
                const response = await request(app)
                    .post('/api/note')
                    .set('Authorization', `Bearer ${rawToken}`)
                    .send({
                        title: 'Test Note via API',
                        content: 'Created with API token',
                    });

                expect(response.status).toBe(201);
                expect(response.body.title).toBe('Test Note via API');
            });
        });

        describe('Inbox API with Bearer Token', () => {
            it('should authenticate GET /api/inbox with Bearer token', async () => {
                const response = await request(app)
                    .get('/api/inbox')
                    .set('Authorization', `Bearer ${rawToken}`);

                expect(response.status).toBe(200);
                expect(Array.isArray(response.body)).toBe(true);
            });

            it('should authenticate POST /api/inbox with Bearer token', async () => {
                const response = await request(app)
                    .post('/api/inbox')
                    .set('Authorization', `Bearer ${rawToken}`)
                    .send({
                        content: 'Quick capture via API',
                    });

                expect(response.status).toBe(201);
                expect(response.body.content).toBe('Quick capture via API');
            });
        });

        describe('Profile API with Bearer Token', () => {
            it('should authenticate GET /api/profile with Bearer token', async () => {
                const response = await request(app)
                    .get('/api/profile')
                    .set('Authorization', `Bearer ${rawToken}`);

                expect(response.status).toBe(200);
                expect(response.body.uid).toBe(user.uid);
                expect(response.body.email).toBe(user.email);
            });

            it('should authenticate PATCH /api/profile with Bearer token', async () => {
                const response = await request(app)
                    .patch('/api/profile')
                    .set('Authorization', `Bearer ${rawToken}`)
                    .send({
                        appearance: 'dark',
                    });

                expect(response.status).toBe(200);
                expect(response.body.appearance).toBe('dark');
            });
        });

        it('should update last_used_at when using API token', async () => {
            // Wait a moment to ensure timestamp difference
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Use the token
            await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${rawToken}`);

            // Check that last_used_at was updated
            const tokensAfter = await agent.get('/api/profile/api-keys');
            const tokenAfter = tokensAfter.body.find(
                (t) => t.name === 'Test Token'
            );

            // Verify last_used_at is set and is a recent timestamp
            expect(tokenAfter.last_used_at).toBeDefined();
            const lastUsedDate = new Date(tokenAfter.last_used_at);
            const now = new Date();
            expect(lastUsedDate.getTime()).toBeLessThanOrEqual(now.getTime());
            // Should be within the last minute
            expect(now.getTime() - lastUsedDate.getTime()).toBeLessThan(
                60 * 1000
            );
        });
    });

    describe('POST /api/profile/api-keys/:id/revoke - Revoke API Key', () => {
        let revokeToken, revokeApiToken;

        beforeEach(async () => {
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Key to Revoke',
            });
            if (response.status === 201 && response.body.apiKey) {
                revokeApiToken = response.body.apiKey;
                revokeToken = response.body.token;
            }
        });

        it('should revoke an API key', async () => {
            const response = await agent.post(
                `/api/profile/api-keys/${revokeApiToken.id}/revoke`
            );

            expect(response.status).toBe(200);
            expect(response.body.revoked_at).toBeDefined();
            expect(new Date(response.body.revoked_at)).toBeInstanceOf(Date);
        });

        it('should prevent using revoked token', async () => {
            // Revoke the token
            await agent.post(
                `/api/profile/api-keys/${revokeApiToken.id}/revoke`
            );

            // Try to use revoked token
            const response = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${revokeToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/revoked|invalid/i);
        });

        it('should return 404 for non-existent API key', async () => {
            const response = await agent.post(
                '/api/profile/api-keys/99999/revoke'
            );

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('API key not found.');
        });

        it('should not allow revoking other users API keys', async () => {
            // Create another user with API key
            const otherUser = await createTestUser({
                email: `other_${Date.now()}@example.com`,
            });
            const otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: otherUser.email,
                password: 'password123',
            });
            const otherKeyResponse = await otherAgent
                .post('/api/profile/api-keys')
                .send({
                    name: 'Other User Key',
                });

            // Try to revoke other user's key
            const response = await agent.post(
                `/api/profile/api-keys/${otherKeyResponse.body.apiKey.id}/revoke`
            );

            expect(response.status).toBe(404);
        });

        it('should require authentication', async () => {
            const response = await request(app).post(
                `/api/profile/api-keys/${revokeApiToken.id}/revoke`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/profile/api-keys/:id - Delete API Key', () => {
        let deleteToken, deleteApiToken;

        beforeEach(async () => {
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Key to Delete',
            });
            if (response.status === 201 && response.body.apiKey) {
                deleteApiToken = response.body.apiKey;
                deleteToken = response.body.token;
            }
        });

        it('should delete an API key', async () => {
            const response = await agent.delete(
                `/api/profile/api-keys/${deleteApiToken.id}`
            );

            expect(response.status).toBe(204);

            // Verify key is deleted
            const listResponse = await agent.get('/api/profile/api-keys');
            const deletedKey = listResponse.body.find(
                (k) => k.id === deleteApiToken.id
            );
            expect(deletedKey).toBeUndefined();
        });

        it('should prevent using deleted token', async () => {
            // Delete the token
            await agent.delete(`/api/profile/api-keys/${deleteApiToken.id}`);

            // Try to use deleted token
            const response = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${deleteToken}`);

            expect(response.status).toBe(401);
        });

        it('should return 404 for non-existent API key', async () => {
            const response = await agent.delete('/api/profile/api-keys/99999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('API key not found.');
        });

        it('should not allow deleting other users API keys', async () => {
            // Create another user with API key
            const otherUser = await createTestUser({
                email: `other_${Date.now()}@example.com`,
            });
            const otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: otherUser.email,
                password: 'password123',
            });
            const otherKeyResponse = await otherAgent
                .post('/api/profile/api-keys')
                .send({
                    name: 'Other User Key',
                });

            // Try to delete other user's key
            const response = await agent.delete(
                `/api/profile/api-keys/${otherKeyResponse.body.apiKey.id}`
            );

            expect(response.status).toBe(404);
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(
                `/api/profile/api-keys/${deleteApiToken.id}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('Expired Token Handling', () => {
        let expiredToken;

        beforeEach(async () => {
            // Create a token that expires in 1 second
            const expiresAt = new Date(Date.now() + 1000);
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Expiring Soon',
                expires_at: expiresAt.toISOString(),
            });
            expiredToken = response.body.token;
        });

        it('should reject expired token', async () => {
            // Wait for token to expire
            await new Promise((resolve) => setTimeout(resolve, 1500));

            const response = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toMatch(/expired|invalid/i);
        });
    });

    describe('Token Security', () => {
        it('should not expose token hash in API responses', async () => {
            const createResponse = await agent
                .post('/api/profile/api-keys')
                .send({
                    name: 'Security Test',
                });

            expect(createResponse.body.apiKey).not.toHaveProperty('token_hash');

            const listResponse = await agent.get('/api/profile/api-keys');
            listResponse.body.forEach((key) => {
                expect(key).not.toHaveProperty('token_hash');
            });
        });

        it('should only return full token once during creation', async () => {
            const createResponse = await agent
                .post('/api/profile/api-keys')
                .send({
                    name: 'One Time Token',
                });

            expect(createResponse.body.token).toBeDefined();
            expect(createResponse.body.token).toMatch(/^tt_[a-zA-Z0-9]{64}$/);

            // Token should not appear in list
            const listResponse = await agent.get('/api/profile/api-keys');
            listResponse.body.forEach((key) => {
                expect(key).not.toHaveProperty('token');
            });
        });

        it('should use different token prefix than session cookies', async () => {
            const response = await agent.post('/api/profile/api-keys').send({
                name: 'Prefix Test',
            });

            expect(response.body.token).toMatch(/^tt_/);
            expect(response.body.token).not.toMatch(/^connect\.sid/);
        });
    });
});
