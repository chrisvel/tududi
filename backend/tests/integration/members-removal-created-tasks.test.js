const request = require('supertest');

jest.mock('../../services/emailService', () => ({
    isEmailEnabled: () => true,
    initializeEmailService: () => {},
    verifyEmailConnection: async () => ({ success: true }),
    sendEmail: async () => ({ success: true, messageId: 'test' }),
}));

const app = require('../../app');
const {
    User,
    Project,
    Task,
    Tag,
    Area,
    TaskAttachment,
    TaskEvent,
    Comment,
    Permission,
    sequelize,
} = require('../../models');
const rolesService = require('../../services/rolesService');
const { createTestUser } = require('../helpers/testUtils');

// Removing a member used to delete every task they created, even in projects
// that belong to someone else (#2035). Those tasks now stay in the project
// and pass to its owner; only the member's own items go.

const login = async (email, password = 'password123') => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ email, password });
    return agent;
};

const addMember = async (agent, body) => {
    const res = await agent
        .post('/api/members')
        .send({ password: 'password123', ...body });
    if (res.status !== 201) {
        throw new Error(
            `could not add a member: ${res.status} ${JSON.stringify(res.body)}`
        );
    }
    return res.body;
};

const tagIdsOf = async (task) =>
    (
        await sequelize.models.tasks_tags.findAll({
            where: { task_id: task.id },
            raw: true,
        })
    ).map((row) => row.tag_id);

describe('Removing a member keeps the tasks they created in shared projects', () => {
    let stamp, admin, lead, leadAgent, bea, cal;
    let project, task, subtask, instance, attachment, event, comment;
    let leadTag, beaTag, beaArea, ownProject, ownTask, inboxTask;

    afterAll(async () => {
        await sequelize.close();
    });

    beforeEach(async () => {
        stamp = `${Date.now()}_${Math.round(Math.random() * 1e6)}`;
        admin = await createTestUser({ email: `admin_${stamp}@example.com` });
        await rolesService.setRole(admin.id, 'admin');
        lead = await createTestUser({
            email: `lead_${stamp}@example.com`,
            name: 'Lea',
        });
        await rolesService.setRole(lead.id, 'user');
        await rolesService.setCapabilities(lead.id, { invite_members: true });
        leadAgent = await login(lead.email);

        bea = await addMember(leadAgent, {
            email: `bea_${stamp}@example.com`,
            name: 'Bea',
        });
        cal = await addMember(leadAgent, {
            email: `cal_${stamp}@example.com`,
            name: 'Cal',
        });

        project = await Project.create({
            name: `Shared ${stamp}`,
            user_id: lead.id,
        });
        await Permission.create({
            user_id: bea.id,
            resource_type: 'project',
            resource_uid: project.uid,
            access_level: 'rw',
            propagation: 'direct',
            granted_by_user_id: lead.id,
            status: 'accepted',
        });

        beaArea = await Area.create({ name: 'Bea area', user_id: bea.id });
        task = await Task.create({
            name: 'Bea task in the shared project',
            user_id: bea.id,
            project_id: project.id,
            area_id: beaArea.id,
            assigned_to: bea.person_uid,
            status: Task.STATUS.NOT_STARTED,
        });
        subtask = await Task.create({
            name: 'Bea subtask',
            user_id: bea.id,
            parent_task_id: task.id,
            status: Task.STATUS.NOT_STARTED,
        });
        instance = await Task.create({
            name: 'Bea recurring instance',
            user_id: bea.id,
            recurring_parent_id: task.id,
            status: Task.STATUS.NOT_STARTED,
        });

        attachment = await TaskAttachment.create({
            task_id: task.id,
            user_id: bea.id,
            original_filename: 'plan.pdf',
            stored_filename: `plan_${stamp}.pdf`,
            file_size: 10,
            mime_type: 'application/pdf',
            file_path: `tasks/plan_${stamp}.pdf`,
        });
        event = await TaskEvent.create({
            task_id: task.id,
            user_id: bea.id,
            event_type: 'created',
        });
        comment = await Comment.create({
            task_id: task.id,
            user_id: lead.id,
            body: 'Looks good',
        });

        leadTag = await Tag.create({ name: `lead_${stamp}`, user_id: lead.id });
        beaTag = await Tag.create({ name: `bea_${stamp}`, user_id: bea.id });
        await sequelize.models.tasks_tags.bulkCreate([
            { task_id: task.id, tag_id: leadTag.id },
            { task_id: task.id, tag_id: beaTag.id },
        ]);

        ownProject = await Project.create({
            name: `Bea own ${stamp}`,
            user_id: bea.id,
        });
        ownTask = await Task.create({
            name: 'Bea private task',
            user_id: bea.id,
            project_id: ownProject.id,
        });
        inboxTask = await Task.create({
            name: 'Bea loose task',
            user_id: bea.id,
        });
    });

    const expectHandedToLead = async () => {
        expect(await User.findByPk(bea.id)).toBeNull();

        const kept = await Task.findByPk(task.id);
        expect(kept).not.toBeNull();
        expect(kept.user_id).toBe(lead.id);
        expect(kept.project_id).toBe(project.id);
        expect(kept.area_id).toBeNull();

        expect((await Task.findByPk(subtask.id)).user_id).toBe(lead.id);
        expect((await Task.findByPk(instance.id)).user_id).toBe(lead.id);
        expect((await TaskAttachment.findByPk(attachment.id)).user_id).toBe(
            lead.id
        );
        expect((await TaskEvent.findByPk(event.id)).user_id).toBe(lead.id);
        expect(await Comment.findByPk(comment.id)).not.toBeNull();
        expect(await tagIdsOf(task)).toEqual([leadTag.id]);

        expect(await Task.findByPk(ownTask.id)).toBeNull();
        expect(await Task.findByPk(inboxTask.id)).toBeNull();
        expect(await Project.findByPk(ownProject.id)).toBeNull();
        expect(await Tag.findByPk(beaTag.id)).toBeNull();
    };

    it('passes them to the project owner when a member is removed', async () => {
        const res = await leadAgent.delete(`/api/members/${bea.id}`);

        expect(res.status).toBe(204);
        await expectHandedToLead();
        expect((await Task.findByPk(task.id)).assigned_to).toBeNull();

        const shown = await leadAgent.get(`/api/task/${task.uid}`);
        expect(shown.status).toBe(200);
        expect(shown.body.name).toBe('Bea task in the shared project');
    });

    it('hands their own open tasks there to the chosen member too', async () => {
        const handoff = await leadAgent.get(`/api/members/${bea.id}/handoff`);
        expect(handoff.body.open_assigned_tasks).toBe(1);

        const res = await leadAgent
            .delete(`/api/members/${bea.id}`)
            .send({ reassign_to: cal.id });

        expect(res.status).toBe(204);
        const kept = await Task.findByPk(task.id);
        expect(kept.user_id).toBe(lead.id);
        expect(kept.assigned_to).toBe(cal.person_uid);
    });

    it('does the same when an admin deletes the account', async () => {
        const adminAgent = await login(admin.email);

        const res = await adminAgent.delete(`/api/admin/users/${bea.id}`);

        expect(res.status).toBeLessThan(300);
        await expectHandedToLead();
    });
});
