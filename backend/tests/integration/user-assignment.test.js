const request = require('supertest');
const app = require('../../app');
const { Person, Notification, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('User Assignment', () => {
    let owner, member, outsider, ownerAgent, memberAgent, outsiderAgent;
    let project;

    const selfPersonOf = (user) =>
        Person.findOne({
            where: { user_id: user.id, linked_user_id: user.id },
        });

    beforeEach(async () => {
        owner = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });
        member = await createTestUser({
            email: `member_${Date.now()}@test.com`,
            name: 'Member',
            timezone: 'UTC',
        });
        outsider = await createTestUser({
            email: `outsider_${Date.now()}@test.com`,
            name: 'Outsider',
            timezone: 'UTC',
        });

        ownerAgent = request.agent(app);
        memberAgent = request.agent(app);
        outsiderAgent = request.agent(app);
        await ownerAgent
            .post('/api/login')
            .send({ email: owner.email, password: 'password123' });
        await memberAgent
            .post('/api/login')
            .send({ email: member.email, password: 'password123' });
        await outsiderAgent
            .post('/api/login')
            .send({ email: outsider.email, password: 'password123' });

        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Assignment Project',
        });
        project = projectResponse.body;

        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: member.email,
            access_level: 'rw',
        });
    });

    afterAll(async () => {
        await sequelize.close();
    });

    describe('participants endpoint', () => {
        test('lists owner and share recipients with self-person uids', async () => {
            const res = await ownerAgent.get(
                `/api/project/${project.uid}/participants`
            );
            expect(res.status).toBe(200);
            const participants = res.body.participants;
            expect(participants).toHaveLength(2);

            const ownerRow = participants.find((p) => p.user_id === owner.id);
            const memberRow = participants.find((p) => p.user_id === member.id);
            expect(ownerRow.is_owner).toBe(true);
            expect(participants[0].is_owner).toBe(true); // owner sorted first
            const memberSelf = await selfPersonOf(member);
            expect(memberRow.person_uid).toBe(memberSelf.uid);
        });

        test('is available to share recipients (unlike GET /shares)', async () => {
            const res = await memberAgent.get(
                `/api/project/${project.uid}/participants`
            );
            expect(res.status).toBe(200);
            expect(res.body.participants).toHaveLength(2);
        });

        test('is denied for users without access', async () => {
            const res = await outsiderAgent.get(
                `/api/project/${project.uid}/participants`
            );
            expect([403, 404]).toContain(res.status);
        });
    });

    describe('assigning to a participant', () => {
        test('owner assigns to member self-person; member is notified', async () => {
            const memberSelf = await selfPersonOf(member);
            const res = await ownerAgent.post('/api/task').send({
                name: 'Assigned Task',
                project_id: project.id,
                assigned_to: memberSelf.uid,
            });
            expect(res.status).toBe(201);
            expect(res.body.assigned_to).toBe(memberSelf.uid);

            const notifications = await Notification.findAll({
                where: { user_id: member.id, type: 'task_assigned' },
            });
            expect(notifications).toHaveLength(1);
            expect(notifications[0].message).toContain('Assigned Task');
        });

        test('serializer resolves assigned person for every viewer', async () => {
            const memberSelf = await selfPersonOf(member);
            await ownerAgent.post('/api/task').send({
                name: 'Visible Assignment',
                project_id: project.id,
                assigned_to: memberSelf.uid,
            });

            const res = await memberAgent.get('/api/tasks');
            const tasks = res.body.tasks || res.body;
            const task = tasks.find((t) => t.name === 'Visible Assignment');
            expect(task).toBeDefined();
            expect(task.assigned_person).toMatchObject({
                uid: memberSelf.uid,
                linked_user_id: member.id,
                email: member.email,
            });
        });

        test('re-saving without changing assignment does not re-notify', async () => {
            const memberSelf = await selfPersonOf(member);
            const created = await ownerAgent.post('/api/task').send({
                name: 'Stable Task',
                project_id: project.id,
                assigned_to: memberSelf.uid,
            });

            await ownerAgent
                .patch(`/api/task/${created.body.uid}`)
                .send({ name: 'Stable Task renamed' });

            const notifications = await Notification.findAll({
                where: { user_id: member.id, type: 'task_assigned' },
            });
            expect(notifications).toHaveLength(1);
        });

        test('self-assignment does not notify', async () => {
            const ownerSelf = await selfPersonOf(owner);
            await ownerAgent.post('/api/task').send({
                name: 'My Own Task',
                project_id: project.id,
                assigned_to: ownerSelf.uid,
            });
            const notifications = await Notification.findAll({
                where: { user_id: owner.id, type: 'task_assigned' },
            });
            expect(notifications).toHaveLength(0);
        });

        test('member with rw can assign a shared task back to the owner', async () => {
            const created = await ownerAgent.post('/api/task').send({
                name: 'Reassignable',
                project_id: project.id,
            });
            const ownerSelf = await selfPersonOf(owner);

            const res = await memberAgent
                .patch(`/api/task/${created.body.uid}`)
                .send({ assigned_to: ownerSelf.uid });
            expect(res.status).toBe(200);

            const notifications = await Notification.findAll({
                where: { user_id: owner.id, type: 'task_assigned' },
            });
            expect(notifications).toHaveLength(1);
        });

        test('cannot assign to a non-participant self-person', async () => {
            const outsiderSelf = await selfPersonOf(outsider);
            const res = await ownerAgent.post('/api/task').send({
                name: 'Bad Assignment',
                project_id: project.id,
                assigned_to: outsiderSelf.uid,
            });
            expect(res.status).toBe(403);
        });

        test('cannot assign a projectless task to another user', async () => {
            const memberSelf = await selfPersonOf(member);
            const res = await ownerAgent.post('/api/task').send({
                name: 'No Project Task',
                assigned_to: memberSelf.uid,
            });
            expect(res.status).toBe(403);
        });

        test('rejects a nonexistent person uid', async () => {
            const res = await ownerAgent.post('/api/task').send({
                name: 'Ghost Assignment',
                project_id: project.id,
                assigned_to: 'doesnotexist12345',
            });
            expect(res.status).toBe(400);
        });

        test('assigning to an own unlinked person still works (solo behaviour)', async () => {
            const personRes = await ownerAgent.post('/api/people').send({
                name: 'Plain Contact',
            });
            expect(personRes.status).toBe(201);
            const res = await ownerAgent.post('/api/task').send({
                name: 'Delegated To Contact',
                assigned_to: personRes.body.person.uid,
            });
            expect(res.status).toBe(201);

            const list = await ownerAgent.get('/api/tasks');
            const tasks = list.body.tasks || list.body;
            const task = tasks.find((t) => t.name === 'Delegated To Contact');
            expect(task.assigned_person).toMatchObject({
                name: 'Plain Contact',
                linked_user_id: null,
            });
        });
    });

    describe('assigned_to_me filter', () => {
        test('returns exactly the visible tasks assigned to me', async () => {
            const memberSelf = await selfPersonOf(member);
            await ownerAgent.post('/api/task').send({
                name: 'For Member',
                project_id: project.id,
                assigned_to: memberSelf.uid,
            });
            await ownerAgent.post('/api/task').send({
                name: 'Not For Member',
                project_id: project.id,
            });

            const res = await memberAgent.get('/api/tasks?assigned_to_me=true');
            expect(res.status).toBe(200);
            const tasks = res.body.tasks || res.body;
            expect(tasks.map((t) => t.name)).toEqual(['For Member']);
        });

        test('is empty for a user nothing is assigned to', async () => {
            const res = await outsiderAgent.get(
                '/api/tasks?assigned_to_me=true'
            );
            expect(res.status).toBe(200);
            const tasks = res.body.tasks || res.body;
            expect(tasks).toHaveLength(0);
        });
    });
});
