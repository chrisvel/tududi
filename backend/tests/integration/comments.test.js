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

    describe('replies', () => {
        test('a reply nests under its parent in the list, and is not a top-level entry', async () => {
            const parent = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Top level' });

            const reply = await collaboratorAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'A reply', parent_comment_uid: parent.body.uid });
            expect(reply.status).toBe(201);
            expect(reply.body.replies).toEqual([]);

            const listResponse = await ownerAgent.get(
                `/api/task/${task.uid}/comments`
            );
            expect(listResponse.body.comments).toHaveLength(1);
            const listedParent = listResponse.body.comments[0];
            expect(listedParent.uid).toBe(parent.body.uid);
            expect(listedParent.replies).toHaveLength(1);
            expect(listedParent.replies[0].uid).toBe(reply.body.uid);
            expect(listedParent.replies[0].body).toBe('A reply');
        });

        test('replying to a reply is refused', async () => {
            const parent = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Top level' });
            const reply = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'A reply', parent_comment_uid: parent.body.uid });

            const nestedReply = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({
                    body: 'Reply to a reply',
                    parent_comment_uid: reply.body.uid,
                });
            expect(nestedReply.status).toBe(400);
        });

        test('replying to a comment on a different task is refused', async () => {
            const otherTaskResponse = await ownerAgent
                .post('/api/task')
                .send({ name: 'Other task', project_uid: project.uid });
            const parent = await ownerAgent
                .post(`/api/task/${otherTaskResponse.body.uid}/comments`)
                .send({ body: 'Top level elsewhere' });

            const reply = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Reply', parent_comment_uid: parent.body.uid });
            expect(reply.status).toBe(400);
        });

        test('replying to a deleted comment is refused', async () => {
            const parent = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Will be deleted' });
            await ownerAgent.delete(`/api/comment/${parent.body.uid}`);

            const reply = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Reply', parent_comment_uid: parent.body.uid });
            expect(reply.status).toBe(400);
        });

        test('the parent comment author is notified of a reply', async () => {
            const parent = await collaboratorAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Top level by collaborator' });

            await ownerAgent.post(`/api/task/${task.uid}/comments`).send({
                body: 'Owner replies',
                parent_comment_uid: parent.body.uid,
            });

            const notifications = await Notification.findAll({
                where: {
                    user_id: collaboratorUser.id,
                    type: 'comment_added',
                },
            });
            expect(notifications).toHaveLength(1);
            expect(notifications[0].title).toContain('replied to your comment');
        });

        test('deleting a reply tombstones it in place under its parent', async () => {
            const parent = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Top level' });
            const reply = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'A reply', parent_comment_uid: parent.body.uid });

            await ownerAgent.delete(`/api/comment/${reply.body.uid}`);

            const listResponse = await ownerAgent.get(
                `/api/task/${task.uid}/comments`
            );
            const listedParent = listResponse.body.comments[0];
            expect(listedParent.replies).toHaveLength(1);
            expect(listedParent.replies[0].body).toBe('');
            expect(listedParent.replies[0].deleted_at).not.toBeNull();
        });

        test('comments_count includes replies', async () => {
            const parent = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Top level' });
            await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'A reply', parent_comment_uid: parent.body.uid });

            const listResponse = await ownerAgent.get('/api/tasks');
            const listedTask = listResponse.body.tasks.find(
                (t) => t.uid === task.uid
            );
            expect(listedTask.comments_count).toBe(2);
        });
    });

    describe('reactions', () => {
        test('liking and disliking a comment updates its counts', async () => {
            const created = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'React to me' });

            const liked = await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'like' });
            expect(liked.status).toBe(200);
            expect(liked.body).toEqual({
                uid: created.body.uid,
                likes_count: 1,
                dislikes_count: 0,
                my_reaction: 'like',
            });

            const collaboratorDisliked = await collaboratorAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'dislike' });
            expect(collaboratorDisliked.body).toEqual({
                uid: created.body.uid,
                likes_count: 1,
                dislikes_count: 1,
                my_reaction: 'dislike',
            });

            const listResponse = await ownerAgent.get(
                `/api/task/${task.uid}/comments`
            );
            const listed = listResponse.body.comments[0];
            expect(listed.likes_count).toBe(1);
            expect(listed.dislikes_count).toBe(1);
            expect(listed.my_reaction).toBe('like');
        });

        test('switching from like to dislike replaces the reaction, not adds to it', async () => {
            const created = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'React to me' });

            await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'like' });
            const switched = await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'dislike' });

            expect(switched.body).toEqual({
                uid: created.body.uid,
                likes_count: 0,
                dislikes_count: 1,
                my_reaction: 'dislike',
            });
        });

        test('sending type null clears the reaction', async () => {
            const created = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'React to me' });

            await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'like' });
            const cleared = await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: null });

            expect(cleared.body).toEqual({
                uid: created.body.uid,
                likes_count: 0,
                dislikes_count: 0,
                my_reaction: null,
            });
        });

        test('an invalid reaction type is rejected', async () => {
            const created = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'React to me' });

            const response = await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'love' });
            expect(response.status).toBe(400);
        });

        test('a user with no access to the task cannot react', async () => {
            const created = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'React to me' });

            const response = await outsiderAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'like' });
            expect(response.status).toBe(404);
        });

        test('reacting to a deleted comment is refused', async () => {
            const created = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Will be deleted' });
            await ownerAgent.delete(`/api/comment/${created.body.uid}`);

            const response = await ownerAgent
                .post(`/api/comment/${created.body.uid}/reaction`)
                .send({ type: 'like' });
            expect(response.status).toBe(404);
        });

        test('a reply can be reacted to independently of its parent', async () => {
            const parent = await ownerAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({ body: 'Top level' });
            const reply = await collaboratorAgent
                .post(`/api/task/${task.uid}/comments`)
                .send({
                    body: 'A reply',
                    parent_comment_uid: parent.body.uid,
                });

            await ownerAgent
                .post(`/api/comment/${reply.body.uid}/reaction`)
                .send({ type: 'like' });

            const listResponse = await ownerAgent.get(
                `/api/task/${task.uid}/comments`
            );
            const listedParent = listResponse.body.comments[0];
            expect(listedParent.likes_count).toBe(0);
            expect(listedParent.replies[0].likes_count).toBe(1);
        });
    });
});
