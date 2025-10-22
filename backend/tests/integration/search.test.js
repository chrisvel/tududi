const request = require('supertest');
const app = require('../../app');
const { Task, Project, Area, Note, Tag, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const moment = require('moment-timezone');

describe('Universal Search Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'search-test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'search-test@example.com',
            password: 'password123',
        });
    });

    describe('GET /api/search', () => {
        describe('Authentication', () => {
            it('should require authentication', async () => {
                const response = await request(app).get('/api/search');
                expect(response.status).toBe(401);
                expect(response.body.error).toBe('Authentication required');
            });
        });

        describe('Basic Search', () => {
            beforeEach(async () => {
                // Create test data
                await Task.create({
                    user_id: user.id,
                    name: 'Buy groceries',
                    note: 'Milk, eggs, bread',
                    priority: 1,
                    status: 0,
                });

                await Task.create({
                    user_id: user.id,
                    name: 'Call dentist',
                    note: 'Schedule appointment',
                    priority: 2,
                    status: 0,
                });

                await Project.create({
                    user_id: user.id,
                    name: 'Website redesign',
                    description: 'Redesign company website',
                    state: 'active',
                });

                await Note.create({
                    user_id: user.id,
                    title: 'Meeting notes',
                    content: 'Discussed project timeline',
                });
            });

            it('should search across all entity types by default', async () => {
                const response = await agent
                    .get('/api/search')
                    .query({ q: '' });

                expect(response.status).toBe(200);
                expect(response.body.results).toBeDefined();
                expect(response.body.results.length).toBeGreaterThan(0);

                const types = new Set(response.body.results.map((r) => r.type));
                expect(types.has('Task')).toBe(true);
                expect(types.has('Project')).toBe(true);
                expect(types.has('Note')).toBe(true);
            });

            it('should search tasks by name', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'groceries',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks[0].name).toContain('groceries');
            });

            it('should search tasks by note content', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'eggs',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
            });

            it('should search projects by name', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Website',
                });

                expect(response.status).toBe(200);
                const projects = response.body.results.filter(
                    (r) => r.type === 'Project'
                );
                expect(projects.length).toBeGreaterThanOrEqual(1);
                expect(projects[0].name).toContain('Website');
            });

            it('should search notes by title', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Meeting',
                });

                expect(response.status).toBe(200);
                const notes = response.body.results.filter(
                    (r) => r.type === 'Note'
                );
                expect(notes.length).toBeGreaterThanOrEqual(1);
                expect(notes[0].title).toContain('Meeting');
            });

            it('should be case-insensitive', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'GROCERIES',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
            });

            it('should handle empty search query', async () => {
                const response = await agent
                    .get('/api/search')
                    .query({ q: '' });

                expect(response.status).toBe(200);
                expect(response.body.results).toBeDefined();
                expect(Array.isArray(response.body.results)).toBe(true);
            });
        });

        describe('Filter by Entity Type', () => {
            beforeEach(async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Test task',
                    status: 0,
                });

                await Project.create({
                    user_id: user.id,
                    name: 'Test project',
                    state: 'active',
                });

                await Note.create({
                    user_id: user.id,
                    title: 'Test note',
                    content: 'Content',
                });

                await Area.create({
                    user_id: user.id,
                    name: 'Test area',
                });

                await Tag.create({
                    user_id: user.id,
                    name: 'test-tag',
                });
            });

            it('should filter by Task only', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const types = new Set(response.body.results.map((r) => r.type));
                expect(types.has('Task')).toBe(true);
                expect(types.has('Project')).toBe(false);
                expect(types.has('Note')).toBe(false);
            });

            it('should filter by multiple types', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Task,Project',
                });

                expect(response.status).toBe(200);
                const types = new Set(response.body.results.map((r) => r.type));
                expect(types.has('Task')).toBe(true);
                expect(types.has('Project')).toBe(true);
                expect(types.has('Note')).toBe(false);
                expect(types.has('Area')).toBe(false);
            });

            it('should filter by Note only', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Note',
                });

                expect(response.status).toBe(200);
                const types = new Set(response.body.results.map((r) => r.type));
                expect(types.has('Note')).toBe(true);
                expect(types.has('Task')).toBe(false);
            });

            it('should filter by Area only', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Area',
                });

                expect(response.status).toBe(200);
                const types = new Set(response.body.results.map((r) => r.type));
                expect(types.has('Area')).toBe(true);
                expect(types.has('Task')).toBe(false);
            });

            it('should filter by Tag only', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'test',
                    filters: 'Tag',
                });

                expect(response.status).toBe(200);
                const types = new Set(response.body.results.map((r) => r.type));
                expect(types.has('Tag')).toBe(true);
                expect(types.has('Task')).toBe(false);
            });
        });

        describe('Filter by Priority', () => {
            beforeEach(async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Low priority task',
                    priority: 0,
                    status: 0,
                });

                await Task.create({
                    user_id: user.id,
                    name: 'Medium priority task',
                    priority: 1,
                    status: 0,
                });

                await Task.create({
                    user_id: user.id,
                    name: 'High priority task',
                    priority: 2,
                    status: 0,
                });

                await Project.create({
                    user_id: user.id,
                    name: 'High priority project',
                    priority: 'high',
                    state: 'active',
                });
            });

            it('should filter tasks by low priority', async () => {
                const response = await agent.get('/api/search').query({
                    priority: 'low',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks.every((t) => t.priority === 0)).toBe(true);
            });

            it('should filter tasks by medium priority', async () => {
                const response = await agent.get('/api/search').query({
                    priority: 'medium',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks.every((t) => t.priority === 1)).toBe(true);
            });

            it('should filter tasks by high priority', async () => {
                const response = await agent.get('/api/search').query({
                    priority: 'high',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks.every((t) => t.priority === 2)).toBe(true);
            });

            it('should filter projects by priority', async () => {
                const response = await agent.get('/api/search').query({
                    priority: 'high',
                    filters: 'Project',
                });

                expect(response.status).toBe(200);
                const projects = response.body.results.filter(
                    (r) => r.type === 'Project'
                );
                expect(projects.length).toBeGreaterThanOrEqual(1);
                expect(projects.every((p) => p.priority === 'high')).toBe(true);
            });
        });

        describe('Filter by Due Date', () => {
            beforeEach(async () => {
                const now = moment();

                // Task due today
                await Task.create({
                    user_id: user.id,
                    name: 'Task due today',
                    due_date: now.format('YYYY-MM-DD HH:mm:ss'),
                    status: 0,
                });

                // Task due tomorrow
                await Task.create({
                    user_id: user.id,
                    name: 'Task due tomorrow',
                    due_date: now
                        .clone()
                        .add(1, 'day')
                        .format('YYYY-MM-DD HH:mm:ss'),
                    status: 0,
                });

                // Task due next week
                await Task.create({
                    user_id: user.id,
                    name: 'Task due next week',
                    due_date: now
                        .clone()
                        .add(5, 'days')
                        .format('YYYY-MM-DD HH:mm:ss'),
                    status: 0,
                });

                // Task due next month
                await Task.create({
                    user_id: user.id,
                    name: 'Task due next month',
                    due_date: now
                        .clone()
                        .add(20, 'days')
                        .format('YYYY-MM-DD HH:mm:ss'),
                    status: 0,
                });
            });

            it('should filter tasks due today', async () => {
                const response = await agent.get('/api/search').query({
                    due: 'today',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks.some((t) => t.name === 'Task due today')).toBe(
                    true
                );
            });

            it('should filter tasks due tomorrow', async () => {
                const response = await agent.get('/api/search').query({
                    due: 'tomorrow',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks.some((t) => t.name === 'Task due tomorrow')).toBe(
                    true
                );
            });

            it('should filter tasks due next week', async () => {
                const response = await agent.get('/api/search').query({
                    due: 'next_week',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(2); // Should include today, tomorrow, and next week
            });

            it('should filter tasks due next month', async () => {
                const response = await agent.get('/api/search').query({
                    due: 'next_month',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(3); // Should include all tasks due within 30 days
            });
        });

        describe('Filter by Tags', () => {
            let workTag, personalTag, urgentTag;

            beforeEach(async () => {
                // Create tags
                workTag = await Tag.create({
                    user_id: user.id,
                    name: 'work',
                });

                personalTag = await Tag.create({
                    user_id: user.id,
                    name: 'personal',
                });

                urgentTag = await Tag.create({
                    user_id: user.id,
                    name: 'urgent',
                });

                // Create tasks with tags
                const task1 = await Task.create({
                    user_id: user.id,
                    name: 'Work task',
                    status: 0,
                });
                await task1.addTag(workTag);

                const task2 = await Task.create({
                    user_id: user.id,
                    name: 'Personal task',
                    status: 0,
                });
                await task2.addTag(personalTag);

                const task3 = await Task.create({
                    user_id: user.id,
                    name: 'Urgent work task',
                    status: 0,
                });
                await task3.addTag(workTag);
                await task3.addTag(urgentTag);

                // Create project with tag
                const project1 = await Project.create({
                    user_id: user.id,
                    name: 'Work project',
                    state: 'active',
                });
                await project1.addTag(workTag);

                // Create note with tag
                const note1 = await Note.create({
                    user_id: user.id,
                    title: 'Personal note',
                    content: 'Some content',
                });
                await note1.addTag(personalTag);
            });

            it('should filter by single tag', async () => {
                const response = await agent.get('/api/search').query({
                    tags: 'work',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBe(2); // Work task and Urgent work task
            });

            it('should filter by multiple tags', async () => {
                const response = await agent.get('/api/search').query({
                    tags: 'work,urgent',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                // Should return tasks that have either work OR urgent tag
                expect(tasks.length).toBeGreaterThanOrEqual(1);
            });

            it('should filter projects by tag', async () => {
                const response = await agent.get('/api/search').query({
                    tags: 'work',
                    filters: 'Project',
                });

                expect(response.status).toBe(200);
                const projects = response.body.results.filter(
                    (r) => r.type === 'Project'
                );
                expect(projects.length).toBe(1);
                expect(projects[0].name).toBe('Work project');
            });

            it('should filter notes by tag', async () => {
                const response = await agent.get('/api/search').query({
                    tags: 'personal',
                    filters: 'Note',
                });

                expect(response.status).toBe(200);
                const notes = response.body.results.filter(
                    (r) => r.type === 'Note'
                );
                expect(notes.length).toBe(1);
                expect(notes[0].title).toBe('Personal note');
            });

            it('should return empty results for non-existent tag', async () => {
                const response = await agent.get('/api/search').query({
                    tags: 'nonexistent',
                });

                expect(response.status).toBe(200);
                expect(response.body.results).toEqual([]);
            });
        });

        describe('Combined Filters', () => {
            beforeEach(async () => {
                const now = moment();
                const workTag = await Tag.create({
                    user_id: user.id,
                    name: 'work',
                });

                // High priority work task due today with tag
                const task1 = await Task.create({
                    user_id: user.id,
                    name: 'Important work meeting',
                    priority: 2,
                    due_date: now.format('YYYY-MM-DD HH:mm:ss'),
                    status: 0,
                });
                await task1.addTag(workTag);

                // Low priority personal task
                await Task.create({
                    user_id: user.id,
                    name: 'Personal errand',
                    priority: 0,
                    status: 0,
                });

                // Medium priority work task (no due date)
                const task3 = await Task.create({
                    user_id: user.id,
                    name: 'Work review',
                    priority: 1,
                    status: 0,
                });
                await task3.addTag(workTag);
            });

            it('should combine search query and priority filter', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'work',
                    priority: 'high',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks.every((t) => t.priority === 2)).toBe(true);
            });

            it('should combine priority, due date, and tag filters', async () => {
                const response = await agent.get('/api/search').query({
                    priority: 'high',
                    due: 'today',
                    tags: 'work',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBeGreaterThanOrEqual(1);
                expect(tasks[0].name).toBe('Important work meeting');
            });

            it('should combine all filters with search query', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'meeting',
                    priority: 'high',
                    due: 'today',
                    tags: 'work',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBe(1);
                expect(tasks[0].name).toBe('Important work meeting');
            });
        });

        describe('User Isolation', () => {
            let otherUser, otherAgent;

            beforeEach(async () => {
                // Create another user
                otherUser = await createTestUser({
                    email: 'other-user@example.com',
                });

                otherAgent = request.agent(app);
                await otherAgent.post('/api/login').send({
                    email: 'other-user@example.com',
                    password: 'password123',
                });

                // Create data for first user
                await Task.create({
                    user_id: user.id,
                    name: 'User 1 task',
                    status: 0,
                });

                // Create data for second user
                await Task.create({
                    user_id: otherUser.id,
                    name: 'User 2 task',
                    status: 0,
                });
            });

            it('should only return results for authenticated user', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'task',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBe(1);
                expect(tasks[0].name).toBe('User 1 task');
            });

            it('should not return other users data', async () => {
                const response = await otherAgent.get('/api/search').query({
                    q: 'task',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const tasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks.length).toBe(1);
                expect(tasks[0].name).toBe('User 2 task');
            });
        });

        describe('Result Format', () => {
            beforeEach(async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Test task',
                    note: 'Task description',
                    priority: 1,
                    status: 0,
                });

                await Project.create({
                    user_id: user.id,
                    name: 'Test project',
                    description: 'Project description',
                    state: 'active',
                    priority: 'medium',
                });

                await Note.create({
                    user_id: user.id,
                    title: 'Test note',
                    content: 'Note content goes here',
                });
            });

            it('should return task with correct structure', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const task = response.body.results.find(
                    (r) => r.type === 'Task'
                );
                expect(task).toBeDefined();
                expect(task.type).toBe('Task');
                expect(task.id).toBeDefined();
                expect(task.uid).toBeDefined();
                expect(task.name).toBe('Test task');
                expect(task.description).toBe('Task description');
                expect(task.priority).toBe(1);
                expect(task.status).toBe(0);
            });

            it('should return project with correct structure', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Project',
                });

                expect(response.status).toBe(200);
                const project = response.body.results.find(
                    (r) => r.type === 'Project'
                );
                expect(project).toBeDefined();
                expect(project.type).toBe('Project');
                expect(project.id).toBeDefined();
                expect(project.uid).toBeDefined();
                expect(project.name).toBe('Test project');
                expect(project.description).toBe('Project description');
                expect(project.priority).toBe('medium');
                expect(project.status).toBe('active');
            });

            it('should return note with correct structure', async () => {
                const response = await agent.get('/api/search').query({
                    q: 'Test',
                    filters: 'Note',
                });

                expect(response.status).toBe(200);
                const note = response.body.results.find(
                    (r) => r.type === 'Note'
                );
                expect(note).toBeDefined();
                expect(note.type).toBe('Note');
                expect(note.id).toBeDefined();
                expect(note.uid).toBeDefined();
                expect(note.name).toBe('Test note');
                expect(note.title).toBe('Test note');
                expect(note.description).toBe('Note content goes here');
            });
        });

        describe('Edge Cases', () => {
            it('should handle special characters in search query', async () => {
                await Task.create({
                    user_id: user.id,
                    name: 'Task with special chars: @#$%',
                    status: 0,
                });

                const response = await agent.get('/api/search').query({
                    q: '@#$',
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                // Should not error, even if results might be empty
                expect(response.body.results).toBeDefined();
            });

            it('should handle very long search queries', async () => {
                const longQuery = 'a'.repeat(1000);
                const response = await agent.get('/api/search').query({
                    q: longQuery,
                });

                expect(response.status).toBe(200);
                expect(response.body.results).toBeDefined();
            });

            it('should handle invalid filter types gracefully', async () => {
                const response = await agent.get('/api/search').query({
                    filters: 'InvalidType',
                });

                expect(response.status).toBe(200);
                expect(response.body.results).toEqual([]);
            });

            it('should respect limit of 20 results per type', async () => {
                // Create 25 tasks
                const tasks = Array.from({ length: 25 }, (_, i) =>
                    Task.create({
                        user_id: user.id,
                        name: `Task ${i + 1}`,
                        status: 0,
                    })
                );
                await Promise.all(tasks);

                const response = await agent.get('/api/search').query({
                    filters: 'Task',
                });

                expect(response.status).toBe(200);
                const returnedTasks = response.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(returnedTasks.length).toBeLessThanOrEqual(20);
            });
        });
    });
});
