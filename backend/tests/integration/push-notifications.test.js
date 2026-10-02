jest.mock('web-push', () => {
    const actual = jest.requireActual('web-push');
    return {
        generateVAPIDKeys: actual.generateVAPIDKeys,
        sendNotification: jest.fn(),
    };
});

const request = require('supertest');
const webpush = require('web-push');
const app = require('../../app');
const {
    Notification,
    PushSubscription,
    Setting,
    User,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { resetVapidCache } = require('../../modules/push/vapid');
const pushService = require('../../modules/push/service');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

let counter = 0;
const subscriptionBody = (overrides = {}) => ({
    endpoint: `https://fcm.googleapis.com/fcm/send/device-${++counter}`,
    keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA', auth: 'tBHI' },
    ...overrides,
});

describe('Push notifications', () => {
    let user, agent;

    beforeEach(async () => {
        webpush.sendNotification.mockReset();
        webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
        await Setting.destroy({ where: { key: 'vapid_keys' } });
        resetVapidCache();
        user = await createTestUser({
            email: `push_${Date.now()}_${counter}@example.com`,
        });
        agent = await login(user);
    });

    describe('GET /api/push/config', () => {
        it('requires a session', async () => {
            const res = await request(app).get('/api/push/config');
            expect(res.status).toBe(401);
        });

        it('generates keys once and keeps returning the same public key', async () => {
            const first = await agent.get('/api/push/config');
            expect(first.status).toBe(200);
            expect(first.body.enabled).toBe(true);
            expect(first.body.publicKey).toMatch(/^[A-Za-z0-9_-]{80,}$/);

            resetVapidCache();
            const second = await agent.get('/api/push/config');
            expect(second.body.publicKey).toBe(first.body.publicKey);

            const row = await Setting.findOne({ where: { key: 'vapid_keys' } });
            expect(row).not.toBeNull();
        });
    });

    describe('POST /api/push/subscriptions', () => {
        it('stores the device for the signed-in user', async () => {
            const body = subscriptionBody();
            const res = await agent
                .post('/api/push/subscriptions')
                .set('User-Agent', 'PushTest/1.0')
                .send(body);

            expect(res.status).toBe(201);
            const rows = await PushSubscription.findAll({
                where: { user_id: user.id },
            });
            expect(rows).toHaveLength(1);
            expect(rows[0].endpoint).toBe(body.endpoint);
            expect(rows[0].user_agent).toBe('PushTest/1.0');
        });

        it('does not duplicate a device that subscribes again', async () => {
            const body = subscriptionBody();
            await agent.post('/api/push/subscriptions').send(body);
            await agent.post('/api/push/subscriptions').send(body);

            expect(
                await PushSubscription.count({ where: { user_id: user.id } })
            ).toBe(1);
        });

        it('moves a shared device to whoever subscribed it last', async () => {
            const other = await createTestUser({
                email: `push_other_${Date.now()}@example.com`,
            });
            const otherAgent = await login(other);
            const body = subscriptionBody();

            await agent.post('/api/push/subscriptions').send(body);
            await otherAgent.post('/api/push/subscriptions').send(body);

            expect(
                await PushSubscription.count({ where: { user_id: user.id } })
            ).toBe(0);
            expect(
                await PushSubscription.count({ where: { user_id: other.id } })
            ).toBe(1);
        });

        it('rejects endpoints that are not https', async () => {
            for (const endpoint of [
                'http://fcm.googleapis.com/x',
                'file:///etc/passwd',
                'javascript:alert(1)',
                '',
            ]) {
                const res = await agent
                    .post('/api/push/subscriptions')
                    .send(subscriptionBody({ endpoint }));
                expect(res.status).toBe(400);
            }
            expect(await PushSubscription.count()).toBe(0);
        });

        it('rejects a subscription without keys', async () => {
            const res = await agent
                .post('/api/push/subscriptions')
                .send({ endpoint: 'https://push.example.com/abc' });
            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/push/subscriptions', () => {
        it('removes only the current user’s device', async () => {
            const body = subscriptionBody();
            await agent.post('/api/push/subscriptions').send(body);

            const other = await createTestUser({
                email: `push_del_${Date.now()}@example.com`,
            });
            const otherAgent = await login(other);
            await otherAgent
                .delete('/api/push/subscriptions')
                .send({ endpoint: body.endpoint });
            expect(
                await PushSubscription.count({ where: { user_id: user.id } })
            ).toBe(1);

            const res = await agent
                .delete('/api/push/subscriptions')
                .send({ endpoint: body.endpoint });
            expect(res.status).toBe(200);
            expect(
                await PushSubscription.count({ where: { user_id: user.id } })
            ).toBe(0);
        });
    });

    describe('sending', () => {
        it('sends to every device of the user', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());

            const sent = await pushService.sendToUser(user.id, {
                title: 'tududi',
                body: 'Hello',
                url: '/',
            });

            expect(sent).toBe(2);
            expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
            const [, payload, options] = webpush.sendNotification.mock.calls[0];
            expect(JSON.parse(payload)).toMatchObject({
                title: 'tududi',
                body: 'Hello',
                url: '/',
            });
            expect(options.vapidDetails.subject).toMatch(/^(mailto:|https:)/);
        });

        it('forgets a device the push service says is gone', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());
            webpush.sendNotification.mockRejectedValue({ statusCode: 410 });

            const sent = await pushService.sendToUser(user.id, {
                title: 't',
                body: 'b',
                url: '/',
            });

            expect(sent).toBe(0);
            expect(
                await PushSubscription.count({ where: { user_id: user.id } })
            ).toBe(0);
        });

        it('keeps a device through a few failures, then drops it', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());
            webpush.sendNotification.mockRejectedValue({ statusCode: 500 });

            for (let i = 0; i < 4; i++) {
                await pushService.sendToUser(user.id, { title: 't' });
            }
            const row = await PushSubscription.findOne({
                where: { user_id: user.id },
            });
            expect(row.failure_count).toBe(4);

            await pushService.sendToUser(user.id, { title: 't' });
            expect(
                await PushSubscription.count({ where: { user_id: user.id } })
            ).toBe(0);
        });

        it('pushes a notification created with the push source, linking to the task', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());

            const notification = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Task due soon',
                message: 'Your task "Pay rent" is due tomorrow',
                data: { taskUid: 'abc123' },
                sources: ['push'],
            });

            expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
            const payload = JSON.parse(
                webpush.sendNotification.mock.calls[0][1]
            );
            expect(payload).toEqual({
                title: 'Task due soon',
                body: 'Your task "Pay rent" is due tomorrow',
                url: '/task/abc123',
                tag: 'task_due_soon:abc123',
            });
            await notification.reload();
            expect(notification.channel_sent_at.push).toBeTruthy();
        });

        it('does not push again when a recreated reminder was pushed recently', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());

            await Notification.createNotification({
                userId: user.id,
                type: 'task_overdue',
                title: 'Overdue',
                message: 'm',
                sources: ['push'],
                channel_sent_at: { push: new Date().toISOString() },
            });

            expect(webpush.sendNotification).not.toHaveBeenCalled();
        });

        it('does not push notifications without the push source', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());

            await Notification.createNotification({
                userId: user.id,
                type: 'task_overdue',
                title: 'Overdue',
                message: 'm',
                sources: [],
            });

            expect(webpush.sendNotification).not.toHaveBeenCalled();
        });

        it('adds push to the test trigger when the user enabled it', async () => {
            await agent
                .post('/api/push/subscriptions')
                .send(subscriptionBody());
            await User.update(
                {
                    notification_preferences: {
                        dueTasks: {
                            inApp: true,
                            email: false,
                            push: true,
                            telegram: false,
                        },
                    },
                },
                { where: { id: user.id } }
            );

            const res = await agent
                .post('/api/test-notifications/trigger')
                .send({ type: 'task_due_soon' });

            expect(res.status).toBe(200);
            expect(res.body.notification.sources).toContain('push');
            expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
        });
    });
});
