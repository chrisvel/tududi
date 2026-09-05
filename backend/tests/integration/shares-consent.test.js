const request = require('supertest');
const app = require('../../app');
const {
    Project,
    Task,
    Note,
    Permission,
    Role,
    Notification,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Share invitations (consent + no user enumeration)', () => {
    let owner, invitee, ownerAgent, inviteeAgent, project;

    beforeEach(async () => {
        owner = await createTestUser({
            email: `owner_${Date.now()}@example.com`,
        });
        invitee = await createTestUser({
            email: `invitee_${Date.now()}@example.com`,
        });
        ownerAgent = await login(owner);
        inviteeAgent = await login(invitee);

        project = await Project.create({
            name: 'Consent project',
            user_id: owner.id,
        });
        await Task.create({
            name: 'Task in consent project',
            user_id: owner.id,
            project_id: project.id,
        });
    });

    const share = (email, access = 'ro') =>
        ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: email,
            access_level: access,
        });

    it('responds identically for known and unknown emails', async () => {
        const known = await share(invitee.email);
        const unknown = await share(`nobody_${Date.now()}@example.com`);

        expect(known.status).toBe(204);
        expect(unknown.status).toBe(204);
        expect(known.text).toBe(unknown.text);
    });

    it('creates no permission for an unknown email', async () => {
        await share(`nobody_${Date.now()}@example.com`);

        const count = await Permission.count({
            where: { resource_uid: project.uid },
        });
        expect(count).toBe(0);
    });

    it('matches the target email case-insensitively', async () => {
        await share(invitee.email.toUpperCase());

        const row = await Permission.findOne({
            where: { user_id: invitee.id, resource_uid: project.uid },
        });
        expect(row).not.toBeNull();
        expect(row.status).toBe('pending');
    });

    it('keeps the resource hidden until the invitation is accepted', async () => {
        await share(invitee.email);

        const before = await inviteeAgent.get('/api/projects');
        expect(before.status).toBe(200);
        expect(
            before.body.projects.find((p) => p.uid === project.uid)
        ).toBeUndefined();

        const detail = await inviteeAgent.get(`/api/project/${project.uid}`);
        expect(detail.status).toBe(403);
    });

    it('lists pending invitations for the invitee with inviter and resource', async () => {
        await share(invitee.email, 'rw');

        const res = await inviteeAgent.get('/api/shares/invitations');
        expect(res.status).toBe(200);
        expect(res.body.invitations).toHaveLength(1);
        const inv = res.body.invitations[0];
        expect(inv.resource_type).toBe('project');
        expect(inv.resource_uid).toBe(project.uid);
        expect(inv.resource_name).toBe('Consent project');
        expect(inv.access_level).toBe('rw');
        expect(inv.inviter_email).toBe(owner.email);
    });

    it('does not show invitations to other users', async () => {
        await share(invitee.email);

        const res = await ownerAgent.get('/api/shares/invitations');
        expect(res.body.invitations).toHaveLength(0);
    });

    it('creates an in-app notification for the invitee', async () => {
        await share(invitee.email);

        const notification = await Notification.findOne({
            where: { user_id: invitee.id, type: 'share_invitation' },
        });
        expect(notification).not.toBeNull();
        expect(notification.data.resourceUid).toBe(project.uid);
        expect(notification.data.invitationId).toBeTruthy();
    });

    it('grants access to the project and its tasks once accepted', async () => {
        await share(invitee.email, 'rw');
        const list = await inviteeAgent.get('/api/shares/invitations');
        const inv = list.body.invitations[0];

        const accept = await inviteeAgent.post(
            `/api/shares/invitations/${inv.id}/accept`
        );
        expect(accept.status).toBe(200);
        expect(accept.body.resource_uid).toBe(project.uid);

        const projects = await inviteeAgent.get('/api/projects');
        expect(
            projects.body.projects.find((p) => p.uid === project.uid)
        ).toBeDefined();

        const pending = await Permission.count({
            where: { user_id: invitee.id, status: 'pending' },
        });
        expect(pending).toBe(0);

        const tasks = await inviteeAgent.get('/api/tasks');
        expect(tasks.status).toBe(200);
        expect(
            tasks.body.tasks.find((t) => t.name === 'Task in consent project')
        ).toBeDefined();
    });

    it('removes every row of the grant when declined', async () => {
        await share(invitee.email);
        const list = await inviteeAgent.get('/api/shares/invitations');
        const inv = list.body.invitations[0];

        const decline = await inviteeAgent.post(
            `/api/shares/invitations/${inv.id}/decline`
        );
        expect(decline.status).toBe(204);

        const count = await Permission.count({
            where: { user_id: invitee.id },
        });
        expect(count).toBe(0);
    });

    it("does not let another user accept someone else's invitation", async () => {
        await share(invitee.email);
        const row = await Permission.findOne({
            where: { user_id: invitee.id, propagation: 'direct' },
        });
        const stranger = await createTestUser({
            email: `stranger_${Date.now()}@example.com`,
        });
        const strangerAgent = await login(stranger);

        const res = await strangerAgent.post(
            `/api/shares/invitations/${row.id}/accept`
        );
        expect(res.status).toBe(404);

        await row.reload();
        expect(row.status).toBe('pending');
    });

    it('shows pending status in the owner share list', async () => {
        await share(invitee.email);

        const res = await ownerAgent.get(
            `/api/shares?resource_type=project&resource_uid=${project.uid}`
        );
        const row = res.body.shares.find((s) => s.user_id === invitee.id);
        expect(row.status).toBe('pending');
    });

    it('keeps an accepted share accepted when the owner re-shares it', async () => {
        await share(invitee.email, 'ro');
        const list = await inviteeAgent.get('/api/shares/invitations');
        await inviteeAgent.post(
            `/api/shares/invitations/${list.body.invitations[0].id}/accept`
        );

        await share(invitee.email, 'rw');

        const row = await Permission.findOne({
            where: {
                user_id: invitee.id,
                resource_uid: project.uid,
                propagation: 'direct',
            },
        });
        expect(row.status).toBe('accepted');
        expect(row.access_level).toBe('rw');
    });

    it('lets a non-admin owner share a task and a note directly', async () => {
        const task = await Task.create({
            name: 'Standalone task',
            user_id: owner.id,
        });
        const note = await Note.create({
            title: 'Standalone note',
            content: 'x',
            user_id: owner.id,
        });

        const taskShare = await ownerAgent.post('/api/shares').send({
            resource_type: 'task',
            resource_uid: task.uid,
            target_user_email: invitee.email,
            access_level: 'ro',
        });
        expect(taskShare.status).toBe(204);

        const noteShare = await ownerAgent.post('/api/shares').send({
            resource_type: 'note',
            resource_uid: note.uid,
            target_user_email: invitee.email,
            access_level: 'ro',
        });
        expect(noteShare.status).toBe(204);

        const rows = await Permission.count({
            where: { user_id: invitee.id, propagation: 'direct' },
        });
        expect(rows).toBe(2);
    });

    it('refuses to share a resource the caller does not own', async () => {
        const res = await inviteeAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: owner.email,
            access_level: 'ro',
        });
        expect(res.status).toBe(403);
    });
});

