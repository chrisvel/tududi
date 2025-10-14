const request = require('supertest');
const app = require('../../app');

describe('Shares Routes - Authentication', () => {
    describe('POST /api/shares', () => {
        it('should require authentication', async () => {
            const response = await request(app).post('/api/shares').send({
                resource_type: 'project',
                resource_uid: 'uid',
                target_user_email: 'x@y.com',
                access_level: 'ro',
            });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('DELETE /api/shares', () => {
        it('should require authentication', async () => {
            const response = await request(app).delete('/api/shares').send({
                resource_type: 'project',
                resource_uid: 'uid',
                target_user_id: 1,
            });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });

    describe('GET /api/shares', () => {
        it('should require authentication', async () => {
            const response = await request(app).get(
                '/api/shares?resource_type=project&resource_uid=uid'
            );

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
