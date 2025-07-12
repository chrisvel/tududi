const request = require('supertest');
const app = require('../../app');
const Area = require('../../models-mongo/area');
const User = require('../../models-mongo/user');
const { createTestUser } = require('../helpers/testUtils');

describe('Areas Routes', () => {
    let user, agent;

    beforeEach(async () => {
        await User.deleteMany({});
        await Area.deleteMany({});
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
            expect(response.body.user).toBe(user._id.toString());
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
            area1 = new Area({
                name: 'Work',
                description: 'Work projects',
                user: user._id,
            });
            await area1.save();

            area2 = new Area({
                name: 'Personal',
                description: 'Personal projects',
                user: user._id,
            });
            await area2.save();
        });

        it('should get all user areas', async () => {
            const response = await agent.get('/api/areas');

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(2);
            expect(response.body.map((a) => a._id)).toContain(area1._id.toString());
            expect(response.body.map((a) => a._id)).toContain(area2._id.toString());
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

    describe('GET /api/areas/:id', () => {
        let area;

        beforeEach(async () => {
            area = new Area({
                name: 'Work',
                description: 'Work projects',
                user: user._id,
            });
            await area.save();
        });

        it('should get area by id', async () => {
            const response = await agent.get(`/api/areas/${area._id}`);

            expect(response.status).toBe(200);
            expect(response.body._id).toBe(area._id.toString());
            expect(response.body.name).toBe(area.name);
            expect(response.body.description).toBe(area.description);
        });

        it('should return 404 for non-existent area', async () => {
            const response = await agent.get('/api/areas/60c72b2f9b1d8c001f8e4d6a');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe(
                "Area not found or doesn't belong to the current user."
            );
        });

        it("should not allow access to other user's areas", async () => {
            const otherUser = await createTestUser({ email: 'other@example.com' });
            const otherArea = new Area({
                name: 'Other Area',
                user: otherUser._id,
            });
            await otherArea.save();

            const response = await agent.get(`/api/areas/${otherArea._id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe(
                "Area not found or doesn't belong to the current user."
            );
        });

        it('should require authentication', async () => {
            const response = await request(app).get(`/api/areas/${area._id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('PATCH /api/areas/:id', () => {
        let area;

        beforeEach(async () => {
            area = new Area({
                name: 'Work',
                description: 'Work projects',
                user: user._id,
            });
            await area.save();
        });

        it('should update area', async () => {
            const updateData = {
                name: 'Updated Work',
                description: 'Updated description',
            };

            const response = await agent
                .patch(`/api/areas/${area._id}`)
                .send(updateData);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(updateData.name);
            expect(response.body.description).toBe(updateData.description);
        });

        it('should return 404 for non-existent area', async () => {
            const response = await agent
                .patch('/api/areas/60c72b2f9b1d8c001f8e4d6a')
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it("should not allow updating other user's areas", async () => {
            const otherUser = await createTestUser({ email: 'other@example.com' });
            const otherArea = new Area({
                name: 'Other Area',
                user: otherUser._id,
            });
            await otherArea.save();

            const response = await agent
                .patch(`/api/areas/${otherArea._id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app)
                .patch(`/api/areas/${area._id}`)
                .send({ name: 'Updated' });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/areas/:id', () => {
        let area;

        beforeEach(async () => {
            area = new Area({
                name: 'Work',
                user: user._id,
            });
            await area.save();
        });

        it('should delete area', async () => {
            const response = await agent.delete(`/api/areas/${area._id}`);

            expect(response.status).toBe(204);

            // Verify area is deleted
            const deletedArea = await Area.findById(area._id);
            expect(deletedArea).toBeNull();
        });

        it('should return 404 for non-existent area', async () => {
            const response = await agent.delete('/api/areas/60c72b2f9b1d8c001f8e4d6a');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it("should not allow deleting other user's areas", async () => {
            const otherUser = await createTestUser({ email: 'other@example.com' });
            const otherArea = new Area({
                name: 'Other Area',
                user: otherUser._id,
            });
            await otherArea.save();

            const response = await agent.delete(`/api/areas/${otherArea._id}`);

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('Area not found.');
        });

        it('should require authentication', async () => {
            const response = await request(app).delete(`/api/areas/${area._id}`);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
