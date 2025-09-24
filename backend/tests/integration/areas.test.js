const request = require('supertest');
const app = require('../../app');
const { Area, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Areas Routes', () => {
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

    describe('POST /api/areas', () => {
        it('should create a new area', async () => {
            const areaData = {
                name: 'Work',
                description: 'Work related projects',
            };

            const response = await agent.post('/api/areas').send(areaData);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe(areaData.name);
            expect(response.body.description).toBe(areaData.description);
            expect(response.body.uid).toBeDefined();
            expect(typeof response.body.uid).toBe('string');
        });

        it('should require authentication', async () => {
            const areaData = {
                name: 'Work',
            };

            const response = await request(app)
                .post('/api/areas')
                .send(areaData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });

        it('should require area name', async () => {
            const areaData = {
                description: 'Area without name',
            };

            const response = await agent.post('/api/areas').send(areaData);

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Area name is required.');
        });
    });

    describe('GET /api/areas', () => {
        let area1, area2;

        beforeEach(async () => {
            area1 = await Area.create({
                name: 'Work',
                description: 'Work projects',
                user_id: user.id,
            });

            area2 = await Area.create({
                name: 'Personal',
                description: 'Personal projects',
                user_id: user.id,
            });
        });

        it('should get all user areas', async () => {
            const response = await agent.get('/api/areas');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body.map((a) => a.uid)).toContain(area1.uid);
            expect(response.body.map((a) => a.uid)).toContain(area2.uid);
        });

        it('should order areas by name', async () => {
            const response = await agent.get('/api/areas');

            expect(response.status).toBe(200);
            expect(response.body[0].name).toBe('Personal'); // P comes before W
            expect(response.body[1].name).toBe('Work');
        });

        it('should require authentication', async () => {
            const response = await request(app).get('/api/areas');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/areas/:uid', () => {
        let area;

        beforeEach(async () => {
            area = await Area.create({
                name: 'Work',
                description: 'Work projects',
                user_id: user.id,
            });
        });

        it('should get area by uid', async () => {
            const response = await agent.get(`/api/areas/${area.uid}`);

            expect(response.status).toBe(200);
            expect(response.body.uid).toBe(area.uid);
            expect(response.body.name).toBe(area.name);
            expect(response.body.description).toBe(area.description);
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent.get('/api/areas/invalid-uid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent area', async () => {
            const response = await agent.get('/api/areas/abcd1234efghijk');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe(
                "Area not found or doesn't belong to the current user."
            );
        });

        it("should not allow access to other user's areas", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherArea = await Area.create({
                name: 'Other Area',
                user_id: otherUser.id,
            });

            const response = await agent.get(`/api/areas/${otherArea.uid}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe(
                "Area not found or doesn't belong to the current user."
            );
        });

        it('should require authentication', async () => {
            const response = await request(app).get(`/api/areas/${area.uid}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/areas/:uid', () => {
        let area;

        beforeEach(async () => {
            area = await Area.create({
                name: 'Work',
                description: 'Work projects',
                user_id: user.id,
            });
        });

        it('should update area', async () => {
            const updateData = {
                name: 'Updated Work',
                description: 'Updated description',
            };

            const response = await agent
                .patch(`/api/areas/${area.uid}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.description).toBe(updateData.description);
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent
                .patch('/api/areas/invalid-uid')
                .send({ name: 'Updated' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent area', async () => {
            const response = await agent
                .patch('/api/areas/abcd1234efghijk')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it("should not allow updating other user's areas", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherArea = await Area.create({
                name: 'Other Area',
                user_id: otherUser.id,
            });

            const response = await agent
                .patch(`/api/areas/${otherArea.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/areas/${area.uid}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/areas/:uid', () => {
        let area;

        beforeEach(async () => {
            area = await Area.create({
                name: 'Work',
                user_id: user.id,
            });
        });

        it('should delete area', async () => {
            const response = await agent.delete(`/api/areas/${area.uid}`);

            expect(response.status).toBe(204);

            // Verify area is deleted
            const deletedArea = await Area.findOne({
                where: { uid: area.uid },
            });
            expect(deletedArea).toBeNull();
        });

        it('should return 400 for invalid uid format', async () => {
            const response = await agent.delete('/api/areas/invalid-uid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid UID');
        });

        it('should return 404 for non-existent area', async () => {
            const response = await agent.delete('/api/areas/abcd1234efghijk');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it("should not allow deleting other user's areas", async () => {
            const bcrypt = require('bcrypt');
            const otherUser = await User.create({
                email: 'other@example.com',
                password_digest: await bcrypt.hash('password123', 10),
            });

            const otherArea = await Area.create({
                name: 'Other Area',
                user_id: otherUser.id,
            });

            const response = await agent.delete(`/api/areas/${otherArea.uid}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(
                `/api/areas/${area.uid}`
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
