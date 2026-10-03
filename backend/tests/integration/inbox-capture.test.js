const request = require('supertest');
const { randomUUID } = require('crypto');
const app = require('../../app');
const {
    Project,
    Task,
    Tag,
    InboxItem,
    CaptureReceipt,
    Permission,
    sequelize,
} = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { capture } = require('../../modules/inbox/captureService');
const { parseTaskCapture } = require('../../shared/captureSyntax');
const entitlements = require('../../services/entitlementsService');

describe('Explicit Inbox task capture', () => {
    let user, agent, personal;
    beforeEach(async () => {
        user = await createTestUser();
        agent = request.agent(app);
        await agent
            .post('/api/login')
            .send({ email: user.email, password: 'password123' })
            .expect(200);
        personal = await Project.create({ name: 'Personal', user_id: user.id });
    });

    const submit = (agent, content, extra = {}) =>
        agent
            .post('/api/inbox/capture')
            .send({ content, request_id: randomUUID(), ...extra });

    it('creates exactly one task in Personal without an Inbox item', async () => {
        const response = await submit(agent, 'My task name +Personal =Task');
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            kind: 'task',
            task: {
                name: 'My task name',
                project_id: personal.id,
                project_uid: personal.uid,
            },
        });
        expect(await Task.count()).toBe(1);
        expect(await InboxItem.count()).toBe(0);
    });

    it.each([
        ['My task name =Task', 'My task name'],
        ['=TASK My task name', 'My task name'],
        ['My =task task name', 'My task name'],
        ['=Task My task name =TASK', 'My task name'],
        ['My\t=TaSk\ntask name', 'My task name'],
        ['https://example.com =Task', 'https://example.com'],
        ['A thought #bookmark =Task', 'A thought'],
        ['My task =Note =Task', 'My task =Note'],
        ['Say "=Task" =Task', 'Say "=Task"'],
    ])('honors directive syntax and precedence: %s', async (content, name) => {
        const response = await submit(agent, content);
        expect(response.status).toBe(201);
        expect(response.body.task).toMatchObject({ name, project_id: null });
        expect(await InboxItem.count()).toBe(0);
    });

    it('resolves quoted, case-insensitive projects and tags', async () => {
        const project = await Project.create({
            name: 'Home Projects',
            user_id: user.id,
        });
        const response = await submit(
            agent,
            'My task name +"home projects" #errands =Task'
        );
        expect(response.status).toBe(201);
        expect(response.body.task).toMatchObject({
            name: 'My task name',
            project_uid: project.uid,
            tags: [expect.objectContaining({ name: 'errands' })],
        });
    });

    it.each([
        'My task name',
        'value=Task',
        '=Taskforce',
        '"=Task"',
        "'=Task'",
        'A "quoted =Task span"',
        "A 'quoted =Task span'",
        'say("quoted =Task text")',
        "say('quoted =Task text')",
        'Title =Note',
        'Name +"Project =Task"',
    ])('keeps ordinary capture behavior: %s', async (content) => {
        expect(parseTaskCapture(content)).toBeNull();
        const response = await submit(agent, content);
        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({
            kind: 'inbox',
            item: { content },
        });
        expect(await Task.count()).toBe(0);
    });

    it.each([
        ['=Task', 'CAPTURE_EMPTY_TITLE'],
        ['+Personal #errands =Task', 'CAPTURE_EMPTY_TITLE'],
        ['Name +Personal +Other =Task', 'CAPTURE_MULTIPLE_PROJECTS'],
        ['Name +Personal +Personal =Task', 'CAPTURE_MULTIPLE_PROJECTS'],
        ['Name +Missing #new-tag =Task', 'CAPTURE_PROJECT_UNAVAILABLE'],
    ])(
        'rejects invalid captures without side effects: %s',
        async (content, code) => {
            const tagCount = await Tag.count();
            const response = await submit(agent, content);
            expect(response.status).toBe(400);
            expect(response.body.code).toBe(code);
            expect(await Task.count()).toBe(0);
            expect(await InboxItem.count()).toBe(0);
            expect(await CaptureReceipt.count()).toBe(0);
            expect(await Tag.count()).toBe(tagCount);
            expect(await Project.count()).toBe(1);
        }
    );

    it('rejects ambiguous writable project names', async () => {
        await Project.create({ name: 'PERSONAL', user_id: user.id });
        const response = await submit(agent, 'Name +Personal =Task');
        expect(response.status).toBe(400);
        expect(response.body.code).toBe('CAPTURE_PROJECT_AMBIGUOUS');
        expect(await Task.count()).toBe(0);
    });

    it.each(['none', 'ro', 'rw', 'pending'])(
        'respects shared-project access: %s',
        async (access) => {
            const owner = await createTestUser({ email: 'owner@example.com' });
            const project = await Project.create({
                name: 'Shared',
                user_id: owner.id,
            });
            if (access !== 'none') {
                await Permission.create({
                    user_id: user.id,
                    resource_type: 'project',
                    resource_uid: project.uid,
                    access_level: access === 'pending' ? 'rw' : access,
                    status: access === 'pending' ? 'pending' : 'accepted',
                    granted_by_user_id: owner.id,
                });
            }
            const response = await submit(agent, 'Name +Shared =Task');
            const writable = ['rw', 'admin'].includes(access);
            expect(response.status).toBe(writable ? 201 : 400);
            expect(await Task.count()).toBe(writable ? 1 : 0);
            expect(await InboxItem.count()).toBe(0);
        }
    );

    it('allows an explicit force-Inbox override and leaves the legacy endpoint unchanged', async () => {
        const content = 'Name +Personal =Task';
        const response = await submit(agent, content, { force_inbox: true });
        expect(response.body).toMatchObject({
            kind: 'inbox',
            item: { content },
        });
        await agent.post('/api/inbox').send({ content }).expect(201);
        expect(await Task.count()).toBe(0);
        expect(await InboxItem.count()).toBe(2);
    });

    it('deduplicates sequential and concurrent deliveries durably', async () => {
        const body = {
            content: 'Name +Personal #errands =Task',
            request_id: randomUUID(),
        };
        const [first, second] = await Promise.all([
            capture(user, body),
            capture(user, body),
        ]);
        expect(first.task.uid).toBe(second.task.uid);
        const replay = await submit(agent, body.content, body);
        expect(replay.body.task.uid).toBe(first.task.uid);
        expect(await Task.count()).toBe(1);
        expect(await CaptureReceipt.count()).toBe(1);
        const conflict = await submit(agent, 'Changed =Task', {
            request_id: body.request_id,
        });
        expect(conflict.status).toBe(409);
    });

    it('scopes delivery IDs to user and source', async () => {
        const other = await createTestUser({ email: 'other@example.com' });
        const body = { content: 'Name =Task', request_id: 'same-delivery' };
        const first = await capture(user, body);
        const second = await capture(other, body);
        const third = await capture(user, { ...body, source: 'telegram' });
        expect(
            new Set([first.task.uid, second.task.uid, third.task.uid]).size
        ).toBe(3);
    });

    it('rolls back task and receipt when tag creation fails, then permits retry', async () => {
        const body = { content: 'Name #errands =Task', request_id: 'retry' };
        const createTag = jest
            .spyOn(Tag, 'create')
            .mockRejectedValueOnce(new Error('Tag storage failed'));
        await expect(capture(user, body)).rejects.toThrow('Tag storage failed');
        expect(await Task.count()).toBe(0);
        expect(await CaptureReceipt.count()).toBe(0);
        createTag.mockRestore();
        const result = await capture(user, body);
        expect(result.kind).toBe('task');
        expect(await Task.count()).toBe(1);
    });

    it('enforces task quotas before creating anything', async () => {
        jest.spyOn(entitlements, 'assertCanCreate').mockRejectedValueOnce(
            new Error('Quota reached')
        );
        await expect(
            capture(user, { content: 'Name =Task', request_id: 'quota' })
        ).rejects.toThrow('Quota reached');
        expect(await Task.count()).toBe(0);
        expect(await CaptureReceipt.count()).toBe(0);
    });

    it('requires authentication', async () => {
        const response = await submit(request(app), 'Name =Task');
        expect(response.status).toBe(401);
    });

    it('applies, reapplies and reverses the receipt migration', async () => {
        const migration = require('../../migrations/20260923000001-create-capture-receipts');
        const queryInterface = sequelize.getQueryInterface();
        await migration.down(queryInterface);
        await migration.up(queryInterface, require('sequelize'));
        await migration.up(queryInterface, require('sequelize'));
        const result = await capture(user, {
            content: 'Name =Task',
            request_id: 'migration',
        });
        expect(result.kind).toBe('task');
        await migration.down(queryInterface);
        await migration.up(queryInterface, require('sequelize'));
        expect(await CaptureReceipt.count()).toBe(0);
    });
});
