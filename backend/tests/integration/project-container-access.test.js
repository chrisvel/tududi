const request = require('supertest');
const app = require('../../app');
const { Area, Goal, Project, Permission } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Projects: area and goal must be the caller’s to use', () => {
    let user, other, agent, otherAgent, ownArea, foreignArea, foreignGoal;

    beforeEach(async () => {
        const stamp = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        user = await createTestUser({ email: `pca_user_${stamp}@example.com` });
        other = await createTestUser({
            email: `pca_other_${stamp}@example.com`,
        });
        agent = await login(user);
        otherAgent = await login(other);

        ownArea = await Area.create({ name: 'Mine', user_id: user.id });
        foreignArea = await Area.create({
            name: 'Not mine',
            user_id: other.id,
        });
        foreignGoal = await Goal.create({
            title: 'Not my goal',
            user_id: other.id,
        });
    });

    const shareArea = async (accessLevel) => {
        const res = await otherAgent.post('/api/shares').send({
            resource_type: 'area',
            resource_uid: foreignArea.uid,
            target_user_email: user.email,
            access_level: accessLevel,
        });
        expect([200, 201, 204]).toContain(res.status);
        await acceptAllInvitations(agent);
    };

    it('creates a project in an area the user owns', async () => {
        const res = await agent
            .post('/api/project')
            .send({ name: 'Ok', area_id: ownArea.id });
        expect(res.status).toBe(201);
        expect(res.body.area_id).toBe(ownArea.id);
    });

    it("refuses a project in another user's area or goal", async () => {
        for (const body of [
            { name: 'x', area_id: foreignArea.id },
            { name: 'x', area_id: foreignArea.uid },
            { name: 'x', goal_id: foreignGoal.id },
            { name: 'x', area_id: 999999 },
        ]) {
            const res = await agent.post('/api/project').send(body);
            expect(res.status).toBe(400);
        }
        expect(await Project.count({ where: { user_id: user.id } })).toBe(0);
    });

    it("does not copy the foreign area's shares onto the project", async () => {
        const third = await createTestUser({
            email: `pca_third_${Date.now()}@example.com`,
        });
        await otherAgent.post('/api/shares').send({
            resource_type: 'area',
            resource_uid: foreignArea.uid,
            target_user_email: third.email,
            access_level: 'ro',
        });

        const created = await agent.post('/api/project').send({ name: 'Mine' });
        const res = await agent
            .patch(`/api/project/${created.body.uid}`)
            .send({ area_id: foreignArea.id, goal_id: foreignGoal.id });

        expect(res.status).toBe(400);
        const stored = await Project.findOne({
            where: { uid: created.body.uid },
        });
        expect(stored.area_id).toBeNull();
        expect(stored.goal_id).toBeNull();
        expect(
            await Permission.count({
                where: {
                    resource_type: 'project',
                    resource_uid: created.body.uid,
                },
            })
        ).toBe(0);
    });

    it("refuses moving a project to another user's goal", async () => {
        const created = await agent.post('/api/project').send({ name: 'Mine' });
        const res = await agent
            .patch(`/api/project/${created.body.uid}`)
            .send({ goal_id: foreignGoal.id });

        expect(res.status).toBe(400);
        expect(res.body.Goal).toBeUndefined();
    });

    it('lets a read-write collaborator file a project in a shared area', async () => {
        await shareArea('rw');
        const res = await agent
            .post('/api/project')
            .send({ name: 'Shared', area_id: foreignArea.id });
        expect(res.status).toBe(201);
        expect(res.body.area_id).toBe(foreignArea.id);
    });

    it('refuses a read-only collaborator', async () => {
        await shareArea('ro');
        const res = await agent
            .post('/api/project')
            .send({ name: 'Shared', area_id: foreignArea.id });
        expect(res.status).toBe(400);
    });

    it('keeps an existing area the user can no longer edit', async () => {
        const project = await Project.create({
            name: 'Legacy',
            user_id: user.id,
            area_id: foreignArea.id,
        });
        const res = await agent
            .patch(`/api/project/${project.uid}`)
            .send({ name: 'Renamed', area_id: foreignArea.id });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Renamed');
    });
});
