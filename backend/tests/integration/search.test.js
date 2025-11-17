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

            it('should perform case-insensitive search for ASCII characters', async () => {
                // NOTE: SQLite's LOWER() function only supports ASCII characters
                // For Unicode (Cyrillic, Greek, etc.), search is case-sensitive
                // This is a known limitation of SQLite without ICU extension

                // Create test data with mixed case ASCII
                await Task.create({
                    user_id: user.id,
                    name: 'Important Meeting',
                    note: 'Discussion about Project',
                    status: 0,
                });

                await Project.create({
                    user_id: user.id,
                    name: 'Website Redesign',
                    description: 'Complete overhaul of company site',
                    state: 'active',
                });

                // Test lowercase search finds uppercase ASCII
                const response1 = await agent.get('/api/search').query({
                    q: 'important',
                    filters: 'Task',
                });
                expect(response1.status).toBe(200);
                const tasks1 = response1.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks1.length).toBeGreaterThanOrEqual(1);
                expect(tasks1.some((t) => t.name.includes('Important'))).toBe(
                    true
                );

                // Test uppercase search finds mixed case ASCII
                const response2 = await agent.get('/api/search').query({
                    q: 'MEETING',
                    filters: 'Task',
                });
                expect(response2.status).toBe(200);
                const tasks2 = response2.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks2.length).toBeGreaterThanOrEqual(1);
                expect(
                    tasks2.some((t) => t.name.toLowerCase().includes('meeting'))
                ).toBe(true);

                // Test search in note content (case-insensitive)
                const response3 = await agent.get('/api/search').query({
                    q: 'project',
                    filters: 'Task',
                });
                expect(response3.status).toBe(200);
                const tasks3 = response3.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks3.length).toBeGreaterThanOrEqual(1);

                // Test project search (case-insensitive)
                const response4 = await agent.get('/api/search').query({
                    q: 'website',
                    filters: 'Project',
                });
                expect(response4.status).toBe(200);
                const projects = response4.body.results.filter(
                    (r) => r.type === 'Project'
                );
                expect(projects.length).toBeGreaterThanOrEqual(1);
                expect(projects.some((p) => p.name.includes('Website'))).toBe(
                    true
                );
            });

            it('should demonstrate Cyrillic search limitation', async () => {
                // NOTE: This test documents the current Cyrillic search limitation
                // SQLite's LOWER() only works with ASCII, so our search uses:
                //   - JavaScript toLowerCase() on search query: "Тест" -> "тест"
                //   - SQLite LOWER() on database: "Тест Русский" -> "Тест Русский" (unchanged)
                // Result: Case-insensitive search doesn't work for Cyrillic
                // Future improvement: Add ICU extension, FTS5, or normalized search fields

                // Create test data with Cyrillic text (all lowercase to match search query)
                await Task.create({
                    user_id: user.id,
                    name: 'тест русский',
                    note: 'заметка по-русски',
                    status: 0,
                });

                await Task.create({
                    user_id: user.id,
                    name: 'завдання українське',
                    note: 'нотатка українською',
                    status: 0,
                });

                // Lowercase search DOES work when database text is also lowercase
                const response1 = await agent.get('/api/search').query({
                    q: 'тест',
                    filters: 'Task',
                });
                expect(response1.status).toBe(200);
                const tasks1 = response1.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks1.length).toBeGreaterThanOrEqual(1);
                expect(tasks1.some((t) => t.name.includes('тест'))).toBe(true);

                // Ukrainian lowercase search works
                const response2 = await agent.get('/api/search').query({
                    q: 'завдання',
                    filters: 'Task',
                });
                expect(response2.status).toBe(200);
                const tasks2 = response2.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks2.length).toBeGreaterThanOrEqual(1);
                expect(tasks2.some((t) => t.name.includes('завдання'))).toBe(
                    true
                );

                // Search in note content works
                const response3 = await agent.get('/api/search').query({
                    q: 'заметка',
                    filters: 'Task',
                });
                expect(response3.status).toBe(200);
                const tasks3 = response3.body.results.filter(
                    (r) => r.type === 'Task'
                );
                expect(tasks3.length).toBeGreaterThanOrEqual(1);
                expect(
                    tasks3.some((t) => t.description?.includes('заметка'))
                ).toBe(true);

                // Now test the limitation: Create uppercase Cyrillic task
                await Task.create({
                    user_id: user.id,
                    name: 'ТЕСТ UPPERCASE',
                    note: 'UPPERCASE заметка',
                    status: 0,
                });

                // Lowercase search will NOT find uppercase Cyrillic (limitation)
                const response4 = await agent.get('/api/search').query({
                    q: 'тест uppercase',
                    filters: 'Task',
                });
                expect(response4.status).toBe(200);
                const tasks4 = response4.body.results.filter(
                    (r) => r.type === 'Task'
                );
                // Won't find it because JavaScript lowercased query doesn't match uppercase Cyrillic in DB
                expect(tasks4.some((t) => t.name.includes('UPPERCASE'))).toBe(
                    false
                );
            });
        });
    });

    describe('Pagination', () => {
        it('should paginate search results with limit and offset', async () => {
            // Create 25 tasks to test pagination (more than default limit of 20)
            const tasks = [];
            for (let i = 1; i <= 25; i++) {
                tasks.push(
                    await Task.create({
                        user_id: user.id,
                        name: `Paginated Task ${i}`,
                        note: 'Test pagination',
                        status: 0,
                    })
                );
            }

            // First page: get first 10 results
            const response1 = await agent.get('/api/search').query({
                filters: 'Task',
                limit: 10,
                offset: 0,
            });

            expect(response1.status).toBe(200);
            expect(response1.body.results).toBeDefined();
            expect(response1.body.pagination).toBeDefined();
            expect(response1.body.pagination.total).toBeGreaterThanOrEqual(25);
            expect(response1.body.pagination.limit).toBe(10);
            expect(response1.body.pagination.offset).toBe(0);
            expect(response1.body.results.length).toBe(10);
            expect(response1.body.pagination.hasMore).toBe(true);

            // Second page: get next 10 results
            const response2 = await agent.get('/api/search').query({
                filters: 'Task',
                limit: 10,
                offset: 10,
            });

            expect(response2.status).toBe(200);
            expect(response2.body.pagination.offset).toBe(10);
            expect(response2.body.results.length).toBe(10);
            expect(response2.body.pagination.hasMore).toBe(true);

            // Third page: get remaining results
            const response3 = await agent.get('/api/search').query({
                filters: 'Task',
                limit: 10,
                offset: 20,
            });

            expect(response3.status).toBe(200);
            expect(response3.body.pagination.offset).toBe(20);
            expect(response3.body.results.length).toBeGreaterThanOrEqual(5);
        });

        it('should support pagination with tag filters', async () => {
            // Create a tag
            const tag = await Tag.create({
                user_id: user.id,
                name: 'pagination-test',
            });

            // Create 30 tasks with the tag
            for (let i = 1; i <= 30; i++) {
                const task = await Task.create({
                    user_id: user.id,
                    name: `Tagged Task ${i}`,
                    status: 0,
                });
                // Associate task with tag using Sequelize association
                await task.addTag(tag);
            }

            // Get first page
            const response1 = await agent.get('/api/search').query({
                filters: 'Task',
                tags: 'pagination-test',
                limit: 15,
                offset: 0,
            });

            expect(response1.status).toBe(200);
            expect(response1.body.pagination).toBeDefined();
            expect(response1.body.pagination.total).toBe(30);
            expect(response1.body.results.length).toBe(15);
            expect(response1.body.pagination.hasMore).toBe(true);

            // Get second page
            const response2 = await agent.get('/api/search').query({
                filters: 'Task',
                tags: 'pagination-test',
                limit: 15,
                offset: 15,
            });

            expect(response2.status).toBe(200);
            expect(response2.body.results.length).toBe(15);
            expect(response2.body.pagination.hasMore).toBe(false);
        });

        it('should maintain backward compatibility without pagination params', async () => {
            // Create 5 tasks
            for (let i = 1; i <= 5; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Task ${i}`,
                    status: 0,
                });
            }

            // Request without pagination params
            const response = await agent.get('/api/search').query({
                filters: 'Task',
            });

            expect(response.status).toBe(200);
            expect(response.body.results).toBeDefined();
            // Should NOT include pagination metadata when no params provided
            expect(response.body.pagination).toBeUndefined();
            expect(response.body.results.length).toBeGreaterThanOrEqual(5);
        });

        it('should handle offset beyond total results', async () => {
            // Create 10 tasks
            for (let i = 1; i <= 10; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Task ${i}`,
                    status: 0,
                });
            }

            // Request with offset beyond available results
            const response = await agent.get('/api/search').query({
                filters: 'Task',
                limit: 10,
                offset: 100,
            });

            expect(response.status).toBe(200);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.pagination.total).toBeGreaterThanOrEqual(10);
            expect(response.body.results.length).toBe(0);
            expect(response.body.pagination.hasMore).toBe(false);
        });

        it('should use default limit of 20 when limit param is provided without value', async () => {
            // Create 25 tasks
            for (let i = 1; i <= 25; i++) {
                await Task.create({
                    user_id: user.id,
                    name: `Task ${i}`,
                    status: 0,
                });
            }

            // Request with limit param but no value (or invalid value)
            const response = await agent.get('/api/search').query({
                filters: 'Task',
                limit: '',
            });

            expect(response.status).toBe(200);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.pagination.limit).toBe(20);
            expect(response.body.results.length).toBe(20);
        });
    });
});
