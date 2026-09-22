const request = require('supertest');
const app = require('../../app');
const { sequelize, Person, TaskEvent, Notification } = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');
const peopleService = require('../../modules/people/service');

describe('Task comments and mentions', () => {
    let ownerUser, collaboratorUser, outsiderUser;
    let ownerAgent, collaboratorAgent, outsiderAgent;
    let project, task;

    beforeEach(async () => {
        ownerUser = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });
        collaboratorUser = await createTestUser({
            email: `collaborator_${Date.now()}@test.com`,
            name: 'Collaborator',
            timezone: 'UTC',
        });
        outsiderUser = await createTestUser({
            email: `outsider_${Date.now()}@test.com`,
            name: 'Outsider',
            timezone: 'UTC',
        });

        await peopleService.createSelfPerson(ownerUser);
        await peopleService.createSelfPerson(collaboratorUser);
        await peopleService.createSelfPerson(outsiderUser);

        ownerAgent = request.agent(app);
        collaboratorAgent = request.agent(app);
        outsiderAgent = request.agent(app);

        await ownerAgent
            .post('/api/login')
            .send({ email: ownerUser.email, password: 'password123' });
        await collaboratorAgent
            .post('/api/login')
            .send({ email: collaboratorUser.email, password: 'password123' });
        await outsiderAgent
            .post('/api/login')
            .send({ email: outsiderUser.email, password: 'password123' });

        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Shared Project',
        });
        project = projectResponse.body;

        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Discuss this',
            project_uid: project.uid,
        });
        task = taskResponse.body;

        await ownerAgent.post('/api/shares').send({
            resource_type: 'project',
            resource_uid: project.uid,
            target_user_email: collaboratorUser.email,
            access_level: 'rw',
        });
        await acceptAllInvitations(collaboratorAgent);
    });

    afterAll(async () => {
        await sequelize.close();
    });

    test('owner can post and list a comment', async () => {
        const createResponse = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'First comment' });

        expect(createResponse.status).toBe(201);
        expect(createResponse.body.body).toBe('First comment');
        expect(createResponse.body.is_own).toBe(true);

        const ownerSelf = await Person.findOne({
            where: { user_id: ownerUser.id, linked_user_id: ownerUser.id },
        });
        expect(createResponse.body.author.person_uid).toBe(ownerSelf.uid);

        const listResponse = await ownerAgent.get(
            `/api/task/${task.uid}/comments`
        );
        expect(listResponse.status).toBe(200);
        expect(listResponse.body.comments).toHaveLength(1);
        expect(listResponse.body.comments[0].author.name).toBe('Owner');
        expect(listResponse.body.comments[0].author.person_uid).toBe(
            ownerSelf.uid
        );
    });

    test('a mention notifies the mentioned collaborator and logs a task event', async () => {
        const collaboratorSelf = await Person.findOne({
            where: {
                user_id: collaboratorUser.id,
                linked_user_id: collaboratorUser.id,
            },
        });

        const response = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({
                body: 'Hey @Collaborator, can you take this?',
                mentioned_person_uids: [collaboratorSelf.uid],
            });
        expect(response.status).toBe(201);
        expect(response.body.mentioned_people).toEqual([
            { uid: collaboratorSelf.uid, name: 'Collaborator' },
        ]);

        const listResponse = await ownerAgent.get(
            `/api/task/${task.uid}/comments`
        );
        expect(listResponse.body.comments[0].mentioned_people).toEqual([
            { uid: collaboratorSelf.uid, name: 'Collaborator' },
        ]);

        const notifications = await Notification.findAll({
            where: { user_id: collaboratorUser.id, type: 'mention' },
        });
        expect(notifications).toHaveLength(1);
        expect(notifications[0].data.taskUid).toBe(task.uid);

        const events = await TaskEvent.findAll({
            where: { event_type: 'comment_added' },
        });
        expect(events).toHaveLength(1);
    });

    test('the commenter is never notified about their own comment', async () => {
        const ownerSelf = await Person.findOne({
            where: { user_id: ownerUser.id, linked_user_id: ownerUser.id },
        });

        await ownerAgent.post(`/api/task/${task.uid}/comments`).send({
            body: 'Note to self',
            mentioned_person_uids: [ownerSelf.uid],
        });

        const notifications = await Notification.findAll({
            where: { user_id: ownerUser.id },
        });
        expect(notifications).toHaveLength(0);
    });

    test('a read-write collaborator can comment and gets a comment_added notification when someone else comments', async () => {
        const commentResponse = await collaboratorAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'On it' });
        expect(commentResponse.status).toBe(201);

        const notifications = await Notification.findAll({
            where: { user_id: ownerUser.id, type: 'comment_added' },
        });
        expect(notifications).toHaveLength(1);
    });

    test('a user with no access to the task gets 404 on list and create', async () => {
        const listResponse = await outsiderAgent.get(
            `/api/task/${task.uid}/comments`
        );
        expect(listResponse.status).toBe(404);

        const createResponse = await outsiderAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'Should not work' });
        expect(createResponse.status).toBe(404);
    });

    test('an empty comment body is rejected', async () => {
        const response = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: '   ' });
        expect(response.status).toBe(400);
    });

    test('the tasks list embeds a comments_count for each task', async () => {
        await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'First' });
        await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'Second' });

        const listResponse = await ownerAgent.get('/api/tasks');
        expect(listResponse.status).toBe(200);
        const listedTask = listResponse.body.tasks.find(
            (t) => t.uid === task.uid
        );
        expect(listedTask.comments_count).toBe(2);
    });

    test('a deleted comment no longer counts toward comments_count', async () => {
        const created = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'Will be deleted' });
        await ownerAgent.post(`/api/task/${task.uid}/comments`).send({
            body: 'Stays',
        });

        await ownerAgent.delete(`/api/comment/${created.body.uid}`);

        const listResponse = await ownerAgent.get('/api/tasks');
        const listedTask = listResponse.body.tasks.find(
            (t) => t.uid === task.uid
        );
        expect(listedTask.comments_count).toBe(1);
    });

    test('the author can delete their own comment; another collaborator cannot', async () => {
        const created = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'Delete me' });

        const forbidden = await collaboratorAgent.delete(
            `/api/comment/${created.body.uid}`
        );
        expect(forbidden.status).toBe(403);

        const success = await ownerAgent.delete(
            `/api/comment/${created.body.uid}`
        );
        expect(success.status).toBe(200);
        expect(success.body.body).toBe('');
        expect(success.body.deleted_at).not.toBeNull();

        const listResponse = await ownerAgent.get(
            `/api/task/${task.uid}/comments`
        );
        // A delete is a tombstone: the row stays in the thread (with its
        // content cleared) rather than disappearing from the list.
        expect(listResponse.body.comments).toHaveLength(1);
        expect(listResponse.body.comments[0].uid).toBe(created.body.uid);
        expect(listResponse.body.comments[0].body).toBe('');
        expect(listResponse.body.comments[0].deleted_at).not.toBeNull();
    });

    test('deleting an already-deleted comment is refused', async () => {
        const created = await ownerAgent
            .post(`/api/task/${task.uid}/comments`)
            .send({ body: 'Delete me twice' });

        await ownerAgent.delete(`/api/comment/${created.body.uid}`);
        const secondAttempt = await ownerAgent.delete(
            `/api/comment/${created.body.uid}`
        );
        expect(secondAttempt.status).toBe(404);
    });
});
