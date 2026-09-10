const request = require('supertest');
const app = require('../../app');
const { Task, Notification } = require('../../models');
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
