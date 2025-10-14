const request = require('supertest');
const app = require('../../app');

describe('Admin Routes - Authentication', () => {
    describe('POST /api/admin/set-admin-role', () => {
        it('should require authentication', async () => {
            const response = await request(app)
                .post('/api/admin/set-admin-role')
                .send({ user_id: 1, is_admin: true });

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Authentication required');
        });
    });
});
