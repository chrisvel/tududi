const request = require('supertest');
const app = require('../../app');
const { getConfig } = require('../../config/config');
const {
    User,
    Task,
    Project,
    Area,
    Note,
    Role,
    InboxItem,
} = require('../../models');
const demoService = require('../../modules/demo/service');
const entitlements = require('../../services/entitlementsService');

const config = getConfig();
const DEMO_EMAIL = 'demo-test@tududi.com';

describe('Public demo sandbox', () => {
    beforeEach(async () => {
        config.demo.enabled = true;
        config.demo.email = DEMO_EMAIL;
        config.demo.password = 'demodemo123';
        demoService.forgetCachedUser();
        entitlements.invalidate();
    });

    afterEach(async () => {
        config.demo.enabled = false;
        config.hosted.enabled = false;
        config.hosted.requireSubscription = false;
        demoService.forgetCachedUser();
        entitlements.invalidate();
        await User.destroy({ where: { email: DEMO_EMAIL }, force: true });
    });

    it('is invisible when switched off', async () => {
        config.demo.enabled = false;
        expect((await request(app).get('/api/demo/status')).status).toBe(404);
        expect((await request(app).post('/api/demo/login')).status).toBe(404);
    });

    it('creates and seeds the account on first use, and signs the caller in', async () => {
        const agent = request.agent(app);
        const res = await agent.post('/api/demo/login');
        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe(DEMO_EMAIL);

        const user = await User.findOne({ where: { email: DEMO_EMAIL } });
        expect(user).not.toBeNull();
        expect(user.email_verified).toBe(true);

        // Seeded with something in every part of the app
        expect(
            await Task.count({ where: { user_id: user.id } })
        ).toBeGreaterThan(5);
        expect(
            await Project.count({ where: { user_id: user.id } })
        ).toBeGreaterThan(0);
        expect(
            await Area.count({ where: { user_id: user.id } })
        ).toBeGreaterThan(0);
        expect(
            await Note.count({ where: { user_id: user.id } })
        ).toBeGreaterThan(0);
        expect(
            await InboxItem.count({ where: { user_id: user.id } })
        ).toBeGreaterThan(0);

        // The session works for ordinary requests
        expect((await agent.get('/api/tasks')).status).toBe(200);
    });

    it('is never an admin', async () => {
        await demoService.ensureDemoUser();
        const user = await User.findOne({ where: { email: DEMO_EMAIL } });
        const role = await Role.findOne({ where: { user_id: user.id } });
        expect(role.is_admin).toBe(false);

        // Even if something flips it, the next ensure puts it back
        await role.update({ is_admin: true });
        await demoService.ensureDemoUser();
        await role.reload();
        expect(role.is_admin).toBe(false);
    });

    it('cannot change its own password, email or delete itself', async () => {
        const agent = request.agent(app);
        await agent.post('/api/demo/login');

        const pw = await agent.post('/api/profile/change-password').send({
            current_password: 'demodemo123',
            new_password: 'hijacked1',
        });
        expect(pw.status).toBe(403);

        const patch = await agent
            .patch('/api/profile')
            .send({ email: 'someone-else@example.com' });
        expect(patch.status).toBe(403);

        const del = await agent
            .delete('/api/profile')
            .send({ password: 'demodemo123' });
        expect(del.status).toBe(403);

        expect(
            await User.findOne({ where: { email: DEMO_EMAIL } })
        ).not.toBeNull();
    });

    it('cannot mint an API token, and any old one dies at the reset', async () => {
        const { ApiToken } = require('../../models');
        const agent = request.agent(app);
        await agent.post('/api/demo/login');
        const user = await User.findOne({ where: { email: DEMO_EMAIL } });

        // A token would outlive the wipe, which is the one kind of access
        // the reset exists to remove.
        const minted = await agent
            .post('/api/profile/api-keys')
            .send({ name: 'persistence' });
        expect(minted.status).toBe(403);

        // One created before the guard existed is cleared by the reset
        await ApiToken.create({
            user_id: user.id,
            name: 'legacy',
            token_hash: 'x'.repeat(60),
            token_prefix: 'tt_test',
        });
        await demoService.resetDemo();
        expect(await ApiToken.count({ where: { user_id: user.id } })).toBe(0);
    });

    it('wipes what a visitor did and seeds it again on reset', async () => {
        const agent = request.agent(app);
        await agent.post('/api/demo/login');
        const user = await User.findOne({ where: { email: DEMO_EMAIL } });

        await Task.create({
            name: 'Something a visitor typed',
            user_id: user.id,
        });
        const before = await Task.count({ where: { user_id: user.id } });

        const result = await demoService.resetDemo();
        expect(result.reset).toBe(true);

        const names = (await Task.findAll({ where: { user_id: user.id } })).map(
            (t) => t.name
        );
        expect(names).not.toContain('Something a visitor typed');
        expect(names.length).toBeGreaterThan(5);
        expect(names.length).toBeLessThanOrEqual(before);
    });

    it('gets past the subscription gate through an override, not a payment', async () => {
        config.hosted.enabled = true;
        config.hosted.requireSubscription = true;
        entitlements.invalidate();

        const agent = request.agent(app);
        await agent.post('/api/demo/login');
        expect((await agent.get('/api/tasks')).status).toBe(200);

        const status = await agent.get('/api/billing');
        expect(status.body.plan).toBe('pro');
        expect(status.body.reason).toBe('override');
    });
});
