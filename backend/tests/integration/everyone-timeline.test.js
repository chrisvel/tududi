const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');

async function login(email) {
    const user = await createTestUser({ email, timezone: 'Europe/Athens' });
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password: 'password123' });
    return { user, agent };
}

describe('GET /api/everyone/timeline', () => {
    it("puts the viewer's own dated tasks in their lane, within the window", async () => {
        const { agent } = await login('timeline-owner@example.com');
        const project = await agent
            .post('/api/project')
            .send({ name: 'Blog Launch' });
        await agent.post('/api/task').send({
            name: 'Design layout',
            project_id: project.body.id,
            start_date: '2026-11-02',
            due_date: '2026-11-04',
            estimated_minutes: 120,
        });
        await agent.post('/api/task').send({
            name: 'Started before the window',
            start_date: '2026-10-20',
            due_date: '2026-11-03',
        });
        await agent
            .post('/api/task')
            .send({ name: 'Far away', due_date: '2026-12-20' });
        await agent.post('/api/task').send({ name: 'Undated' });

        const res = await agent.get(
            '/api/everyone/timeline?from=2026-11-01&days=14'
        );
        expect(res.status).toBe(200);
        expect(res.body.from).toBe('2026-11-01');
        expect(res.body.days).toBe(14);
        expect(res.body.day_hours).toEqual(
            expect.objectContaining({
                start: expect.any(Number),
                end: expect.any(Number),
            })
        );

        const self = res.body.lanes.find((lane) => lane.is_self);
        const names = self.tasks.map((t) => t.name).sort();
        expect(names).toEqual(['Design layout', 'Started before the window']);
        const design = self.tasks.find((t) => t.name === 'Design layout');
        expect(design.start_date).toBe('2026-11-02');
        expect(design.estimated_minutes).toBe(120);
    });

    it("never shows someone else's private tasks", async () => {
        const other = await login('timeline-other@example.com');
        await other.agent.post('/api/task').send({
            name: 'Private to other',
            start_date: '2026-11-02',
            due_date: '2026-11-03',
        });

        const { agent } = await login('timeline-viewer@example.com');
        const res = await agent.get(
            '/api/everyone/timeline?from=2026-11-01&days=14'
        );
        const all = res.body.lanes.flatMap((lane) => lane.tasks);
        expect(all.map((t) => t.name)).not.toContain('Private to other');
    });

    it('requires authentication', async () => {
        const res = await request(app).get('/api/everyone/timeline');
        expect(res.status).toBe(401);
    });
});
