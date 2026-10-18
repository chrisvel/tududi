process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'apprise-test-session-secret';

jest.mock('../../modules/caldav/services/safe-request', () => {
    const actual = jest.requireActual(
        '../../modules/caldav/services/safe-request'
    );
    return { ...actual, safeRequest: jest.fn() };
});

const request = require('supertest');
const app = require('../../app');
const { User, Notification } = require('../../models');
const { safeRequest } = require('../../modules/caldav/services/safe-request');
const { createTestUser } = require('../helpers/testUtils');

const SERVER = 'http://8.8.8.8:8000';
const KEY = 'phone-config';

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Apprise notifications', () => {
    let user, agent;

    beforeEach(async () => {
        safeRequest.mockReset();
        safeRequest.mockResolvedValue({ status: 200 });
        user = await createTestUser({
            email: `apprise_${Date.now()}_${Math.random()}@example.com`,
        });
        agent = await login(user);
    });

    describe('/api/apprise/config', () => {
        it('requires a session', async () => {
            const res = await request(app).get('/api/apprise/config');
            expect(res.status).toBe(401);
        });

        it('starts unconfigured', async () => {
            const res = await agent.get('/api/apprise/config');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                configured: false,
                host: null,
                tags: '',
            });
        });

        it('saves the server and never returns the address or key', async () => {
            const res = await agent
                .put('/api/apprise/config')
                .send({ url: `${SERVER}/`, key: KEY, tags: 'all' });

            expect(res.status).toBe(200);
            expect(res.body).toEqual({
                configured: true,
                host: '8.8.8.8:8000',
                tags: 'all',
            });
            expect(JSON.stringify(res.body)).not.toContain(KEY);
        });

        it('stores the address and key encrypted at rest', async () => {
            await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: KEY });

            const row = await User.findByPk(user.id, {
                attributes: ['apprise_url', 'apprise_key'],
            });
            expect(row.apprise_url).not.toContain(SERVER);
            expect(row.apprise_key).not.toContain(KEY);
        });

        it('rejects a private address unless private hosts are allowed', async () => {
            const res = await agent
                .put('/api/apprise/config')
                .send({ url: 'http://192.168.1.10:8000', key: KEY });
            expect(res.status).toBe(400);
        });

        it('rejects a non-http address', async () => {
            const res = await agent
                .put('/api/apprise/config')
                .send({ url: 'ftp://8.8.8.8', key: KEY });
            expect(res.status).toBe(400);
        });

        it('rejects a config key with path characters', async () => {
            const res = await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: 'a/b' });
            expect(res.status).toBe(400);
        });

        it('clears the settings on delete', async () => {
            await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: KEY });

            const res = await agent.delete('/api/apprise/config');
            expect(res.status).toBe(200);
            expect(res.body.configured).toBe(false);

            const row = await User.findByPk(user.id, {
                attributes: ['apprise_url', 'apprise_key'],
            });
            expect(row.apprise_url).toBeNull();
            expect(row.apprise_key).toBeNull();
        });
    });

    describe('POST /api/apprise/test', () => {
        it('posts a test message to the notify endpoint', async () => {
            await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: KEY, tags: 'all' });

            const res = await agent.post('/api/apprise/test');
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ channel: 'apprise', delivered: true });

            expect(safeRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'POST',
                    url: `${SERVER}/notify/${KEY}`,
                    data: expect.objectContaining({
                        title: 'Test notification',
                        tag: 'all',
                    }),
                })
            );
        });

        it('reports a failed delivery', async () => {
            await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: KEY });
            safeRequest.mockRejectedValue(
                new Error('Request failed with status code 404')
            );

            const res = await agent.post('/api/apprise/test');
            expect(res.status).toBe(400);
            expect(res.body.error || res.body.message).toMatch(/404/);
        });

        it('asks for the settings first when none are saved', async () => {
            const res = await agent.post('/api/apprise/test');
            expect(res.status).toBe(400);
            expect(safeRequest).not.toHaveBeenCalled();
        });
    });

    describe('notification fan-out', () => {
        it('delivers a notification with the apprise source', async () => {
            await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: KEY });

            const notification = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Pay rent',
                message: 'Due tomorrow',
                level: 'warning',
                sources: ['apprise'],
            });

            expect(safeRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: `${SERVER}/notify/${KEY}`,
                    data: expect.objectContaining({
                        title: 'Pay rent',
                        body: 'Due tomorrow',
                        type: 'warning',
                    }),
                })
            );

            const reloaded = await Notification.findByPk(notification.id);
            expect(reloaded.channel_sent_at?.apprise).toBeTruthy();
        });

        it('does not throw when the server is unreachable', async () => {
            await agent
                .put('/api/apprise/config')
                .send({ url: SERVER, key: KEY });
            safeRequest.mockRejectedValue(new Error('connect ECONNREFUSED'));

            await expect(
                Notification.createNotification({
                    userId: user.id,
                    type: 'task_due_soon',
                    title: 'Still saved',
                    message: 'In-app copy stays',
                    sources: ['apprise'],
                })
            ).resolves.toBeDefined();
        });

        it('skips the send when apprise is not configured', async () => {
            await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Unconfigured',
                message: 'No server saved',
                sources: ['apprise'],
            });
            expect(safeRequest).not.toHaveBeenCalled();
        });
    });
});
