const request = require('supertest');
const app = require('../../app');
const { Area, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Area Sharing', () => {
    let ownerUser, sharedUser, ownerAgent, sharedUserAgent, area, project;

    beforeEach(async () => {
        ownerUser = await createTestUser({
            email: `owner_${Date.now()}@test.com`,
            name: 'Owner',
            timezone: 'UTC',
        });

        sharedUser = await createTestUser({
            email: `shared_${Date.now()}@test.com`,
            name: 'Shared User',
            timezone: 'UTC',
        });

        ownerAgent = request.agent(app);
        sharedUserAgent = request.agent(app);

        await ownerAgent
            .post('/api/login')
            .send({ email: ownerUser.email, password: 'password123' });

        await sharedUserAgent
            .post('/api/login')
            .send({ email: sharedUser.email, password: 'password123' });

        // Owner creates an area with a project in it
        const areaResponse = await ownerAgent.post('/api/areas').send({
            name: 'Shared Test Area',
        });
        area = areaResponse.body;

        const areaRecord = await Area.findOne({ where: { uid: area.uid } });
        const projectResponse = await ownerAgent.post('/api/project').send({
            name: 'Project In Area',
            area_id: areaRecord.id,
        });
        project = projectResponse.body;
    });

    afterAll(async () => {
        await sequelize.close();
    });

    const shareArea = (accessLevel = 'rw') =>
        ownerAgent.post('/api/shares').send({
            resource_type: 'area',
            resource_uid: area.uid,
            target_user_email: sharedUser.email,
            access_level: accessLevel,
        });

    test('owner can grant and list an area share', async () => {
        const grantResponse = await shareArea('ro');
        expect(grantResponse.status).toBe(204);

        const listResponse = await ownerAgent.get(
            `/api/shares?resource_type=area&resource_uid=${area.uid}`
        );
        expect(listResponse.status).toBe(200);
        const nonOwnerShares = listResponse.body.shares.filter(
            (s) => !s.is_owner
        );
        expect(nonOwnerShares).toHaveLength(1);
        expect(nonOwnerShares[0].email).toBe(sharedUser.email);
        expect(nonOwnerShares[0].access_level).toBe('ro');
    });

    test('non-owner cannot share an area they do not own', async () => {
        const response = await sharedUserAgent.post('/api/shares').send({
            resource_type: 'area',
            resource_uid: area.uid,
            target_user_email: ownerUser.email,
            access_level: 'rw',
        });
        expect(response.status).toBe(403);
    });

    test('shared area appears in the recipient areas list', async () => {
        await shareArea('ro');

        const response = await sharedUserAgent.get('/api/areas');
        expect(response.status).toBe(200);
        const uids = response.body.map((a) => a.uid);
        expect(uids).toContain(area.uid);
    });

    test('recipient can fetch a shared area by uid', async () => {
        await shareArea('ro');

        const response = await sharedUserAgent.get(`/api/areas/${area.uid}`);
        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Shared Test Area');
    });

    test('recipient cannot fetch an area that is not shared', async () => {
        const response = await sharedUserAgent.get(`/api/areas/${area.uid}`);
        expect(response.status).toBe(404);
    });

    test('projects in a shared area are visible to the recipient', async () => {
        await shareArea('ro');

        const response = await sharedUserAgent.get('/api/projects');
        expect(response.status).toBe(200);
        const projects = response.body.projects || response.body;
        const uids = projects.map((p) => p.uid);
        expect(uids).toContain(project.uid);
    });

    test('projects added to the area after sharing are visible immediately', async () => {
        await shareArea('ro');

        const areaRecord = await Area.findOne({ where: { uid: area.uid } });
        const lateProject = await ownerAgent.post('/api/project').send({
            name: 'Late Project',
            area_id: areaRecord.id,
        });

        const response = await sharedUserAgent.get('/api/projects');
        const projects = response.body.projects || response.body;
        const uids = projects.map((p) => p.uid);
        expect(uids).toContain(lateProject.body.uid);
    });

    test('tasks in projects of a shared area are visible to the recipient', async () => {
        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Task In Area Project',
            project_id: project.id,
        });
        expect(taskResponse.status).toBe(201);

        await shareArea('ro');

        const response = await sharedUserAgent.get('/api/tasks');
        expect(response.status).toBe(200);
        const tasks = response.body.tasks || response.body;
        const names = tasks.map((t) => t.name);
        expect(names).toContain('Task In Area Project');
    });

    test('recipient with rw access can edit a task in a shared-area project', async () => {
        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Editable Task',
            project_id: project.id,
        });

        await shareArea('rw');

        const patchResponse = await sharedUserAgent
            .patch(`/api/task/${taskResponse.body.uid}`)
            .send({ name: 'Edited By Recipient' });
        expect(patchResponse.status).toBe(200);
        expect(patchResponse.body.name).toBe('Edited By Recipient');
    });

    test('recipient with ro access cannot edit a task in a shared-area project', async () => {
        const taskResponse = await ownerAgent.post('/api/task').send({
            name: 'Read Only Task',
            project_id: project.id,
        });

        await shareArea('ro');

        const patchResponse = await sharedUserAgent
            .patch(`/api/task/${taskResponse.body.uid}`)
            .send({ name: 'Should Not Work' });
        expect(patchResponse.status).toBe(403);
    });

    test('recipient cannot rename or delete a shared area', async () => {
        await shareArea('rw');

        const patchResponse = await sharedUserAgent
            .patch(`/api/areas/${area.uid}`)
            .send({ name: 'Hijacked' });
        expect(patchResponse.status).toBe(404);

        const deleteResponse = await sharedUserAgent.delete(
            `/api/areas/${area.uid}`
        );
        expect(deleteResponse.status).toBe(404);
    });

    test('owner sees projects a rw recipient creates in the shared area', async () => {
        await shareArea('rw');

        const areaRecord = await Area.findOne({ where: { uid: area.uid } });
        const recipientProject = await sharedUserAgent
            .post('/api/project')
            .send({
                name: 'Recipient Project',
                area_id: areaRecord.id,
            });
        expect(recipientProject.status).toBe(201);

        // The recipient's task inside that project is visible to the owner too
        const recipientTask = await sharedUserAgent.post('/api/task').send({
            name: 'Recipient Task',
            project_id: recipientProject.body.id,
        });
        expect(recipientTask.status).toBe(201);

        const projectsResponse = await ownerAgent.get('/api/projects');
        const projects =
            projectsResponse.body.projects || projectsResponse.body;
        expect(projects.map((p) => p.uid)).toContain(recipientProject.body.uid);

        const tasksResponse = await ownerAgent.get('/api/tasks');
        const tasks = tasksResponse.body.tasks || tasksResponse.body;
        expect(tasks.map((t) => t.name)).toContain('Recipient Task');

        // And the owner can edit the recipient's task (rw via own area)
        const patchResponse = await ownerAgent
            .patch(`/api/task/${recipientTask.body.uid}`)
            .send({ name: 'Recipient Task edited by owner' });
        expect(patchResponse.status).toBe(200);
    });

    test('ro recipient cannot create a project in the shared area', async () => {
        await shareArea('ro');

        const areaRecord = await Area.findOne({ where: { uid: area.uid } });
        const response = await sharedUserAgent.post('/api/project').send({
            name: 'Should Not Exist',
            area_id: areaRecord.id,
        });
        expect(response.status).toBe(403);
    });

    test('unrelated user cannot attach a project to a foreign area', async () => {
        // No share at all
        const areaRecord = await Area.findOne({ where: { uid: area.uid } });
        const response = await sharedUserAgent.post('/api/project').send({
            name: 'Sneaky Project',
            area_id: areaRecord.id,
        });
        expect(response.status).toBe(403);
    });

    test('ro recipient cannot move an own project into the shared area', async () => {
        await shareArea('ro');

        const ownProject = await sharedUserAgent.post('/api/project').send({
            name: 'Recipient Own Project',
        });
        expect(ownProject.status).toBe(201);

        const areaRecord = await Area.findOne({ where: { uid: area.uid } });
        const response = await sharedUserAgent
            .patch(`/api/project/${ownProject.body.uid}`)
            .send({ area_id: areaRecord.id });
        expect(response.status).toBe(403);
    });

    test('revoking the share removes visibility', async () => {
        await shareArea('ro');

        const revokeResponse = await ownerAgent.delete('/api/shares').send({
            resource_type: 'area',
            resource_uid: area.uid,
            target_user_id: sharedUser.id,
        });
        expect(revokeResponse.status).toBe(204);

        const areasResponse = await sharedUserAgent.get('/api/areas');
        const uids = areasResponse.body.map((a) => a.uid);
        expect(uids).not.toContain(area.uid);

        const projectsResponse = await sharedUserAgent.get('/api/projects');
        const projects =
            projectsResponse.body.projects || projectsResponse.body;
        const projectUids = projects.map((p) => p.uid);
        expect(projectUids).not.toContain(project.uid);
    });
});
