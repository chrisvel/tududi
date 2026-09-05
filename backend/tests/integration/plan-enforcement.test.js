const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

process.env.FF_ENABLE_MCP = 'true';
process.env.FF_ENABLE_BACKUPS = 'true';

const app = require('../../app');
const { getConfig } = require('../../config/config');
const plans = require('../../config/plans');
const { Task, Project, Role } = require('../../models');
const entitlements = require('../../services/entitlementsService');
const { createTestUser } = require('../helpers/testUtils');

const config = getConfig();

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

const tinyPlans = (extra = {}) =>
    JSON.stringify({
        free: {
            limits: {
                max_tasks: 2,
                max_projects: 1,
                max_notes: 1,
                storage_mb: 1,
                ai_requests_per_day: 0,
            },
            ...extra,
        },
    });

describe('Plan enforcement over HTTP (hosted mode on)', () => {
    let user, agent;

    beforeEach(async () => {
        config.hosted.enabled = true;
        config.hosted.trialDays = 0;
        process.env.TUDUDI_PLANS_JSON = tinyPlans();
        plans._resetCache();
        entitlements.invalidate();
        user = await createTestUser({
            email: `enf_${Date.now()}@example.com`,
        });
        agent = await login(user);
    });

    afterEach(() => {
        config.hosted.enabled = false;
        config.hosted.trialDays = 14;
        delete process.env.TUDUDI_PLANS_JSON;
        plans._resetCache();
        entitlements.invalidate();
    });

    it('stops task creation with 402 and details, but never reads or edits', async () => {
        const first = await agent.post('/api/task').send({ name: 'one' });
        expect(first.status).toBe(201);
        const second = await agent.post('/api/task').send({ name: 'two' });
        expect(second.status).toBe(201);

        const third = await agent.post('/api/task').send({ name: 'three' });
        expect(third.status).toBe(402);
        expect(third.body.code).toBe('PLAN_LIMIT_REACHED');
        expect(third.body.details).toMatchObject({
            resource: 'task',
            limit: 2,
            current: 2,
            plan: 'free',
        });

        const list = await agent.get('/api/tasks?type=all');
        expect(list.status).toBe(200);
        const patch = await agent
            .patch(`/api/task/${first.body.uid}`)
            .send({ name: 'renamed' });
        expect(patch.status).toBe(200);

        // Completing one frees a slot
        await agent
            .patch(`/api/task/${second.body.uid}`)
            .send({ status: Task.STATUS.DONE });
        const fourth = await agent.post('/api/task').send({ name: 'four' });
        expect(fourth.status).toBe(201);

        const del = await agent.delete(`/api/task/${first.body.uid}`);
        expect([200, 204]).toContain(del.status);
    });

    it('counts subtasks sent with a new task against the limit', async () => {
        const res = await agent
            .post('/api/task')
            .send({ name: 'parent', subtasks: [{ name: 'a' }, { name: 'b' }] });
        expect(res.status).toBe(402);
    });

    it('limits projects and notes', async () => {
        const p1 = await agent.post('/api/project').send({ name: 'p1' });
        expect(p1.status).toBe(201);
        const p2 = await agent.post('/api/project').send({ name: 'p2' });
        expect(p2.status).toBe(402);
        expect(p2.body.code).toBe('PLAN_LIMIT_REACHED');

        const n1 = await agent
            .post('/api/note')
            .send({ title: 'n1', content: 'c' });
        expect(n1.status).toBe(201);
        const n2 = await agent
            .post('/api/note')
            .send({ title: 'n2', content: 'c' });
        expect(n2.status).toBe(402);
    });

    it('refuses plan-only features with FEATURE_NOT_IN_PLAN', async () => {
        const mcp = await agent.get('/api/mcp/config');
        expect(mcp.status).toBe(402);
        expect(mcp.body.code).toBe('FEATURE_NOT_IN_PLAN');
        expect(mcp.body.details.feature).toBe('mcp');

        const tg = await agent
            .post('/api/telegram/setup')
            .send({ token: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi' });
        expect(tg.status).toBe(402);

        const profile = await agent.patch('/api/profile').send({
            telegram_bot_token: '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi',
        });
        expect(profile.status).toBe(402);

        const ai = await agent.post('/api/ai-assistant/daily-brief').send({});
        expect(ai.status).toBe(402);

        const restore = await agent.post('/api/backup/nope/restore');
        expect(restore.status).toBe(402);
        const exportRes = await agent.post('/api/backup/export');
        expect(exportRes.status).toBe(200);
    });

    it('enforces the storage quota on upload and cleans the file up', async () => {
        const task = await Task.create({ name: 't', user_id: user.id });
        const big = Buffer.alloc(1200 * 1024, 'x');

        const res = await agent
            .post('/api/upload/task-attachment')
            .field('taskUid', task.uid)
            .attach('file', big, {
                filename: 'big.txt',
                contentType: 'text/plain',
            });
        expect(res.status).toBe(402);
        expect(res.body.details.resource).toBe('storage');

        const uploadsDir = path.join(config.uploadPath, 'tasks');
        const files = await fs.readdir(uploadsDir).catch(() => []);
        expect(files.filter((f) => f.includes('big'))).toEqual([]);
    });

    it('lets an admin through everything', async () => {
        await Role.update({ is_admin: true }, { where: { user_id: user.id } });
        entitlements.invalidate(user.id);

        for (const name of ['a', 'b', 'c']) {
            const res = await agent.post('/api/task').send({ name });
            expect(res.status).toBe(201);
        }
        const mcp = await agent.get('/api/mcp/config');
        expect(mcp.status).toBe(200);
    });
});

describe('Plan enforcement with hosted mode off', () => {
    it('never answers 402', async () => {
        const user = await createTestUser({
            email: `off_${Date.now()}@example.com`,
        });
        const agent = await login(user);

        for (let i = 0; i < 3; i++) {
            const res = await agent.post('/api/task').send({ name: `t${i}` });
            expect(res.status).toBe(201);
        }
        await Project.create({ name: 'x', user_id: user.id });
        const project = await agent.post('/api/project').send({ name: 'y' });
        expect(project.status).toBe(201);
        const mcp = await agent.get('/api/mcp/config');
        expect(mcp.status).toBe(200);
    });
});
