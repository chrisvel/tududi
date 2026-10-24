process.env.TUDUDI_SESSION_SECRET =
    process.env.TUDUDI_SESSION_SECRET || 'webhooks-test-session-secret';

jest.mock('../../modules/caldav/services/safe-request', () => {
    const actual = jest.requireActual(
        '../../modules/caldav/services/safe-request'
    );
    return { ...actual, safeRequest: jest.fn() };
});

const crypto = require('crypto');
const request = require('supertest');
const app = require('../../app');
const {
    Notification,
    Task,
    User,
    Webhook,
    WebhookDelivery,
} = require('../../models');
const { safeRequest } = require('../../modules/caldav/services/safe-request');
const dispatcher = require('../../modules/webhooks/dispatcher');
const { sendDueSummaries } = require('../../modules/webhooks/summary');
const { createTestUser } = require('../helpers/testUtils');

const URL = 'https://8.8.8.8/hooks/tududi?token=abc123';

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const httpError = (status) =>
    Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status },
    });

describe('Webhooks', () => {
    let user, agent;

    const createWebhook = async (overrides = {}) => {
        const res = await agent.post('/api/webhooks').send({
            name: 'n8n',
            url: URL,
            events: ['task.created', 'task.completed', 'task.updated'],
            ...overrides,
        });
        expect(res.status).toBe(200);
        return res.body;
    };

    const pending = (where = {}) =>
        WebhookDelivery.findAll({ where, order: [['id', 'ASC']] });

    beforeEach(async () => {
        safeRequest.mockReset();
        safeRequest.mockResolvedValue({ status: 200 });
        user = await createTestUser({
            email: `webhooks_${Date.now()}_${Math.random()}@example.com`,
        });
        dispatcher.invalidate(user.id);
        agent = await login(user);
    });

    describe('managing webhooks', () => {
        it('requires a session', async () => {
            const res = await request(app).get('/api/webhooks');
            expect(res.status).toBe(401);
        });

        it('returns the secret once and never the address', async () => {
            const created = await createWebhook();
            expect(created.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
            expect(created.host).toBe('8.8.8.8');
            expect(JSON.stringify(created)).not.toContain('abc123');

            const list = await agent.get('/api/webhooks');
            expect(list.status).toBe(200);
            expect(list.body).toHaveLength(1);
            expect(list.body[0].secret).toBeUndefined();
            expect(JSON.stringify(list.body)).not.toContain('abc123');
        });

        it('stores the address and secret encrypted', async () => {
            const created = await createWebhook();
            const row = await Webhook.findOne({ where: { uid: created.uid } });
            expect(row.url).not.toContain('abc123');
            expect(row.secret).not.toContain(created.secret);
        });

        it('rejects unknown or missing events', async () => {
            let res = await agent
                .post('/api/webhooks')
                .send({ name: 'x', url: URL, events: ['task.exploded'] });
            expect(res.status).toBe(400);
            res = await agent
                .post('/api/webhooks')
                .send({ name: 'x', url: URL, events: [] });
            expect(res.status).toBe(400);
        });

        it('rejects private and non-http addresses', async () => {
            let res = await agent.post('/api/webhooks').send({
                name: 'x',
                url: 'http://192.168.1.10:5678/webhook',
                events: ['task.created'],
            });
            expect(res.status).toBe(400);
            res = await agent.post('/api/webhooks').send({
                name: 'x',
                url: 'ftp://8.8.8.8/hook',
                events: ['task.created'],
            });
            expect(res.status).toBe(400);
        });

        it("cannot see or change another user's webhook", async () => {
            const created = await createWebhook();
            const other = await createTestUser({
                email: `webhooks_other_${Date.now()}@example.com`,
            });
            const otherAgent = await login(other);
            const res = await otherAgent
                .patch(`/api/webhooks/${created.uid}`)
                .send({ name: 'mine now' });
            expect(res.status).toBe(404);
            const del = await otherAgent.delete(`/api/webhooks/${created.uid}`);
            expect(del.status).toBe(404);
        });

        it('rotates the secret', async () => {
            const created = await createWebhook();
            const res = await agent.post(`/api/webhooks/${created.uid}/secret`);
            expect(res.status).toBe(200);
            expect(res.body.secret).toMatch(/^whsec_/);
            expect(res.body.secret).not.toBe(created.secret);
        });

        it('deletes a webhook with its deliveries', async () => {
            const created = await createWebhook();
            await agent.post('/api/task').send({ name: 'Queued' });
            expect(await pending()).toHaveLength(1);

            const res = await agent.delete(`/api/webhooks/${created.uid}`);
            expect(res.status).toBe(200);
            expect(await Webhook.count({ where: { user_id: user.id } })).toBe(
                0
            );
            expect(await pending()).toHaveLength(0);
        });
    });

    describe('task events', () => {
        it('sends task.created with a signature the receiver can check', async () => {
            const { secret } = await createWebhook();
            const create = await agent
                .post('/api/task')
                .send({ name: 'Buy milk', priority: 2 });
            expect(create.status).toBe(201);

            const [delivery] = await pending();
            expect(delivery.event).toBe('task.created');
            expect(delivery.status).toBe('pending');

            await dispatcher.processDue();

            expect(safeRequest).toHaveBeenCalledTimes(1);
            const call = safeRequest.mock.calls[0][0];
            expect(call.method).toBe('POST');
            expect(call.url).toBe(URL);

            const body = JSON.parse(call.data);
            expect(body.event).toBe('task.created');
            expect(body.text).toBe('New task: Buy milk');
            expect(body.content).toBe(body.text);
            expect(body.data.task).toMatchObject({
                uid: create.body.uid,
                name: 'Buy milk',
                priority: 'high',
                status: 'not_started',
            });

            const ts = call.headers['X-Tududi-Timestamp'];
            const expected = crypto
                .createHmac('sha256', secret)
                .update(`${ts}.${call.data}`)
                .digest('hex');
            expect(call.headers['X-Tududi-Signature']).toBe(
                `sha256=${expected}`
            );
            expect(call.headers['X-Tududi-Event']).toBe('task.created');
            expect(call.headers['X-Tududi-Delivery']).toBe(body.id);

            await delivery.reload();
            expect(delivery.status).toBe('delivered');
            expect(delivery.attempts).toBe(1);
        });

        it('only sends the events a webhook picked', async () => {
            await createWebhook({ events: ['task.completed'] });
            const create = await agent.post('/api/task').send({ name: 'A' });
            expect(await pending()).toHaveLength(0);

            await agent
                .patch(`/api/task/${create.body.uid}`)
                .send({ status: Task.STATUS.DONE });
            const rows = await pending();
            expect(rows.map((r) => r.event)).toEqual(['task.completed']);
        });

        it('sends task.updated with the fields that changed', async () => {
            await createWebhook({ events: ['task.updated'] });
            const create = await agent.post('/api/task').send({ name: 'A' });
            await agent
                .patch(`/api/task/${create.body.uid}`)
                .send({ name: 'B' });

            const [delivery] = await pending();
            const body = JSON.parse(delivery.payload);
            expect(body.event).toBe('task.updated');
            expect(body.data.changed).toEqual(['name']);
            expect(body.data.task.name).toBe('B');
        });

        it('sends task.deleted', async () => {
            await createWebhook({ events: ['task.deleted'] });
            const create = await agent.post('/api/task').send({ name: 'Gone' });
            const del = await agent.delete(`/api/task/${create.body.uid}`);
            expect(del.status).toBe(200);

            const [delivery] = await pending();
            expect(delivery.event).toBe('task.deleted');
            expect(JSON.parse(delivery.payload).data.task.uid).toBe(
                create.body.uid
            );
        });

        it('sends nothing from a turned-off webhook', async () => {
            const created = await createWebhook();
            await agent
                .patch(`/api/webhooks/${created.uid}`)
                .send({ enabled: false });
            await agent.post('/api/task').send({ name: 'Quiet' });
            expect(await pending()).toHaveLength(0);
        });
    });

    describe('notification events', () => {
        it('sends a due-soon notification', async () => {
            await createWebhook({ events: ['task.due_soon'] });
            await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Task due soon',
                message: 'Pay rent is due tomorrow',
                data: { taskUid: 'abc', taskName: 'Pay rent' },
            });

            const [delivery] = await pending();
            const body = JSON.parse(delivery.payload);
            expect(body.event).toBe('task.due_soon');
            expect(body.text).toBe('Task due soon: Pay rent is due tomorrow');
            expect(body.data.taskUid).toBe('abc');
            expect(body.data.notification.type).toBe('task_due_soon');
        });

        it('tells a deferred task apart from a due one', async () => {
            await createWebhook({ events: ['task.deferred_ready'] });
            await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Task is now active',
                message: 'x',
                data: { reason: 'defer_until_reached' },
            });
            const rows = await pending();
            expect(rows.map((r) => r.event)).toEqual(['task.deferred_ready']);
        });

        it('does not send system notifications', async () => {
            await createWebhook({ events: ['task.due_soon'] });
            await Notification.createNotification({
                userId: user.id,
                type: 'system',
                title: 'Billing',
                message: 'x',
            });
            expect(await pending()).toHaveLength(0);
        });
    });

    describe('retries', () => {
        it('retries a server error later', async () => {
            await createWebhook();
            await agent.post('/api/task').send({ name: 'A' });
            safeRequest.mockRejectedValueOnce(httpError(503));

            await dispatcher.processDue();
            const [delivery] = await pending();
            expect(delivery.status).toBe('pending');
            expect(delivery.attempts).toBe(1);
            expect(delivery.response_status).toBe(503);
            expect(delivery.error).toBe('HTTP 503');
            expect(delivery.next_attempt_at.getTime()).toBeGreaterThan(
                Date.now()
            );

            // Not due yet: nothing is sent.
            await dispatcher.processDue();
            expect(safeRequest).toHaveBeenCalledTimes(1);

            await dispatcher.processDue({
                now: new Date(Date.now() + 2 * 60 * 1000),
            });
            await delivery.reload();
            expect(delivery.status).toBe('delivered');
            expect(delivery.attempts).toBe(2);
        });

        it('gives up at once when the receiver refuses the message', async () => {
            const created = await createWebhook();
            await agent.post('/api/task').send({ name: 'A' });
            safeRequest.mockRejectedValueOnce(httpError(410));

            await dispatcher.processDue();
            const [delivery] = await pending();
            expect(delivery.status).toBe('failed');

            const row = await Webhook.findOne({ where: { uid: created.uid } });
            expect(row.failure_count).toBe(1);
            expect(row.last_delivery_status).toBe('failed');
        });

        it('turns the webhook off after too many failures in a row', async () => {
            const created = await createWebhook();
            const row = await Webhook.findOne({ where: { uid: created.uid } });
            await row.update({
                failure_count: dispatcher.DISABLE_AFTER_FAILURES - 1,
            });
            await agent.post('/api/task').send({ name: 'A' });
            safeRequest.mockRejectedValueOnce(httpError(404));

            await dispatcher.processDue();
            await row.reload();
            expect(row.enabled).toBe(false);
            expect(row.disabled_reason).toBe('failures');

            const list = await agent.get('/api/webhooks');
            expect(list.body[0]).toMatchObject({
                enabled: false,
                disabled_reason: 'failures',
            });

            // Turning it back on clears the count.
            await agent
                .patch(`/api/webhooks/${created.uid}`)
                .send({ enabled: true });
            await row.reload();
            expect(row.enabled).toBe(true);
            expect(row.failure_count).toBe(0);
        });

        it('lists recent deliveries without the payload', async () => {
            const created = await createWebhook();
            await agent.post('/api/task').send({ name: 'A' });
            await dispatcher.processDue();

            const res = await agent.get(
                `/api/webhooks/${created.uid}/deliveries`
            );
            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0]).toMatchObject({
                event: 'task.created',
                status: 'delivered',
            });
            expect(res.body[0].payload).toBeUndefined();
        });
    });

    describe('test message', () => {
        it('sends a test event and reports success', async () => {
            const created = await createWebhook();
            const res = await agent.post(`/api/webhooks/${created.uid}/test`);
            expect(res.status).toBe(200);
            expect(res.body.delivered).toBe(true);
            const body = JSON.parse(safeRequest.mock.calls[0][0].data);
            expect(body.event).toBe('test');
        });

        it('reports what the receiver answered', async () => {
            const created = await createWebhook();
            safeRequest.mockRejectedValueOnce(httpError(401));
            const res = await agent.post(`/api/webhooks/${created.uid}/test`);
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('HTTP 401');
        });
    });

    describe('daily summary', () => {
        it('sends once a day, at the chosen local hour', async () => {
            await User.update(
                { timezone: 'Europe/Athens' },
                { where: { id: user.id } }
            );
            await createWebhook({ events: ['daily_summary'], summary_hour: 8 });
            await Task.create({
                user_id: user.id,
                name: 'Late',
                due_date: new Date('2026-06-25T12:00:00Z'),
            });

            // Athens is UTC+3 in summer: 05:30 UTC is 08:30 there.
            const atEight = new Date('2026-07-01T05:30:00Z');
            const atSeven = new Date('2026-07-01T04:30:00Z');

            await sendDueSummaries({ now: atSeven });
            expect(await pending()).toHaveLength(0);

            await sendDueSummaries({ now: atEight });
            const [delivery] = await pending();
            expect(delivery.event).toBe('daily_summary');
            const body = JSON.parse(delivery.payload);
            expect(body.data.date).toBe('2026-07-01');
            expect(body.data.overdue.map((t) => t.name)).toContain('Late');
            expect(body.text).toContain('Overdue');

            await sendDueSummaries({
                now: new Date('2026-07-01T05:50:00Z'),
            });
            expect(await pending()).toHaveLength(1);
        });
    });
});
