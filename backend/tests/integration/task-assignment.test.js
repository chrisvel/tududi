const request = require('supertest');
const app = require('../../app');
const { Task, Notification, Person } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

const login = async (user) => {
    const agent = request.agent(app);
    await agent
        .post('/api/login')
        .send({ email: user.email, password: 'password123' });
    return agent;
};

describe('Task assignment notifies and surfaces to the assignee', () => {
    let owner, assignee, ownerAgent, assigneeAgent, assigneeSelfPerson, project;

    beforeEach(async () => {
        owner = await createTestUser({
            email: `assignowner_${Date.now()}@example.com`,
            name: 'Owner',
        });
        assignee = await createTestUser({
            email: `assignee_${Date.now()}@example.com`,
            name: 'Assignee',
        });
        await peopleService.createSelfPerson(owner);
        assigneeSelfPerson = await peopleService.createSelfPerson(assignee);

        ownerAgent = await login(owner);
        assigneeAgent = await login(assignee);

        const res = await ownerAgent
            .post('/api/project')
            .send({ name: 'Weekend logistics' });
        project = res.body;
        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: assignee.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(assigneeAgent);
    });

    it('shows an assigned task in the assignee lists and lets them open it', async () => {
        const created = await ownerAgent.post('/api/task').send({
            name: 'Drive to tennis',
            project_uid: project.uid,
            assigned_to: assigneeSelfPerson.uid,
        });
        expect(created.status).toBe(201);

        const list = await assigneeAgent.get(
            '/api/tasks?assigned_to=me&status=active'
        );
        expect(list.status).toBe(200);
        expect(
            list.body.tasks.find((t) => t.name === 'Drive to tennis')
        ).toBeDefined();

        const detail = await assigneeAgent.get(`/api/task/${created.body.uid}`);
        expect(detail.status).toBe(200);
    });

    it('creates a task_assigned notification for the assignee', async () => {
        const task = await Task.create({
            name: 'Buy groceries',
            user_id: owner.id,
            project_id: (await ownerAgent.get(`/api/project/${project.uid}`))
                .body.id,
        });

        const res = await ownerAgent
            .patch(`/api/task/${task.uid}`)
            .send({ assigned_to: assigneeSelfPerson.uid });
        expect(res.status).toBe(200);

        const notification = await Notification.findOne({
            where: { user_id: assignee.id, type: 'task_assigned' },
        });
        expect(notification).not.toBeNull();
        expect(notification.data.taskUid).toBe(task.uid);
    });

    it('does not notify when the assignee prefers no task_assigned notification', async () => {
        await assigneeAgent.patch('/api/profile').send({
            notification_preferences: {
                taskAssigned: {
                    inApp: false,
                    email: false,
                    push: false,
                    telegram: false,
                },
            },
        });

        const task = await Task.create({
            name: 'Return library books',
            user_id: owner.id,
        });
        await ownerAgent
            .patch(`/api/task/${task.uid}`)
            .send({ assigned_to: assigneeSelfPerson.uid });

        const count = await Notification.count({
            where: { user_id: assignee.id, type: 'task_assigned' },
        });
        expect(count).toBe(0);
    });

    it('does not notify the assigner when they assign a task to themselves', async () => {
        const selfPerson = (
            await peopleService.getAll(owner.id, { archived: false })
        ).find((p) => p.linked_user_id === owner.id);

        const task = await Task.create({
            name: 'Self task',
            user_id: owner.id,
        });
        await ownerAgent
            .patch(`/api/task/${task.uid}`)
            .send({ assigned_to: selfPerson.uid });

        const count = await Notification.count({
            where: { user_id: owner.id, type: 'task_assigned' },
        });
        expect(count).toBe(0);
    });
});

