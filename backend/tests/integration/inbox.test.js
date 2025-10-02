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
            expect(response.body.uid).toBeDefined();
            expect(typeof response.body.uid).toBe('string');
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
                source: 'test',
                user_id: user.id,
            });

            inboxItem2 = await InboxItem.create({
                content: 'Second item',
                status: 'processed',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should get all user inbox items', async () => {
            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1); // Only items with status 'added' are returned
            expect(response.body.map((i) => i.uid)).toContain(inboxItem1.uid);
        });

        it('should only return items with added status', async () => {
            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].uid).toBe(inboxItem1.uid);
            expect(response.body[0].status).toBe('added');
        });

        it('should return inbox items ordered by created_at DESC (newest first)', async () => {
            // Create additional items with slight delay to ensure different timestamps
            const item1 = await InboxItem.create({
                content: 'First item (oldest)',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            // Small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 10));

            const item2 = await InboxItem.create({
                content: 'Second item',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            await new Promise((resolve) => setTimeout(resolve, 10));

            const item3 = await InboxItem.create({
                content: 'Third item (newest)',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(4); // Including the item from beforeEach

            // Check that items are ordered by newest first
            expect(response.body[0].uid).toBe(item3.uid);
            expect(response.body[1].uid).toBe(item2.uid);
            expect(response.body[2].uid).toBe(item1.uid);

            // Verify the content matches expected order
            expect(response.body[0].content).toBe('Third item (newest)');
            expect(response.body[1].content).toBe('Second item');
            expect(response.body[2].content).toBe('First item (oldest)');
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/inbox');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/inbox/:uid', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should get inbox item by uid', async () => {
            const response = await agent.get(`/api/inbox/${inboxItem.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.uid).toBe(inboxItem.uid);
            expect(response.body.content).toBe(inboxItem.content);
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent.get('/api/inbox/invalid-uid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent.get('/api/inbox/abcd1234efghijk');

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
                source: 'test',
                user_id: otherUser.id,
            });

            const response = await agent.get(
                `/api/inbox/${otherInboxItem.uid}`
            );

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(
                `/api/inbox/${inboxItem.uid}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/inbox/:uid', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should update inbox item', async () => {
            const updateData = {
                content: 'Updated content',
                status: 'processed',
            };

            const response = await agent
                .patch(`/api/inbox/${inboxItem.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.content).toBe(updateData.content);
            expect(response.body.status).toBe(updateData.status);
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent
                .patch('/api/inbox/invalid-uid')
                .send({ content: 'Updated' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent
                .patch('/api/inbox/abcd1234efghijk')
                .send({ content: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/inbox/${inboxItem.uid}`)
                .send({ content: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/inbox/:uid', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should delete inbox item', async () => {
            const response = await agent.delete(`/api/inbox/${inboxItem.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe(
                'Inbox item successfully deleted'
            );

            // Verify inbox item status is updated to deleted
            const deletedItem = await InboxItem.findOne({
                where: { uid: inboxItem.uid },
            });
            expect(deletedItem).not.toBeNull();
            expect(deletedItem.status).toBe('deleted');
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent.delete('/api/inbox/invalid-uid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent.delete('/api/inbox/abcd1234efghijk');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(
                `/api/inbox/${inboxItem.uid}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/inbox/:uid/process', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Test content',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should process inbox item', async () => {
            const response = await agent.patch(
                `/api/inbox/${inboxItem.uid}/process`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('processed');
        });

        it('should return 404 for non-existent inbox item', async () => {
            const response = await agent.patch(
                '/api/inbox/invalid-uid/process'
            );

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent item', async () => {
            const response = await agent.patch(
                '/api/inbox/abcd1234efghijk/process'
            );

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Inbox item not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).patch(
                `/api/inbox/${inboxItem.uid}/process`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
