const request = require('supertest');
const app = require('../../app');
const { InboxItem, Tag } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Inbox Routes - No Tags Scenario', () => {
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

        // Ensure no tags exist for this user (clean slate)
        await Tag.destroy({ where: { user_id: user.id } });
    });

    describe('GET /api/inbox - No Tags Scenario', () => {
        it('should return empty inbox when no items exist and no tags exist', async () => {
            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        it('should return inbox items even when no tags exist in system', async () => {
            // Create inbox items without any tags in the system
            const inboxItem1 = await InboxItem.create({
                content: 'Test item without tags',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            const inboxItem2 = await InboxItem.create({
                content: 'Another item without tags',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);
            expect(response.body.map((item) => item.uid)).toContain(
                inboxItem1.uid
            );
            expect(response.body.map((item) => item.uid)).toContain(
                inboxItem2.uid
            );
            expect(response.body[0].content).toBeDefined();
            expect(response.body[0].status).toBe('added');
            expect(response.body[0].uid).toBeDefined();
            expect(typeof response.body[0].uid).toBe('string');
        });

        it('should handle mixed inbox items when no tags exist', async () => {
            // Create inbox items with different statuses
            const addedItem = await InboxItem.create({
                content: 'Added item',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            await InboxItem.create({
                content: 'Processed item',
                status: 'processed',
                source: 'test',
                user_id: user.id,
            });

            await InboxItem.create({
                content: 'Deleted item',
                status: 'deleted',
                source: 'test',
                user_id: user.id,
            });

            const response = await agent.get('/api/inbox');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1); // Only 'added' items should be returned
            expect(response.body[0].uid).toBe(addedItem.uid);
            expect(response.body[0].status).toBe('added');
        });
    });

    describe('GET /api/tags - No Tags Scenario', () => {
        it('should return empty array when no tags exist', async () => {
            const response = await agent.get('/api/tags');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(0);
        });

        it('should not affect inbox functionality when tags endpoint returns empty', async () => {
            // Create inbox item
            await InboxItem.create({
                content: 'Test item',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });

            // Verify tags endpoint returns empty
            const tagsResponse = await agent.get('/api/tags');
            expect(tagsResponse.status).toBe(200);
            expect(tagsResponse.body.length).toBe(0);

            // Verify inbox still works
            const inboxResponse = await agent.get('/api/inbox');
            expect(inboxResponse.status).toBe(200);
            expect(inboxResponse.body.length).toBe(1);
            expect(inboxResponse.body[0].content).toBe('Test item');
        });
    });

    describe('POST /api/inbox - No Tags Scenario', () => {
        it('should create inbox items successfully when no tags exist', async () => {
            const inboxData = {
                content: 'New inbox item without tags',
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

        it('should handle multiple inbox items creation when no tags exist', async () => {
            const items = [
                { content: 'First item', source: 'web' },
                { content: 'Second item', source: 'telegram' },
                { content: 'Third item', source: 'api' },
            ];

            for (const item of items) {
                const response = await agent.post('/api/inbox').send(item);

                expect(response.status).toBe(201);
                expect(response.body.content).toBe(item.content);
                expect(response.body.source).toBe(item.source);
            }

            // Verify all items are retrievable
            const getResponse = await agent.get('/api/inbox');
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.length).toBe(3);
        });
    });

    describe('PATCH /api/inbox/:uid - No Tags Scenario', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Original content',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should update inbox items when no tags exist', async () => {
            const updateData = {
                content: 'Updated content without tags',
                status: 'processed',
            };

            const response = await agent
                .patch(`/api/inbox/${inboxItem.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.content).toBe(updateData.content);
            expect(response.body.status).toBe(updateData.status);
        });
    });

    describe('PATCH /api/inbox/:uid/process - No Tags Scenario', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Item to process',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should process inbox items when no tags exist', async () => {
            const response = await agent.patch(
                `/api/inbox/${inboxItem.uid}/process`
            );

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('processed');
        });
    });

    describe('DELETE /api/inbox/:uid - No Tags Scenario', () => {
        let inboxItem;

        beforeEach(async () => {
            inboxItem = await InboxItem.create({
                content: 'Item to delete',
                status: 'added',
                source: 'test',
                user_id: user.id,
            });
        });

        it('should delete inbox items when no tags exist', async () => {
            const response = await agent.delete(`/api/inbox/${inboxItem.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe(
                'Inbox item successfully deleted'
            );

            // Verify item status is updated to deleted
            const deletedItem = await InboxItem.findOne({
                where: { uid: inboxItem.uid },
            });
            expect(deletedItem).not.toBeNull();
            expect(deletedItem.status).toBe('deleted');
        });
    });

    describe('Full Workflow - No Tags Scenario', () => {
        it('should support complete inbox workflow without any tags in system', async () => {
            // Step 1: Verify no tags exist
            const tagsResponse = await agent.get('/api/tags');
            expect(tagsResponse.status).toBe(200);
            expect(tagsResponse.body.length).toBe(0);

            // Step 2: Create inbox item
            const createResponse = await agent
                .post('/api/inbox')
                .send({ content: 'Complete workflow test', source: 'web' });
            expect(createResponse.status).toBe(201);
            const itemUid = createResponse.body.uid;

            // Step 3: Retrieve inbox items
            const getResponse = await agent.get('/api/inbox');
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.length).toBe(1);
            expect(getResponse.body[0].uid).toBe(itemUid);

            // Step 4: Update inbox item
            const updateResponse = await agent
                .patch(`/api/inbox/${itemUid}`)
                .send({ content: 'Updated workflow test' });
            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.content).toBe('Updated workflow test');

            // Step 5: Process inbox item
            const processResponse = await agent.patch(
                `/api/inbox/${itemUid}/process`
            );
            expect(processResponse.status).toBe(200);
            expect(processResponse.body.status).toBe('processed');

            // Step 6: Verify processed item is not in main inbox list
            const finalGetResponse = await agent.get('/api/inbox');
            expect(finalGetResponse.status).toBe(200);
            expect(finalGetResponse.body.length).toBe(0); // Processed items don't appear in inbox
        });

        it('should handle concurrent operations when no tags exist', async () => {
            // Create multiple items concurrently
            const createPromises = Array.from({ length: 5 }, (_, i) =>
                agent.post('/api/inbox').send({
                    content: `Concurrent item ${i + 1}`,
                    source: 'test',
                })
            );

            const createResponses = await Promise.all(createPromises);

            // All should succeed
            createResponses.forEach((response) => {
                expect(response.status).toBe(201);
            });

            // Verify all items are retrievable
            const getResponse = await agent.get('/api/inbox');
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.length).toBe(5);

            // Process all items concurrently
            const itemUids = createResponses.map(
                (response) => response.body.uid
            );
            const processPromises = itemUids.map((uid) =>
                agent.patch(`/api/inbox/${uid}/process`)
            );

            const processResponses = await Promise.all(processPromises);

            // All should succeed
            processResponses.forEach((response) => {
                expect(response.status).toBe(200);
                expect(response.body.status).toBe('processed');
            });

            // Verify no items remain in inbox
            const finalGetResponse = await agent.get('/api/inbox');
            expect(finalGetResponse.status).toBe(200);
            expect(finalGetResponse.body.length).toBe(0);
        });
    });

    describe('Error Handling - No Tags Scenario', () => {
        it('should handle invalid inbox item operations gracefully when no tags exist', async () => {
            // Try to get non-existent item
            const getResponse = await agent.get('/api/inbox/invalid-uid');
            expect(getResponse.status).toBe(400);
            expect(getResponse.body.error).toBe('Invalid UID');

            // Try to update non-existent item
            const updateResponse = await agent
                .patch('/api/inbox/abcd1234efghijk')
                .send({ content: 'Updated' });
            expect(updateResponse.status).toBe(404);
            expect(updateResponse.body.error).toBe('Inbox item not found.');

            // Try to process non-existent item
            const processResponse = await agent.patch(
                '/api/inbox/abcd1234efghijk/process'
            );
            expect(processResponse.status).toBe(404);
            expect(processResponse.body.error).toBe('Inbox item not found.');

            // Try to delete non-existent item
            const deleteResponse = await agent.delete(
                '/api/inbox/abcd1234efghijk'
            );
            expect(deleteResponse.status).toBe(404);
            expect(deleteResponse.body.error).toBe('Inbox item not found.');
        });

        it('should validate required fields when creating inbox items (no tags scenario)', async () => {
            // Try to create item without content
            const response = await agent.post('/api/inbox').send({});

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Content is required');
        });
    });
});