describe('GET /api/users is admin only', () => {
    it('returns 403 for a regular user', async () => {
        // The first user on an empty instance becomes admin, so create one
        // before the user under test.
        await createTestUser({
            email: `first_${Date.now()}@example.com`,
        });
        const user = await createTestUser({
            email: `plain_${Date.now()}@example.com`,
        });
        const agent = await login(user);

        const res = await agent.get('/api/users');
        expect(res.status).toBe(403);
    });

    it('returns the directory for an admin', async () => {
        const admin = await createTestUser({
            email: `admin_${Date.now()}@example.com`,
        });
        await Role.update({ is_admin: true }, { where: { user_id: admin.id } });
        const agent = await login(admin);

        const res = await agent.get('/api/users');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.find((u) => u.email === admin.email)).toBeDefined();
    });
});

describe('GET /api/telegram/polling-status is scoped to the caller', () => {
    it('never reports other users', async () => {
        const user = await createTestUser({
            email: `tg_${Date.now()}@example.com`,
        });
        const agent = await login(user);

        const res = await agent.get('/api/telegram/polling-status');
        expect(res.status).toBe(200);
        expect(res.body.status.usersCount).toBe(0);
        expect(res.body.status.userStatus).toEqual({});
        expect(res.body.status.running).toBe(false);
    });
});
