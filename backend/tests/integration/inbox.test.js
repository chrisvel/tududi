const request = require('supertest');
const app = require('../../app');
const { InboxItem, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Inbox Routes', () => {
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

    describe('POST /api/inbox', () => {
        it('should create a new inbox item', async () => {
            const inboxData = {
                content: 'Remember to buy groceries',
                source: 'web',
            };

            const response = await agent.post('/api/inbox').send(inboxData);

            expect(response.status).toBe(201);
            expect(response.body.content).toBe(inboxData.content);
            expect(response.body.source).toBe(inboxData.source);
            expect(response.body.status).toBe('added');
            expect(response.body.user_id).toBe(user.id);
        });

        it('should require authentication', async () => {
            const inboxData = {
                content: 'Test content',
            };

            const response = await request(app)
                .post('/api/inbox')
                .send(inboxData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require content', async () => {
            const inboxData = {};

            const response = await agent.post('/api/inbox').send(inboxData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Content is required');
        });
    });

    describe('GET /api/inbox', () => {
        let inboxItem1, inboxItem2;

        beforeEach(async () => {
            inboxItem1 = await InboxItem.create({
                content: 'First item',
                status: 'added',
                user_id: user.id,
            });

            inboxItem2 = await InboxItem.create({
                content: 'Second item',
                status: 'processed',
                user_id: user.id,
            });
        });

        it('should get all user inbox items', async () => {
            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1); // Only items with status 'added' are returned
            expect(response.body.map((i) => i.id)).toContain(inboxItem1.id);
        });

        it('should only return items with added status', async () => {
            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].id).toBe(inboxItem1.id);
            expect(response.body[0].status).toBe('added');
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/inbox');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/inbox/:id', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                user_id: user.id,
            });
        });

        it('should get inbox item by id', async () => {
            const response = await agent.get(`/api/inbox/${inboxItem.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(inboxItem.id);
            expect(response.body.content).toBe(inboxItem.content);
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent.get('/api/inbox/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it("should not allow access to other user's inbox items", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherInboxItem = await InboxItem.create({
                content: 'Other content',
                user_id: otherUser.id,
            });

            const response = await agent.get(`/api/inbox/${otherInboxItem.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(
                `/api/inbox/${inboxItem.id}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/inbox/:id', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                status: 'added',
                user_id: user.id,
            });
        });

        it('should update inbox item', async () => {
            const updateData = {
                content: 'Updated content',
                status: 'processed',
            };

            const response = await agent
                .patch(`/api/inbox/${inboxItem.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.content).toBe(updateData.content);
            expect(response.body.status).toBe(updateData.status);
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent
                .patch('/api/inbox/999999')
                .send({ content: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/inbox/${inboxItem.id}`)
                .send({ content: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/inbox/:id', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                user_id: user.id,
            });
        });

        it('should delete inbox item', async () => {
            const response = await agent.delete(`/api/inbox/${inboxItem.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe(
                'Inbox item successfully deleted'
            );

            // Verify inbox item status is updated to deleted
            const deletedItem = await InboxItem.findByPk(inboxItem.id);
            expect(deletedItem).not.toBeNull();
            expect(deletedItem.status).toBe('deleted');
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent.delete('/api/inbox/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(
                `/api/inbox/${inboxItem.id}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/inbox/:id/process', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                status: 'added',
                user_id: user.id,
            });
        });

        it('should process inbox item', async () => {
            const response = await agent.patch(
                `/api/inbox/${inboxItem.id}/process`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('processed');
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent.patch('/api/inbox/999999/process');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).patch(
                `/api/inbox/${inboxItem.id}/process`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
