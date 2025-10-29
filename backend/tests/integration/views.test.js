const request = require('supertest');
const app = require('../../app');
const { View, Task, Tag, User } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Views Routes', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'views-test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'views-test@example.com',
            password: 'password123',
        });
    });

    describe('POST /api/views', () => {
        it('should create a view without tags', async () => {
            const response = await agent.post('/api/views').send({
                name: 'My Tasks',
                search_query: 'important',
                filters: ['Task'],
                priority: 'high',
                due: null,
                tags: null,
            });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('My Tasks');
            expect(response.body.search_query).toBe('important');
            expect(response.body.filters).toEqual(['Task']);
            expect(response.body.priority).toBe('high');
            expect(response.body.tags).toEqual([]);
            expect(response.body.uid).toBeDefined();
        });

        it('should create a view with single tag', async () => {
            const response = await agent.post('/api/views').send({
                name: 'Work Tasks',
                search_query: null,
                filters: ['Task'],
                priority: null,
                due: null,
                tags: ['work'],
            });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Work Tasks');
            expect(response.body.tags).toEqual(['work']);
        });

        it('should create a view with multiple tags', async () => {
            const response = await agent.post('/api/views').send({
                name: 'Urgent Work Tasks',
                search_query: null,
                filters: ['Task'],
                priority: 'high',
                due: null,
                tags: ['work', 'urgent'],
            });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Urgent Work Tasks');
            expect(response.body.tags).toEqual(['work', 'urgent']);
        });

        it('should create a view with all filters including tags', async () => {
            const response = await agent.post('/api/views').send({
                name: 'Comprehensive View',
                search_query: 'meeting',
                filters: ['Task', 'Project'],
                priority: 'high',
                due: 'today',
                tags: ['work', 'important'],
            });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Comprehensive View');
            expect(response.body.search_query).toBe('meeting');
            expect(response.body.filters).toEqual(['Task', 'Project']);
            expect(response.body.priority).toBe('high');
            expect(response.body.due).toBe('today');
            expect(response.body.tags).toEqual(['work', 'important']);
        });

        it('should require view name', async () => {
            const response = await agent.post('/api/views').send({
                name: '',
                filters: ['Task'],
            });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('View name is required');
        });

        it('should handle empty tags array', async () => {
            const response = await agent.post('/api/views').send({
                name: 'No Tags View',
                filters: ['Task'],
                tags: [],
            });

            expect(response.status).toBe(201);
            expect(response.body.tags).toEqual([]);
        });
    });

    describe('GET /api/views', () => {
        beforeEach(async () => {
            await View.create({
                user_id: user.id,
                name: 'View 1',
                filters: ['Task'],
                tags: ['work'],
            });

            await View.create({
                user_id: user.id,
                name: 'View 2',
                filters: ['Project'],
                tags: ['personal', 'home'],
            });

            await View.create({
                user_id: user.id,
                name: 'Pinned View',
                filters: ['Task'],
                tags: [],
                is_pinned: true,
            });
        });

        it('should retrieve all views for the user', async () => {
            const response = await agent.get('/api/views');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(3);
        });

        it('should return views with tags', async () => {
            const response = await agent.get('/api/views');

            expect(response.status).toBe(200);
            const view1 = response.body.find((v) => v.name === 'View 1');
            const view2 = response.body.find((v) => v.name === 'View 2');

            expect(view1.tags).toEqual(['work']);
            expect(view2.tags).toEqual(['personal', 'home']);
        });

        it('should order pinned views first', async () => {
            const response = await agent.get('/api/views');

            expect(response.status).toBe(200);
            expect(response.body[0].name).toBe('Pinned View');
        });
    });

    describe('GET /api/views/:identifier', () => {
        let viewUid;

        beforeEach(async () => {
            const view = await View.create({
                user_id: user.id,
                name: 'Tagged View',
                filters: ['Task', 'Note'],
                priority: 'high',
                tags: ['work', 'urgent'],
            });
            viewUid = view.uid;
        });

        it('should retrieve a specific view by uid', async () => {
            const response = await agent.get(`/api/views/${viewUid}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Tagged View');
            expect(response.body.filters).toEqual(['Task', 'Note']);
            expect(response.body.priority).toBe('high');
            expect(response.body.tags).toEqual(['work', 'urgent']);
        });

        it('should return 404 for non-existent view', async () => {
            const response = await agent.get('/api/views/nonexistent-uid');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('View not found');
        });
    });

    describe('PATCH /api/views/:identifier', () => {
        let viewUid;

        beforeEach(async () => {
            const view = await View.create({
                user_id: user.id,
                name: 'Original View',
                filters: ['Task'],
                tags: ['work'],
            });
            viewUid = view.uid;
        });

        it('should update view tags', async () => {
            const response = await agent.patch(`/api/views/${viewUid}`).send({
                tags: ['work', 'urgent', 'high-priority'],
            });

            expect(response.status).toBe(200);
            expect(response.body.tags).toEqual([
                'work',
                'urgent',
                'high-priority',
            ]);
        });

        it('should clear tags when set to empty array', async () => {
            const response = await agent.patch(`/api/views/${viewUid}`).send({
                tags: [],
            });

            expect(response.status).toBe(200);
            expect(response.body.tags).toEqual([]);
        });

        it('should update name and tags together', async () => {
            const response = await agent.patch(`/api/views/${viewUid}`).send({
                name: 'Updated View',
                tags: ['personal'],
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Updated View');
            expect(response.body.tags).toEqual(['personal']);
        });

        it('should update all fields including tags', async () => {
            const response = await agent.patch(`/api/views/${viewUid}`).send({
                name: 'Fully Updated View',
                search_query: 'important',
                filters: ['Task', 'Project'],
                priority: 'high',
                due: 'today',
                tags: ['work', 'urgent'],
                is_pinned: true,
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Fully Updated View');
            expect(response.body.search_query).toBe('important');
            expect(response.body.filters).toEqual(['Task', 'Project']);
            expect(response.body.priority).toBe('high');
            expect(response.body.due).toBe('today');
            expect(response.body.tags).toEqual(['work', 'urgent']);
            expect(response.body.is_pinned).toBe(true);
        });
    });

    describe('DELETE /api/views/:identifier', () => {
        let viewUid;

        beforeEach(async () => {
            const view = await View.create({
                user_id: user.id,
                name: 'View to Delete',
                filters: ['Task'],
                tags: ['work'],
            });
            viewUid = view.uid;
        });

        it('should delete a view', async () => {
            const response = await agent.delete(`/api/views/${viewUid}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toBe('View successfully deleted');

            // Verify it's gone
            const getResponse = await agent.get(`/api/views/${viewUid}`);
            expect(getResponse.status).toBe(404);
        });

        it('should return 404 for non-existent view', async () => {
            const response = await agent.delete('/api/views/nonexistent-uid');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('View not found');
        });
    });

    describe('Views with Tag Filtering Integration', () => {
        let workTag, urgentTag, personalTag;

        beforeEach(async () => {
            // Create tags
            workTag = await Tag.create({
                user_id: user.id,
                name: 'work',
            });

            urgentTag = await Tag.create({
                user_id: user.id,
                name: 'urgent',
            });

            personalTag = await Tag.create({
                user_id: user.id,
                name: 'personal',
            });

            // Create tasks with tags (mix of active and completed)
            const task1 = await Task.create({
                user_id: user.id,
                name: 'Work task 1',
                status: 0, // active
            });
            await task1.addTag(workTag);

            const task2 = await Task.create({
                user_id: user.id,
                name: 'Urgent work task',
                status: 0, // active
            });
            await task2.addTag(workTag);
            await task2.addTag(urgentTag);

            const task3 = await Task.create({
                user_id: user.id,
                name: 'Personal task',
                status: 0, // active
            });
            await task3.addTag(personalTag);

            // Add completed task with work tag
            const task4 = await Task.create({
                user_id: user.id,
                name: 'Completed work task',
                status: 2, // completed (done)
            });
            await task4.addTag(workTag);
        });

        it('should create view with tags and retrieve matching results', async () => {
            // Create a view with work tag
            const createResponse = await agent.post('/api/views').send({
                name: 'Work Tasks View',
                filters: ['Task'],
                tags: ['work'],
            });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.tags).toEqual(['work']);

            // Verify the view is retrievable
            const getResponse = await agent.get(
                `/api/views/${createResponse.body.uid}`
            );
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.tags).toEqual(['work']);

            // Now use search API with the same tags to verify filtering works
            const searchResponse = await agent.get('/api/search').query({
                tags: 'work',
                filters: 'Task',
            });

            expect(searchResponse.status).toBe(200);
            const tasks = searchResponse.body.results.filter(
                (r) => r.type === 'Task'
            );
            // Should now return 3 tasks (2 active + 1 completed)
            expect(tasks.length).toBe(3);
            // All tasks should have 'work' in their name (case-insensitive)
            expect(
                tasks.every((t) => t.name.toLowerCase().includes('work'))
            ).toBe(true);
        });

        it('should save view with multiple tags and retrieve correct results', async () => {
            // Create a view with multiple tags
            const createResponse = await agent.post('/api/views').send({
                name: 'Urgent Work View',
                filters: ['Task'],
                tags: ['work', 'urgent'],
            });

            expect(createResponse.status).toBe(201);
            expect(createResponse.body.tags).toEqual(['work', 'urgent']);

            // Search with same tags
            const searchResponse = await agent.get('/api/search').query({
                tags: 'work,urgent',
                filters: 'Task',
            });

            expect(searchResponse.status).toBe(200);
            const tasks = searchResponse.body.results.filter(
                (r) => r.type === 'Task'
            );
            // Should find tasks with either work OR urgent tag
            expect(tasks.length).toBeGreaterThanOrEqual(1);
        });

        it('should persist tags correctly after update', async () => {
            // Create view with one tag
            const createResponse = await agent.post('/api/views').send({
                name: 'Initial View',
                filters: ['Task'],
                tags: ['work'],
            });

            const viewUid = createResponse.body.uid;

            // Update to different tags
            const updateResponse = await agent
                .patch(`/api/views/${viewUid}`)
                .send({
                    tags: ['personal'],
                });

            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.tags).toEqual(['personal']);

            // Retrieve and verify
            const getResponse = await agent.get(`/api/views/${viewUid}`);
            expect(getResponse.status).toBe(200);
            expect(getResponse.body.tags).toEqual(['personal']);
        });

        it('should return both active and completed tasks in search results', async () => {
            // Create a view with work tag
            const createResponse = await agent.post('/api/views').send({
                name: 'All Work Tasks View',
                filters: ['Task'],
                tags: ['work'],
            });

            expect(createResponse.status).toBe(201);

            // Search for work tasks
            const searchResponse = await agent.get('/api/search').query({
                tags: 'work',
                filters: 'Task',
            });

            expect(searchResponse.status).toBe(200);
            const tasks = searchResponse.body.results.filter(
                (r) => r.type === 'Task'
            );

            // Should return 3 tasks: 2 active + 1 completed
            expect(tasks.length).toBe(3);

            // Verify we have both active and completed tasks
            const activeTasks = tasks.filter(
                (t) => t.status === 0 || t.status === 'active'
            );
            const completedTasks = tasks.filter(
                (t) => t.status === 2 || t.status === 'done'
            );

            expect(activeTasks.length).toBe(2);
            expect(completedTasks.length).toBe(1);

            // Verify the completed task is included
            const completedTask = tasks.find(
                (t) => t.name === 'Completed work task'
            );
            expect(completedTask).toBeDefined();
            expect(completedTask.status).toBe(2); // done status
        });

        it('should include completed tasks with correct status values', async () => {
            // Create tasks with different completion statuses
            const archivedTask = await Task.create({
                user_id: user.id,
                name: 'Archived work task',
                status: 3, // archived
            });
            await archivedTask.addTag(workTag);

            // Search for all work tasks
            const searchResponse = await agent.get('/api/search').query({
                tags: 'work',
                filters: 'Task',
            });

            expect(searchResponse.status).toBe(200);
            const tasks = searchResponse.body.results.filter(
                (r) => r.type === 'Task'
            );

            // Should now have 4 tasks (2 active, 1 done, 1 archived)
            expect(tasks.length).toBe(4);

            // Verify different status types are present
            const statusTypes = tasks.map((t) => t.status);
            expect(statusTypes).toContain(0); // active
            expect(statusTypes).toContain(2); // done
            expect(statusTypes).toContain(3); // archived

            // Frontend will filter these out, but backend should provide them all
            const nonActiveTasks = tasks.filter((t) => t.status >= 2);
            expect(nonActiveTasks.length).toBe(2); // done + archived
        });
    });

    describe('User Isolation', () => {
        let otherUser, otherAgent;

        beforeEach(async () => {
            // Create another user
            otherUser = await createTestUser({
                email: 'other-views-user@example.com',
            });

            otherAgent = request.agent(app);
            await otherAgent.post('/api/login').send({
                email: 'other-views-user@example.com',
                password: 'password123',
            });

            // Create view for first user
            await View.create({
                user_id: user.id,
                name: 'User 1 View',
                filters: ['Task'],
                tags: ['work'],
            });

            // Create view for second user
            await View.create({
                user_id: otherUser.id,
                name: 'User 2 View',
                filters: ['Task'],
                tags: ['personal'],
            });
        });

        it('should only return views for authenticated user', async () => {
            const response = await agent.get('/api/views');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].name).toBe('User 1 View');
            expect(response.body[0].tags).toEqual(['work']);
        });

        it('should not allow access to other users views', async () => {
            const otherUserViews = await View.findAll({
                where: { user_id: otherUser.id },
            });
            const otherViewUid = otherUserViews[0].uid;

            const response = await agent.get(`/api/views/${otherViewUid}`);

            expect(response.status).toBe(404);
        });
    });
});