describe('A burst of assignments collapses into one notification', () => {
    let owner, assignee, other, ownerAgent, assigneeAgent, otherAgent;
    let assigneeSelfPerson, project;

    const assign = (agent, name) =>
        agent.post('/api/task').send({
            name,
            project_uid: project.uid,
            assigned_to: assigneeSelfPerson.uid,
        });

    const assignedNotices = () =>
        Notification.findAll({
            where: { user_id: assignee.id, type: 'task_assigned' },
            order: [['id', 'ASC']],
        });

    beforeEach(async () => {
        owner = await createTestUser({
            email: `batchowner_${Date.now()}@example.com`,
            name: 'Owner',
        });
        assignee = await createTestUser({
            email: `batchassignee_${Date.now()}@example.com`,
            name: 'Assignee',
        });
        other = await createTestUser({
            email: `batchother_${Date.now()}@example.com`,
            name: 'Other',
        });
        await peopleService.createSelfPerson(owner);
        assigneeSelfPerson = await peopleService.createSelfPerson(assignee);
        await peopleService.createSelfPerson(other);

        ownerAgent = await login(owner);
        assigneeAgent = await login(assignee);
        otherAgent = await login(other);

        const res = await ownerAgent
            .post('/api/project')
            .send({ name: 'Site handover' });
        project = res.body;
        for (const user of [assignee, other]) {
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: project.uid,
                target_user_email: user.email,
                access_level: 'rw',
            });
        }
        await acceptAllInvitations(assigneeAgent);
        await acceptAllInvitations(otherAgent);
    });

    it('keeps the single-task wording and link for one assignment', async () => {
        const created = await assign(ownerAgent, 'Check the keys');
        expect(created.status).toBe(201);

        const notices = await assignedNotices();
        expect(notices).toHaveLength(1);
        expect(notices[0].title).toBe('Owner assigned you a task');
        expect(notices[0].message).toBe(
            '"Check the keys" was assigned to you.'
        );
        expect(notices[0].data.taskUid).toBe(created.body.uid);
        expect(notices[0].data.count).toBe(1);
    });

    it('gives the assignee one unread notification for five quick assignments', async () => {
        const uids = [];
        for (let i = 1; i <= 5; i++) {
            const res = await assign(ownerAgent, `Snag ${i}`);
            expect(res.status).toBe(201);
            uids.push(res.body.uid);
        }

        const notices = await assignedNotices();
        expect(notices).toHaveLength(1);
        expect(notices[0].read_at).toBeNull();
        expect(notices[0].title).toBe('Owner assigned you 5 tasks');
        expect(notices[0].data.count).toBe(5);
        expect(notices[0].data.taskUids).toEqual(uids);
        expect(notices[0].data.taskUid).toBe(uids[4]);

        const unread = await Notification.count({
            where: {
                user_id: assignee.id,
                type: 'task_assigned',
                read_at: null,
            },
        });
        expect(unread).toBe(1);
    });

    it('starts a new notification once the earlier one is read', async () => {
        await assign(ownerAgent, 'Snag 1');
        await assign(ownerAgent, 'Snag 2');
        const [first] = await assignedNotices();
        await first.markAsRead();

        await assign(ownerAgent, 'Snag 3');

        const notices = await assignedNotices();
        expect(notices).toHaveLength(2);
        expect(notices[0].data.count).toBe(2);
        expect(notices[1].title).toBe('Owner assigned you a task');
        expect(notices[1].data.count).toBe(1);
    });

    it('starts a new notification once the earlier one is outside the window', async () => {
        await assign(ownerAgent, 'Snag 1');
        const [first] = await assignedNotices();
        await Notification.update(
            { created_at: new Date(Date.now() - 11 * 60 * 1000) },
            { where: { id: first.id }, silent: true }
        );

        await assign(ownerAgent, 'Snag 2');

        const notices = await assignedNotices();
        expect(notices).toHaveLength(2);
        expect(notices.map((n) => n.data.count)).toEqual([1, 1]);
    });

    it('sends one notification for a spreadsheet import full of assignments', async () => {
        const rows = Array.from(
            { length: 6 },
            (_, i) => `Row ${i + 1},${assignee.email},${project.name}`
        );
        const upload = await ownerAgent
            .post('/api/imports')
            .attach(
                'file',
                Buffer.from(['Name,Assignee,Project', ...rows].join('\n')),
                'handover.csv'
            );
        expect(upload.status).toBe(201);
        const job = upload.body;

        const committed = await ownerAgent
            .post(`/api/imports/${job.uid}/commit`)
            .send({
                sheet: 0,
                header_row: job.sheets[0].header_row,
                mapping: job.sheets[0].suggested_mapping,
                target: { mode: 'column' },
                hierarchy: 'auto',
                date_order: 'auto',
            });
        expect(committed.status).toBe(200);

        const assigned = await Task.count({
            where: { assigned_to: assigneeSelfPerson.uid },
        });
        expect(assigned).toBe(6);

        const notices = await assignedNotices();
        expect(notices).toHaveLength(1);
        expect(notices[0].title).toBe('Owner assigned you 6 tasks');
        expect(notices[0].data.count).toBe(6);
    });

    it('keeps assignments from different people in separate notifications', async () => {
        expect((await assign(ownerAgent, 'From owner 1')).status).toBe(201);
        expect((await assign(otherAgent, 'From other')).status).toBe(201);
        expect((await assign(ownerAgent, 'From owner 2')).status).toBe(201);

        const notices = await assignedNotices();
        expect(notices).toHaveLength(2);
        const byAssigner = Object.fromEntries(
            notices.map((n) => [n.data.assignedByUserId, n])
        );
        expect(byAssigner[owner.id].title).toBe('Owner assigned you 2 tasks');
        expect(byAssigner[other.id].title).toBe('Other assigned you a task');
    });
});

describe('assigned_to=me filter when the account has no linked person', () => {
    it('shows no tasks instead of falling back to unassigned tasks', async () => {
        const orphan = await createTestUser({
            email: `orphan_${Date.now()}@example.com`,
            name: 'No Person',
        });
        await Person.destroy({
            where: { user_id: orphan.id, linked_user_id: orphan.id },
        });

        await Task.create({
            name: 'Unassigned orphan task',
            user_id: orphan.id,
        });

        const agent = await login(orphan);
        const list = await agent.get('/api/tasks?assigned_to=me&status=active');
        expect(list.status).toBe(200);
        expect(
            list.body.tasks.find((t) => t.name === 'Unassigned orphan task')
        ).toBeUndefined();
    });
});
