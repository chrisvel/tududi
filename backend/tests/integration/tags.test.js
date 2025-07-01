const request = require('supertest');
const app = require('../../app');
const { Tag, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Tags Routes', () => {
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

    describe('POST /api/tag', () => {
        it('should create a new tag', async () => {
            const tagData = {
                name: 'work',
            };

            const response = await agent.post('/api/tag').send(tagData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe(tagData.name);
            expect(response.body.id).toBeDefined();
        });

        it('should require authentication', async () => {
            const tagData = {
                name: 'work',
            };

            const response = await request(app).post('/api/tag').send(tagData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require tag name', async () => {
            const tagData = {};

            const response = await agent.post('/api/tag').send(tagData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Tag name is required');
        });
    });

    describe('GET /api/tags', () => {
        let tag1, tag2;

        beforeEach(async () => {
            tag1 = await Tag.create({
                name: 'work',
                user_id: user.id,
            });

            tag2 = await Tag.create({
                name: 'personal',
                user_id: user.id,
            });
        });

        it('should get all user tags', async () => {
            const response = await agent.get('/api/tags');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body.map((t) => t.id)).toContain(tag1.id);
            expect(response.body.map((t) => t.id)).toContain(tag2.id);
        });

        it('should order tags by name', async () => {
            const response = await agent.get('/api/tags');

            expect(response.status).toBe(200);
            expect(response.body[0].name).toBe('personal'); // P comes before W
            expect(response.body[1].name).toBe('work');
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/tags');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/tag/:id', () => {
        let tag;

        beforeEach(async () => {
            tag = await Tag.create({
                name: 'work',
                user_id: user.id,
            });
        });

        it('should get tag by id', async () => {
            const response = await agent.get(`/api/tag/${tag.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(tag.id);
            expect(response.body.name).toBe(tag.name);
        });

        it('should return 404 for non-existent tag', async () => {
            const response = await agent.get('/api/tag/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it("should not allow access to other user's tags", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherTag = await Tag.create({
                name: 'other-tag',
                user_id: otherUser.id,
            });

            const response = await agent.get(`/api/tag/${otherTag.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(`/api/tag/${tag.id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/tag/:id', () => {
        let tag;

        beforeEach(async () => {
            tag = await Tag.create({
                name: 'work',
                user_id: user.id,
            });
        });

        it('should update tag', async () => {
            const updateData = {
                name: 'updated-work',
            };

            const response = await agent
                .patch(`/api/tag/${tag.id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
        });

        it('should return 404 for non-existent tag', async () => {
            const response = await agent
                .patch('/api/tag/999999')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it("should not allow updating other user's tags", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherTag = await Tag.create({
                name: 'other-tag',
                user_id: otherUser.id,
            });

            const response = await agent
                .patch(`/api/tag/${otherTag.id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/tag/${tag.id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/tag/:id', () => {
        let tag;

        beforeEach(async () => {
            tag = await Tag.create({
                name: 'work',
                user_id: user.id,
            });
        });

        it('should delete tag', async () => {
            const response = await agent.delete(`/api/tag/${tag.id}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Tag successfully deleted');

            // Verify tag is deleted
            const deletedTag = await Tag.findByPk(tag.id);
            expect(deletedTag).toBeNull();
        });

        it('should return 404 for non-existent tag', async () => {
            const response = await agent.delete('/api/tag/999999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it("should not allow deleting other user's tags", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherTag = await Tag.create({
                name: 'other-tag',
                user_id: otherUser.id,
            });

            const response = await agent.delete(`/api/tag/${otherTag.id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(`/api/tag/${tag.id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
