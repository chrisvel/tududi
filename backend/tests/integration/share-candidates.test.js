const request = require('supertest');
const app = require('../../app');
const { Project, Permission } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Share candidates (picking a workspace member)', () => {
    let owner, member, stranger, ownerAgent, project;

    beforeEach(async () => {
        const stamp = Date.now();
        owner = await createTestUser({ email: `owner_${stamp}@example.com` });
        member = await createTestUser({
            email: `member_${stamp}@example.com`,
            name: 'Emma',
            surname: 'Stone',
        });
        stranger = await createTestUser({
            email: `stranger_${stamp}@example.com`,
            name: 'Nobody',
        });
        await member.update({ created_by_user_id: owner.id });
        ownerAgent = await login(owner);

        project = await Project.create({
            name: 'Picker project',
            user_id: owner.id,
        });
    });

    const shareWithId = (id) =>
        ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_id: id,
            access_level: 'rw',
        });

    it('lists workspace members by name, without emails or strangers', async () => {
        const res = await ownerAgent.get('/api/shares/candidates');

        expect(res.status).toBe(200);
        expect(res.body.users).toEqual([
            { id: member.id, uid: member.uid, name: 'Emma Stone' },
        ]);
        expect(JSON.stringify(res.body)).not.toContain('@example.com');
    });

    it('requires a login', async () => {
        const res = await request(app).get('/api/shares/candidates');
        expect(res.status).toBe(401);
    });

    it('shares with a picked member as a pending invitation', async () => {
        const res = await shareWithId(member.id);
        expect(res.status).toBe(204);

        const row = await Permission.findOne({
            where: {
                user_id: member.id,
                resource_type: 'project',
                resource_uid: project.uid,
            },
        });
        expect(row).not.toBeNull();
        expect(row.status).toBe('pending');
        expect(row.access_level).toBe('rw');
    });

    it('refuses a user id outside the workspace', async () => {
        const res = await shareWithId(stranger.id);
        expect(res.status).toBe(404);

        const row = await Permission.findOne({
            where: { user_id: stranger.id, resource_uid: project.uid },
        });
        expect(row).toBeNull();
    });

    it('refuses an email and a user id together', async () => {
        const res = await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_id: member.id,
            target_user_email: member.email,
            access_level: 'ro',
        });
        expect(res.status).toBe(400);
    });
});
