const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

describe('Webhooks Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/webhooks', () => {
        it('creates an endpoint and returns the secret once', async () => {
            const response = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
                event_types: ['task_due_soon'],
            });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('My endpoint');
            expect(response.body.url).toBe('https://example.com/hook');
            expect(response.body.event_types).toEqual(['task_due_soon']);
            expect(response.body.active).toBe(true);
            expect(typeof response.body.secret).toBe('string');
            expect(response.body.secret.length).toBeGreaterThan(0);
            expect(response.body.secret_preview).toBe(
                `...${response.body.secret.slice(-4)}`
            );
        });

        it('requires authentication', async () => {
            const response = await request(app).post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
            });

            expect(response.status).toBe(401);
        });

        it('requires a name', async () => {
            const response = await agent
                .post('/api/webhooks')
                .send({ url: 'https://example.com/hook' });

            expect(response.status).toBe(400);
        });

        it('requires a valid http(s) URL', async () => {
            const response = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'not-a-url',
            });

            expect(response.status).toBe(400);
        });

        it('rejects unknown event types', async () => {
            const response = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
                event_types: ['not_a_real_type'],
            });

            expect(response.status).toBe(400);
        });

        it('accepts header auth and never echoes back auth_secret', async () => {
            const response = await agent.post('/api/webhooks').send({
                name: 'Authed endpoint',
                url: 'https://example.com/hook',
                auth_type: 'header',
                auth_header_name: 'Authorization',
                auth_secret: 'super-token',
            });

            expect(response.status).toBe(201);
            expect(response.body.auth_type).toBe('header');
            expect(response.body.auth_header_name).toBe('Authorization');
            expect(response.body.auth_configured).toBe(true);
            expect(response.body.auth_secret).toBeUndefined();
        });

        it('accepts basic auth and requires a username and secret', async () => {
            const missingUsername = await agent.post('/api/webhooks').send({
                name: 'Basic endpoint',
                url: 'https://example.com/hook',
                auth_type: 'basic',
                auth_secret: 'password',
            });
            expect(missingUsername.status).toBe(400);

            const response = await agent.post('/api/webhooks').send({
                name: 'Basic endpoint',
                url: 'https://example.com/hook',
                auth_type: 'basic',
                auth_username: 'alice',
                auth_secret: 'password',
            });
            expect(response.status).toBe(201);
            expect(response.body.auth_type).toBe('basic');
            expect(response.body.auth_username).toBe('alice');
            expect(response.body.auth_secret).toBeUndefined();
        });
    });

    describe('GET /api/webhooks', () => {
        it('lists endpoints without exposing the full secret', async () => {
            await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
            });

            const response = await agent.get('/api/webhooks');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(1);
            expect(response.body[0].secret).toBeUndefined();
            expect(response.body[0].secret_preview).toMatch(/^\.\.\./);
        });

        it("only returns the requesting user's endpoints", async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });
            const otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: 'other@example.com',
                password: 'password123',
            });
            await otherAgent
                .post('/api/webhooks')
                .send({ name: 'Other', url: 'https://example.com/other' });

            const response = await agent.get('/api/webhooks');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(0);
        });
    });

    describe('PATCH /api/webhooks/:uid', () => {
        it('updates name, url, event_types and active', async () => {
            const created = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
            });

            const response = await agent
                .patch(`/api/webhooks/${created.body.uid}`)
                .send({
                    name: 'Renamed',
                    active: false,
                    event_types: ['task_overdue'],
                });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Renamed');
            expect(response.body.active).toBe(false);
            expect(response.body.event_types).toEqual(['task_overdue']);
        });

        it("returns 404 for another user's endpoint", async () => {
            const created = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
            });

            const otherUser = await createTestUser({
                email: 'other2@example.com',
            });
            const otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: 'other2@example.com',
                password: 'password123',
            });

            const response = await otherAgent
                .patch(`/api/webhooks/${created.body.uid}`)
                .send({ name: 'Hijacked' });

            expect(response.status).toBe(404);
        });
    });

    describe('POST /api/webhooks/:uid/rotate-secret', () => {
        it('issues a new secret', async () => {
            const created = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
            });

            const response = await agent.post(
                `/api/webhooks/${created.body.uid}/rotate-secret`
            );

            expect(response.status).toBe(200);
            expect(response.body.secret).toBeDefined();
            expect(response.body.secret).not.toBe(created.body.secret);
        });
    });

    describe('DELETE /api/webhooks/:uid', () => {
        it('deletes the endpoint', async () => {
            const created = await agent.post('/api/webhooks').send({
                name: 'My endpoint',
                url: 'https://example.com/hook',
            });

            const deleteResponse = await agent.delete(
                `/api/webhooks/${created.body.uid}`
            );
            expect(deleteResponse.status).toBe(200);

            const listResponse = await agent.get('/api/webhooks');
            expect(listResponse.body).toHaveLength(0);
        });
    });
});
