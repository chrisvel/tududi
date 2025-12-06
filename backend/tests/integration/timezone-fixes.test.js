const request = require('supertest');
const app = require('../../app');
const { createTestUser } = require('../helpers/testUtils');
const { Task } = require('../../models');
const moment = require('moment-timezone');

describe('Timezone Fixes Integration Tests', () => {
    let testUser;
    let agent;

    beforeEach(async () => {
        // Create test user with specific timezone
        testUser = await createTestUser({
            timezone: 'America/New_York', // EST/EDT timezone
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: testUser.email,
            password: 'password123',
        });
    });

    afterEach(async () => {
        // Clean up test data
        await Task.destroy({ where: { user_id: testUser.id }, force: true });
    });

    describe('Task Creation with Due Dates', () => {
        it('should store due dates in UTC and return them in user timezone', async () => {
            // Create task due Jan 15, 2024 (in user's timezone)
            const createRes = await agent.post('/api/task').send({
                name: 'Test Task',
                due_date: '2024-01-15', // This should be interpreted as Jan 15 in EST
            });

            expect(createRes.statusCode).toBe(201);

            const createdTask = createRes.body;
            expect(createdTask.due_date).toBe('2024-01-15'); // Should return in user timezone format

            // Check that it's stored as UTC in database
            const taskFromDb = await Task.findByPk(createdTask.id);

            // Should be stored as end of day Jan 15 in EST, which is Jan 16 04:59:59 UTC
            expect(taskFromDb.due_date).toBeInstanceOf(Date);
            const storedDateUTC = taskFromDb.due_date.toISOString();
            expect(storedDateUTC).toBe('2024-01-16T04:59:59.999Z');
        });

        it('should handle timezone boundary correctly', async () => {
            // Set user timezone to Pacific (UTC-8)
            await testUser.update({ timezone: 'America/Los_Angeles' });

            const createRes = await agent.post('/api/task').send({
                name: 'Pacific Task',
                due_date: '2024-01-15',
            });

            expect(createRes.statusCode).toBe(201);

            // Check database storage
            const taskFromDb = await Task.findByPk(createRes.body.id);

            // Should be stored as end of day Jan 15 in PST, which is Jan 16 07:59:59 UTC
            const storedDateUTC = taskFromDb.due_date.toISOString();
            expect(storedDateUTC).toBe('2024-01-16T07:59:59.999Z');
        });
    });

    describe('Upcoming Tasks Filter', () => {
        it('should return tasks due within 7 days in user timezone', async () => {
            const userTimezone = 'America/New_York';
            await testUser.update({ timezone: userTimezone });

            // Create tasks with different due dates
            const today = moment.tz(userTimezone).format('YYYY-MM-DD');
            const tomorrow = moment
                .tz(userTimezone)
                .add(1, 'day')
                .format('YYYY-MM-DD');
            const nextWeek = moment
                .tz(userTimezone)
                .add(8, 'days')
                .format('YYYY-MM-DD');

            // Create three tasks
            await agent
                .post('/api/task')
                .send({ name: 'Due Today', due_date: today });

            await agent
                .post('/api/task')
                .send({ name: 'Due Tomorrow', due_date: tomorrow });

            await agent
                .post('/api/task')
                .send({ name: 'Due Next Week', due_date: nextWeek });

            // Fetch upcoming tasks
            const upcomingRes = await agent.get('/api/tasks?type=upcoming');

            expect(upcomingRes.statusCode).toBe(200);

            const upcomingTasks = upcomingRes.body.tasks;

            // Should include tasks due today and tomorrow, but not next week (8 days out)
            const taskNames = upcomingTasks.map((task) => task.name);
            expect(taskNames).toContain('Due Today');
            expect(taskNames).toContain('Due Tomorrow');
            expect(taskNames).not.toContain('Due Next Week');
        });

        it('should handle DST transitions correctly', async () => {
            await testUser.update({ timezone: 'America/New_York' });

            // Create task during DST transition period
            const dstDate = '2024-03-10'; // DST starts March 10, 2024

            await agent
                .post('/api/task')
                .send({ name: 'DST Task', due_date: dstDate });

            const taskRes = await agent.get('/api/tasks');

            expect(taskRes.statusCode).toBe(200);

            const dstTask = taskRes.body.tasks.find(
                (task) => task.name === 'DST Task'
            );
            expect(dstTask.due_date).toBe(dstDate);
        });
    });

    describe('Task Update with Due Dates', () => {
        it('should update due dates correctly with timezone conversion', async () => {
            // Create initial task
            const createRes = await agent
                .post('/api/task')
                .send({ name: 'Update Test Task', due_date: '2024-01-15' });

            const taskId = createRes.body.id;
            const taskUid = createRes.body.uid;

            // Update due date
            const updateRes = await agent
                .patch(`/api/task/${taskUid}`)
                .send({ due_date: '2024-01-20' });

            expect(updateRes.statusCode).toBe(200);
            expect(updateRes.body.due_date).toBe('2024-01-20');

            // Verify database storage
            const taskFromDb = await Task.findByPk(taskId);
            // Should be stored as end of day Jan 20 in EST
            const expectedUTC = moment
                .tz('2024-01-20', 'America/New_York')
                .endOf('day')
                .utc()
                .toDate();
            expect(taskFromDb.due_date.getTime()).toBe(expectedUTC.getTime());
        });

        it('should clear due dates correctly', async () => {
            // Create task with due date
            const createRes = await agent
                .post('/api/task')
                .send({ name: 'Clear Date Task', due_date: '2024-01-15' });

            const taskId = createRes.body.id;
            const taskUid = createRes.body.uid;

            // Clear due date by sending empty string
            const updateRes = await agent
                .patch(`/api/task/${taskUid}`)
                .send({ due_date: '' });

            expect(updateRes.statusCode).toBe(200);
            expect(updateRes.body.due_date).toBeNull();

            // Verify database storage
            const taskFromDb = await Task.findByPk(taskId);
            expect(taskFromDb.due_date).toBeNull();
        });
    });

    describe('Task Metrics with Timezone', () => {
        beforeAll(() => {
            // Mock current time for consistent testing
            jest.useFakeTimers();
            jest.setSystemTime(new Date('2024-01-15T17:00:00Z')); // 12 PM EST
        });

        afterAll(() => {
            jest.useRealTimers();
        });

        it('should calculate "today" tasks based on user timezone', async () => {
            await testUser.update({ timezone: 'America/New_York' });

            // Create task due "today" in user's timezone
            const todayInEST = moment
                .tz('America/New_York')
                .format('YYYY-MM-DD');

            await agent
                .post('/api/task')
                .send({ name: 'Today Task', due_date: todayInEST });

            // Create task due "yesterday" in user's timezone
            const yesterdayInEST = moment
                .tz('America/New_York')
                .subtract(1, 'day')
                .format('YYYY-MM-DD');

            await agent
                .post('/api/task')
                .send({ name: 'Yesterday Task', due_date: yesterdayInEST });

            // Fetch tasks with dashboard lists
            const tasksRes = await agent.get(
                '/api/tasks?type=today&include_lists=true'
            );

            expect(tasksRes.statusCode).toBe(200);

            expect(tasksRes.body.tasks_due_today.length).toBeGreaterThanOrEqual(
                1
            );

            const dueTodayNames = tasksRes.body.tasks_due_today.map(
                (task) => task.name
            );
            expect(dueTodayNames).toContain('Today Task');
            expect(tasksRes.body.tasks_overdue.length).toBeGreaterThanOrEqual(
                1
            );

            const overdueNames = tasksRes.body.tasks_overdue.map(
                (task) => task.name
            );
            expect(overdueNames).toContain('Yesterday Task');
        });
    });

    describe('Cross-timezone Edge Cases', () => {
        it('should handle international date line correctly', async () => {
            // Set timezone to Samoa (UTC+13)
            await testUser.update({ timezone: 'Pacific/Apia' });

            const samoaDate = '2024-01-15';

            const createRes = await agent
                .post('/api/task')
                .send({ name: 'Samoa Task', due_date: samoaDate });

            expect(createRes.statusCode).toBe(201);
            expect(createRes.body.due_date).toBe(samoaDate);

            // Check database storage - should be same day in UTC due to timezone offset
            const taskFromDb = await Task.findByPk(createRes.body.id);
            const storedDateUTC = taskFromDb.due_date.toISOString();
            // End of Jan 15 in Samoa (+13) is Jan 15 10:59:59 UTC
            expect(storedDateUTC).toBe('2024-01-15T10:59:59.999Z');
        });

        it('should handle invalid timezones gracefully', async () => {
            // Set invalid timezone
            await testUser.update({ timezone: 'Invalid/Timezone' });

            const createRes = await agent
                .post('/api/task')
                .send({ name: 'Invalid TZ Task', due_date: '2024-01-15' });

            expect(createRes.statusCode).toBe(201);
            // Should fallback to UTC
            expect(createRes.body.due_date).toBe('2024-01-15');

            // Check that it was stored using UTC fallback
            const taskFromDb = await Task.findByPk(createRes.body.id);
            const storedDateUTC = taskFromDb.due_date.toISOString();
            // End of Jan 15 in UTC
            expect(storedDateUTC).toBe('2024-01-15T23:59:59.999Z');
        });
    });
});
