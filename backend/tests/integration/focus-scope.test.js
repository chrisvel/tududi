'use strict';

const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const {
    Area,
    Project,
    Task,
    Tag,
    Note,
    UserProjectArea,
} = require('../../models');
const {
    createTestUser,
    acceptAllInvitations,
} = require('../helpers/testUtils');

// A Focus scope (area_uid, project_uid, tags) sent as query params narrows
// every list page the app scopes. Nothing is applied from stored settings.
describe('Focus scope on list endpoints', () => {
    let user, agent, work, home, workProject, homeProject;
    let inWorkProject, directInWork, inHomeProject, loose;

    const names = (rows) => rows.map((row) => row.name).sort();

    beforeEach(async () => {
        user = await createTestUser({
            email: 'focus@example.com',
            timezone: 'UTC',
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'focus@example.com',
            password: 'password123',
        });

        work = await Area.create({ name: 'Work', user_id: user.id });
        home = await Area.create({ name: 'Home', user_id: user.id });
        workProject = await Project.create({
            name: 'Launch',
            user_id: user.id,
            area_id: work.id,
        });
        homeProject = await Project.create({
            name: 'Garden',
            user_id: user.id,
            area_id: home.id,
        });

        inWorkProject = await Task.create({
            name: 'Write launch post',
            user_id: user.id,
            project_id: workProject.id,
        });
        directInWork = await Task.create({
            name: 'Expense report',
            user_id: user.id,
            area_id: work.id,
        });
        inHomeProject = await Task.create({
            name: 'Plant tomatoes',
            user_id: user.id,
            project_id: homeProject.id,
        });
        loose = await Task.create({ name: 'Call mum', user_id: user.id });
    });

    describe('GET /api/tasks', () => {
        it('an area scope returns tasks of the area and of its projects', async () => {
            const res = await agent
                .get('/api/tasks')
                .query({ type: 'all', area_uid: work.uid });

            expect(res.status).toBe(200);
            expect(names(res.body.tasks)).toEqual([
                'Expense report',
                'Write launch post',
            ]);
        });

        it('a project scope returns only that project', async () => {
            const res = await agent.get('/api/tasks').query({
                type: 'all',
                area_uid: work.uid,
                project_uid: workProject.uid,
            });

            expect(names(res.body.tasks)).toEqual(['Write launch post']);
        });

        it('a project outside the area matches nothing', async () => {
            const res = await agent.get('/api/tasks').query({
                type: 'all',
                area_uid: work.uid,
                project_uid: homeProject.uid,
            });

            expect(res.status).toBe(200);
            expect(res.body.tasks).toEqual([]);
        });

        it('tags narrow with AND semantics and combine with the area', async () => {
            const urgent = await Tag.create({
                name: 'urgent',
                user_id: user.id,
            });
            const deep = await Tag.create({ name: 'deep', user_id: user.id });
            await inWorkProject.addTag(urgent);
            await inWorkProject.addTag(deep);
            await directInWork.addTag(urgent);
            await loose.addTag(urgent);
            await loose.addTag(deep);

            const oneTag = await agent
                .get('/api/tasks')
                .query({ type: 'all', area_uid: work.uid, tags: 'urgent' });
            expect(names(oneTag.body.tasks)).toEqual([
                'Expense report',
                'Write launch post',
            ]);

            const bothTags = await agent.get('/api/tasks').query({
                type: 'all',
                area_uid: work.uid,
                tags: 'urgent,deep',
            });
            expect(names(bothTags.body.tasks)).toEqual(['Write launch post']);

            const unknownTag = await agent
                .get('/api/tasks')
                .query({ type: 'all', tags: 'nope' });
            expect(unknownTag.body.tasks).toEqual([]);
        });

        it('an unknown area matches nothing instead of failing', async () => {
            const res = await agent
                .get('/api/tasks')
                .query({ type: 'all', area_uid: 'does-not-exist' });

            expect(res.status).toBe(200);
            expect(res.body.tasks).toEqual([]);
        });

        it('scopes the Today lists and the upcoming projects', async () => {
            const today = moment.utc().startOf('day').add(9, 'hours').toDate();
            await inWorkProject.update({ due_date: today });
            await inHomeProject.update({ due_date: today });
            await loose.update({ due_date: today });
            await homeProject.update({
                due_date_at: moment.utc().add(2, 'days').toDate(),
                status: 'in_progress',
            });
            await workProject.update({
                due_date_at: moment.utc().add(2, 'days').toDate(),
                status: 'in_progress',
            });

            const todayRes = await agent.get('/api/tasks').query({
                type: 'today',
                include_lists: 'true',
                area_uid: work.uid,
            });
            expect(todayRes.status).toBe(200);
            expect(names(todayRes.body.tasks_due_today)).toEqual([
                'Write launch post',
            ]);

            const upcoming = await agent
                .get('/api/tasks')
                .query({ type: 'upcoming', area_uid: work.uid });
            expect(upcoming.status).toBe(200);
            expect(names(upcoming.body.projects)).toEqual(['Launch']);
        });

        it('follows the personal area placement of a shared project', async () => {
            const owner = await createTestUser({
                email: 'owner@example.com',
                timezone: 'UTC',
            });
            const ownerAgent = request.agent(app);
            await ownerAgent.post('/api/login').send({
                email: 'owner@example.com',
                password: 'password123',
            });
            const shared = await Project.create({
                name: 'Shared plan',
                user_id: owner.id,
            });
            await Task.create({
                name: 'Shared task',
                user_id: owner.id,
                project_id: shared.id,
            });
            await ownerAgent.post('/api/shares').send({
                resource_type: 'project',
                resource_uid: shared.uid,
                target_user_email: user.email,
                access_level: 'rw',
            });
            await acceptAllInvitations(agent);

            const before = await agent
                .get('/api/tasks')
                .query({ type: 'all', area_uid: work.uid });
            expect(names(before.body.tasks)).not.toContain('Shared task');

            await UserProjectArea.create({
                user_id: user.id,
                project_id: shared.id,
                area_id: work.id,
            });

            const after = await agent
                .get('/api/tasks')
                .query({ type: 'all', area_uid: work.uid });
            expect(names(after.body.tasks)).toContain('Shared task');
        });
    });

    describe('daily plan', () => {
        it('scopes the candidates', async () => {
            const today = moment.utc().startOf('day').add(9, 'hours').toDate();
            await inWorkProject.update({ due_date: today });
            await inHomeProject.update({ due_date: today });

            const res = await agent
                .get('/api/daily-plan/candidates')
                .query({ area_uid: work.uid });

            expect(res.status).toBe(200);
            expect(names(res.body.due_today)).toEqual(['Write launch post']);
            expect(res.body.ranked).toContain(inWorkProject.uid);
            expect(res.body.ranked).not.toContain(inHomeProject.uid);
        });

        it('keeps plan items outside the focus and flags them', async () => {
            const today = moment.utc().format('YYYY-MM-DD');
            await agent.put(`/api/daily-plan/${today}`).send({
                items: [
                    { task_uid: inWorkProject.uid },
                    { task_uid: inHomeProject.uid },
                ],
            });

            const plain = await agent.get('/api/daily-plan');
            expect(plain.body.plan.items).toHaveLength(2);
            expect(plain.body.plan.items[0].in_focus).toBeUndefined();

            const scoped = await agent
                .get('/api/daily-plan')
                .query({ area_uid: work.uid });
            expect(scoped.body.plan.items).toHaveLength(2);
            const byUid = Object.fromEntries(
                scoped.body.plan.items.map((item) => [
                    item.task_uid,
                    item.in_focus,
                ])
            );
            expect(byUid[inWorkProject.uid]).toBe(true);
            expect(byUid[inHomeProject.uid]).toBe(false);
        });
    });

    describe('GET /api/notes', () => {
        it('scopes notes through their project', async () => {
            await Note.create({
                title: 'Launch notes',
                content: 'x',
                user_id: user.id,
                project_id: workProject.id,
            });
            await Note.create({
                title: 'Seeds',
                content: 'x',
                user_id: user.id,
                project_id: homeProject.id,
            });
            await Note.create({
                title: 'Loose',
                content: 'x',
                user_id: user.id,
            });

            const byArea = await agent
                .get('/api/notes')
                .query({ area_uid: work.uid });
            expect(byArea.status).toBe(200);
            expect(byArea.body.map((note) => note.title)).toEqual([
                'Launch notes',
            ]);

            const byProject = await agent
                .get('/api/notes')
                .query({ project_uid: homeProject.uid });
            expect(byProject.body.map((note) => note.title)).toEqual(['Seeds']);
        });
    });

    describe('GET /api/projects', () => {
        it('accepts area_uid, project_uid and tags', async () => {
            const tag = await Tag.create({ name: 'q4', user_id: user.id });
            await workProject.addTag(tag);

            const byArea = await agent
                .get('/api/projects')
                .query({ area_uid: work.uid });
            expect(names(byArea.body.projects)).toEqual(['Launch']);

            const byTag = await agent
                .get('/api/projects')
                .query({ tags: 'q4' });
            expect(names(byTag.body.projects)).toEqual(['Launch']);

            const mismatch = await agent
                .get('/api/projects')
                .query({ project_uid: homeProject.uid, tags: 'q4' });
            expect(mismatch.body.projects).toEqual([]);
        });
    });

    describe('GET /api/search', () => {
        it('scopes tasks, notes, projects and areas by area', async () => {
            await Note.create({
                title: 'Launch checklist',
                content: 'x',
                user_id: user.id,
                project_id: workProject.id,
            });
            await Note.create({
                title: 'Garden checklist',
                content: 'x',
                user_id: user.id,
                project_id: homeProject.id,
            });

            const res = await agent
                .get('/api/search')
                .query({ q: '', area_uid: work.uid });

            expect(res.status).toBe(200);
            const byType = (type) =>
                res.body.results
                    .filter((row) => row.type === type)
                    .map((row) => row.name || row.title)
                    .sort();
            expect(byType('Task')).toEqual([
                'Expense report',
                'Write launch post',
            ]);
            expect(byType('Project')).toEqual(['Launch']);
            expect(byType('Note')).toEqual(['Launch checklist']);
            expect(byType('Area')).toEqual(['Work']);
        });

        it('a project scope combines with the text query', async () => {
            const res = await agent.get('/api/search').query({
                q: 'launch',
                project_uid: workProject.uid,
                filters: 'Task,Note',
            });
            expect(res.body.results.map((row) => row.name)).toEqual([
                'Write launch post',
            ]);
        });
    });

    describe('ui_settings.focus', () => {
        it('round-trips through the ui-settings endpoint', async () => {
            const save = await agent.put('/api/profile/ui-settings').send({
                focus: {
                    area_uid: work.uid,
                    project_uid: workProject.uid,
                    tags: [' urgent ', 'urgent', 'deep'],
                },
            });
            expect(save.status).toBe(200);

            const profile = await agent.get('/api/profile');
            expect(profile.body.ui_settings.focus).toEqual({
                area_uid: work.uid,
                project_uid: workProject.uid,
                tags: ['urgent', 'deep'],
            });
        });

        it('survives a profile save and clears with null', async () => {
            await agent
                .put('/api/profile/ui-settings')
                .send({ focus: { area_uid: work.uid } });

            await agent.patch('/api/profile').send({
                ui_settings: { project: { details: { showMetrics: false } } },
            });
            let profile = await agent.get('/api/profile');
            expect(profile.body.ui_settings.focus).toEqual({
                area_uid: work.uid,
            });
            expect(profile.body.ui_settings.project.details.showMetrics).toBe(
                false
            );

            await agent.put('/api/profile/ui-settings').send({ focus: null });
            profile = await agent.get('/api/profile');
            expect(profile.body.ui_settings.focus).toBeNull();
        });

        it('rejects a malformed focus', async () => {
            const res = await agent
                .put('/api/profile/ui-settings')
                .send({ focus: { area_uid: work.uid, tags: 'urgent' } });
            expect(res.status).toBe(400);
        });
    });
});
