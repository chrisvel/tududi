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
            expect(response.body.uid).toBeDefined();
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

        it('should allow colon (:) in tag names', async () => {
            const tagData = {
                name: 'project:frontend',
            };

            const response = await agent.post('/api/tag').send(tagData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('project:frontend');
            expect(response.body.uid).toBeDefined();
        });

        it('should allow hyphen (-) in tag names', async () => {
            const tagData = {
                name: 'project-frontend',
            };

            const response = await agent.post('/api/tag').send(tagData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('project-frontend');
            expect(response.body.uid).toBeDefined();
        });

        it('should reject tags with invalid characters', async () => {
            const tagData = {
                name: 'invalid#tag',
            };

            const response = await agent.post('/api/tag').send(tagData);

            expect(response.status).toBe(400);
            expect(response.body.error).toContain('invalid characters');
        });

        it('should prevent creating duplicate tags with same name', async () => {
            const tagData = {
                name: 'work',
            };

            // Create first tag
            const firstResponse = await agent.post('/api/tag').send(tagData);
            expect(firstResponse.status).toBe(201);
            expect(firstResponse.body.name).toBe('work');

            // Attempt to create duplicate tag
            const duplicateResponse = await agent
                .post('/api/tag')
                .send(tagData);
            expect(duplicateResponse.status).toBe(409);
            expect(duplicateResponse.body.error).toContain(
                'A tag with the name "work" already exists'
            );
        });

        it('should allow creating tags with same name but different case', async () => {
            // Create tag with lowercase
            const firstResponse = await agent
                .post('/api/tag')
                .send({ name: 'work' });
            expect(firstResponse.status).toBe(201);

            // Tags are case-sensitive, so uppercase version should be allowed
            const upperResponse = await agent
                .post('/api/tag')
                .send({ name: 'WORK' });
            expect(upperResponse.status).toBe(201);
            expect(upperResponse.body.name).toBe('WORK');
        });

        it('should allow different users to have tags with same name', async () => {
            const bcrypt = require('bcrypt');

            // Create first user's tag
            const tagData = { name: 'work' };
            const firstResponse = await agent.post('/api/tag').send(tagData);
            expect(firstResponse.status).toBe(201);

            // Create second user
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            // Login as second user
            const otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: 'other@example.com',
                password: 'password123',
            });

            // Second user should be able to create tag with same name
            const secondResponse = await otherAgent
                .post('/api/tag')
                .send(tagData);
            expect(secondResponse.status).toBe(201);
            expect(secondResponse.body.name).toBe('work');
        });

        it('should handle database unique constraint violation', async () => {
            // Create first tag
            await Tag.create({
                name: 'existing',
                user_id: user.id,
            });

            // Try to create duplicate (this should be caught by our explicit check,
            // but if it somehow passes, the database constraint should catch it)
            const response = await agent
                .post('/api/tag')
                .send({ name: 'existing' });

            expect(response.status).toBe(409);
            expect(response.body.error).toContain('already exists');
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
            expect(response.body.map((t) => t.uid)).toContain(tag1.uid);
            expect(response.body.map((t) => t.uid)).toContain(tag2.uid);
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

    describe('GET /api/tag', () => {
        let tag;

        beforeEach(async () => {
            tag = await Tag.create({
                name: 'work',
                user_id: user.id,
            });
        });

        it('should get tag by uid', async () => {
            const response = await agent.get(`/api/tag?uid=${tag.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(tag.name);
        });

        it('should return 404 for non-existent tag', async () => {
            const response = await agent.get('/api/tag?uid=non-existent-uid');

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

            const response = await agent.get(`/api/tag?uid=${otherTag.uid}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it('should require authentication', async () => {
            const response = await request(app).get(`/api/tag?uid=${tag.uid}`);

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
                .patch(`/api/tag/${tag.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
        });

        it('should return 404 for non-existent tag', async () => {
            const response = await agent
                .patch('/api/tag/non-existent-uid')
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
                .patch(`/api/tag/${otherTag.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/tag/${tag.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should prevent updating tag to duplicate name', async () => {
            // Create an additional tag (note: beforeEach already created 'work' tag)
            const tag2 = await Tag.create({
                name: 'personal',
                user_id: user.id,
            });

            // Try to rename tag2 to the same name as the existing 'work' tag
            const response = await agent
                .patch(`/api/tag/${tag2.uid}`)
                .send({ name: 'work' });

            expect(response.status).toBe(409);
            expect(response.body.error).toContain(
                'A tag with the name "work" already exists'
            );

            // Verify tag2 was not updated
            const unchangedTag = await Tag.findByPk(tag2.id);
            expect(unchangedTag.name).toBe('personal');
        });

        it('should allow updating tag to same name (no change)', async () => {
            // This should succeed because we're not actually changing the name
            const response = await agent
                .patch(`/api/tag/${tag.uid}`)
                .send({ name: 'work' });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('work');
        });

        it('should allow updating tag to new unique name', async () => {
            const response = await agent
                .patch(`/api/tag/${tag.uid}`)
                .send({ name: 'new-unique-name' });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('new-unique-name');

            // Verify the update persisted
            const updatedTag = await Tag.findByPk(tag.id);
            expect(updatedTag.name).toBe('new-unique-name');
        });

        it('should allow updating to same name with different case', async () => {
            // Create an additional tag (note: beforeEach already created 'work' tag)
            const tag2 = await Tag.create({
                name: 'personal',
                user_id: user.id,
            });

            // Tags are case-sensitive, so uppercase version should be allowed
            const response = await agent
                .patch(`/api/tag/${tag2.uid}`)
                .send({ name: 'WORK' });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('WORK');
        });

        it('should handle database unique constraint on update', async () => {
            // Create an additional tag (note: beforeEach already created 'work' tag)
            const tag2 = await Tag.create({
                name: 'other',
                user_id: user.id,
            });

            // Try to update tag2 to have same name as the existing 'work' tag
            const response = await agent
                .patch(`/api/tag/${tag2.uid}`)
                .send({ name: 'work' });

            expect(response.status).toBe(409);
            expect(response.body.error).toContain('already exists');
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
            const response = await agent.delete(`/api/tag/${tag.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('Tag successfully deleted');

            // Verify tag is deleted
            const deletedTag = await Tag.findByPk(tag.id);
            expect(deletedTag).toBeNull();
        });

        it('should return 404 for non-existent tag', async () => {
            const response = await agent.delete('/api/tag/non-existent-uid');

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

            const response = await agent.delete(`/api/tag/${otherTag.uid}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Tag not found');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(`/api/tag/${tag.uid}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
