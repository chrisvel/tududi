// Life-to-Day (T-305): Idempotency-Key middleware + client uid acceptance
// on task create (blueprint 13.5).
const request = require('supertest');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    LtdIdempotencyKey,
} = require('../../modules/ltd-idempotency/repository');

// 15 chars from the server uid alphabet (no l, no o) — see backend/utils/uid.js
const UID_A = 'abcde01234fghjk';
const UID_B = 'fghjk01234abcdm';

async function loginAgent(email) {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password: 'password123' });
    return agent;
}

describe('T-305 Idempotency-Key and client uid', () => {
    let userA, userB, agentA, agentB;

    beforeEach(async () => {
        userA = await createTestUser({ email: 'a@example.com' });
        userB = await createTestUser({ email: 'b@example.com' });
        agentA = await loginAgent('a@example.com');
        agentB = await loginAgent('b@example.com');
    });

    it('two identical POSTs with one key and one uid create exactly one task', async () => {
        const body = { name: 'offline task', uid: UID_A };
        const headers = { 'Idempotency-Key': 'ltd-test-create-1' };

        const first = await agentA.post('/api/task').set(headers).send(body);
        expect(first.status).toBe(201);
        expect(first.body.uid).toBe(UID_A);

        const second = await agentA.post('/api/task').set(headers).send(body);
        expect([200, 201]).toContain(second.status);
        expect(second.body.uid).toBe(UID_A);

        const count = await Task.count({ where: { user_id: userA.id } });
        expect(count).toBe(1);

        // exactly one stored key row for this user
        const keys = await LtdIdempotencyKey.count({
            where: { user_id: userA.id },
        });
        expect(keys).toBe(1);
    });

    it('a repeated uid with a different key returns the same record, no duplicate', async () => {
        const first = await agentA
            .post('/api/task')
            .set('Idempotency-Key', 'ltd-test-uid-1')
            .send({ name: 'uid task', uid: UID_A });
        expect(first.status).toBe(201);

        const second = await agentA
            .post('/api/task')
            .set('Idempotency-Key', 'ltd-test-uid-2')
            .send({ name: 'uid task', uid: UID_A });
        expect(second.status).toBe(200);
        expect(second.body.uid).toBe(UID_A);
        expect(second.body.id).toBe(first.body.id);

        const count = await Task.count({ where: { user_id: userA.id } });
        expect(count).toBe(1);
    });

    it('repeated PATCH with one key replays the first response', async () => {
        const created = await agentA
            .post('/api/task')
            .send({ name: 'patch me', uid: UID_A });
        expect(created.status).toBe(201);

        const key = { 'Idempotency-Key': 'ltd-test-patch-1' };
        const first = await agentA
            .patch(`/api/task/${UID_A}`)
            .set(key)
            .send({ name: 'patched once' });
        expect(first.status).toBe(200);

        const second = await agentA
            .patch(`/api/task/${UID_A}`)
            .set(key)
            .send({ name: 'patched once' });
        expect(second.status).toBe(200);
        expect(second.headers['idempotency-replayed']).toBe('true');
        expect(second.body.name).toBe(first.body.name);

        const task = await Task.findOne({ where: { uid: UID_A } });
        expect(task.name).toBe('patched once');
    });

    it('user B does not see user A key (keys are per-user)', async () => {
        const key = { 'Idempotency-Key': 'ltd-test-shared-key' };
        const first = await agentA
            .post('/api/task')
            .set(key)
            .send({ name: 'task of A', uid: UID_A });
        expect(first.status).toBe(201);

        // Same key from user B must execute fresh, not replay A's response.
        const second = await agentB
            .post('/api/task')
            .set(key)
            .send({ name: 'task of B', uid: UID_B });
        expect(second.status).toBe(201);
        expect(second.headers['idempotency-replayed']).toBeUndefined();
        expect(second.body.name).toBe('task of B');

        expect(await Task.count({ where: { user_id: userA.id } })).toBe(1);
        expect(await Task.count({ where: { user_id: userB.id } })).toBe(1);
    });

    it('rejects an invalid client uid with 400', async () => {
        const response = await agentA
            .post('/api/task')
            .send({ name: 'bad uid', uid: 'NOT A VALID UID!' });
        expect(response.status).toBe(400);
        expect(await Task.count({ where: { user_id: userA.id } })).toBe(0);
    });

    it('rejects a uid owned by another user with 400', async () => {
        const first = await agentA
            .post('/api/task')
            .send({ name: 'owned by A', uid: UID_A });
        expect(first.status).toBe(201);

        const second = await agentB
            .post('/api/task')
            .send({ name: 'hijack attempt', uid: UID_A });
        expect(second.status).toBe(400);
        expect(await Task.count({ where: { user_id: userB.id } })).toBe(0);
    });

    it('create still works without uid and without key (upstream behavior)', async () => {
        const response = await agentA
            .post('/api/task')
            .send({ name: 'plain task' });
        expect(response.status).toBe(201);
        expect(response.body.uid).toMatch(
            /^[0-9abcdefghijkmnpqrstuvwxyz]{15}$/
        );
    });
});
