const request = require('supertest');
const app = require('../../app');
const { Role, Feedback, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const accountErasure = require('../../services/accountErasureService');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Feedback', () => {
    let admin, adminAgent, plain, plainAgent;

    beforeEach(async () => {
        admin = await createTestUser({
            email: `fb_adm_${Date.now()}@example.com`,
        });
        plain = await createTestUser({
            email: `fb_usr_${Date.now()}@example.com`,
        });
        await Role.destroy({ where: {} });
        await Role.create({ user_id: admin.id, is_admin: true });
        adminAgent = await login(admin);
        plainAgent = await login(plain);
    });

    describe('POST /api/feedback', () => {
        it('stores the message with the page, version and browser', async () => {
            const res = await plainAgent
                .post('/api/feedback')
                .set('User-Agent', 'FeedbackTest/1.0')
                .send({
                    message: '  The save button does nothing  ',
                    page_url: '/today',
                    app_version: 'v1.6.4',
                });

            expect(res.status).toBe(201);
            const row = await Feedback.findByPk(res.body.id);
            expect(row.user_id).toBe(plain.id);
            expect(row.message).toBe('The save button does nothing');
            expect(row.page_url).toBe('/today');
            expect(row.app_version).toBe('v1.6.4');
            expect(row.user_agent).toBe('FeedbackTest/1.0');
            expect(row.resolved_at).toBeNull();
        });

        it('rejects an empty message', async () => {
            const res = await plainAgent
                .post('/api/feedback')
                .send({ message: '   ' });
            expect(res.status).toBe(400);
            expect(await Feedback.count()).toBe(0);
        });

        it('rejects a message over 5000 characters', async () => {
            const res = await plainAgent
                .post('/api/feedback')
                .send({ message: 'a'.repeat(5001) });
            expect(res.status).toBe(400);
        });

        it('requires a signed-in user', async () => {
            const res = await request(app)
                .post('/api/feedback')
                .send({ message: 'hello' });
            expect(res.status).toBe(401);
        });
    });

    describe('admin endpoints', () => {
        it('lists feedback newest first with the sender', async () => {
            const older = await Feedback.create({
                user_id: plain.id,
                message: 'older',
                created_at: new Date(Date.now() - 60000),
            });
            const newer = await Feedback.create({
                user_id: plain.id,
                message: 'newer',
            });

            const res = await adminAgent.get('/api/admin/feedback');
            expect(res.status).toBe(200);
            expect(res.body.total).toBe(2);
            expect(res.body.open).toBe(2);
            expect(res.body.feedback.map((f) => f.id)).toEqual([
                newer.id,
                older.id,
            ]);
            expect(res.body.feedback[0].user.email).toBe(plain.email);
        });

        it('resolves, filters by status and reopens', async () => {
            const row = await Feedback.create({
                user_id: plain.id,
                message: 'fix me',
            });
            await Feedback.create({ user_id: plain.id, message: 'still open' });

            const resolved = await adminAgent
                .patch(`/api/admin/feedback/${row.id}`)
                .send({ resolved: true });
            expect(resolved.status).toBe(200);
            expect(resolved.body.resolved_at).not.toBeNull();

            const open = await adminAgent.get(
                '/api/admin/feedback?status=open'
            );
            expect(open.body.total).toBe(1);
            expect(open.body.open).toBe(1);
            expect(open.body.feedback[0].message).toBe('still open');

            const done = await adminAgent.get(
                '/api/admin/feedback?status=resolved'
            );
            expect(done.body.feedback.map((f) => f.id)).toEqual([row.id]);

            const reopened = await adminAgent
                .patch(`/api/admin/feedback/${row.id}`)
                .send({ resolved: false });
            expect(reopened.body.resolved_at).toBeNull();
        });

        it('deletes an entry', async () => {
            const row = await Feedback.create({
                user_id: plain.id,
                message: 'spam',
            });
            const res = await adminAgent.delete(
                `/api/admin/feedback/${row.id}`
            );
            expect(res.status).toBe(204);
            expect(await Feedback.findByPk(row.id)).toBeNull();

            const again = await adminAgent.delete(
                `/api/admin/feedback/${row.id}`
            );
            expect(again.status).toBe(404);
        });

        it('shows the open count on the admin overview', async () => {
            await Feedback.create({ user_id: plain.id, message: 'one' });
            await Feedback.create({
                user_id: plain.id,
                message: 'two',
                resolved_at: new Date(),
            });

            const res = await adminAgent.get('/api/admin/overview');
            expect(res.status).toBe(200);
            expect(res.body.feedback.open).toBe(1);
        });

        it('is closed to non-admins', async () => {
            const row = await Feedback.create({
                user_id: plain.id,
                message: 'mine',
            });

            expect((await plainAgent.get('/api/admin/feedback')).status).toBe(
                403
            );
            expect(
                (
                    await plainAgent
                        .patch(`/api/admin/feedback/${row.id}`)
                        .send({ resolved: true })
                ).status
            ).toBe(403);
            expect(
                (await plainAgent.delete(`/api/admin/feedback/${row.id}`))
                    .status
            ).toBe(403);
        });
    });

    it('is erased with the account that sent it', async () => {
        await Feedback.create({ user_id: plain.id, message: 'bye' });
        const user = await User.findByPk(plain.id);
        await accountErasure.eraseUserAccount(user.id);
        expect(await Feedback.count({ where: { user_id: plain.id } })).toBe(0);
    });
});
