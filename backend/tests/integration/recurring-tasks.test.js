const request = require('supertest');
const app = require('../../app');
const { Task, RecurringCompletion, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const { calculateNextDueDate } = require('../../services/recurringTaskService');

describe('Recurring Tasks', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('Initial Due Date Calculation', () => {
        describe('Daily Recurrence', () => {
            it('should set correct due date for daily recurring task', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const taskData = {
                    name: 'Daily Exercise',
                    recurrence_type: 'daily',
                    recurrence_interval: 1,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);

                expect(response.status).toBe(201);
                expect(response.body.recurrence_type).toBe('daily');
                expect(response.body.recurrence_interval).toBe(1);

                // Verify the task was created with the correct due date
                const createdTask = await Task.findByPk(response.body.id);
                expect(createdTask.due_date).toBeDefined();
                expect(
                    new Date(createdTask.due_date).toISOString().split('T')[0]
                ).toBe(today.toISOString().split('T')[0]);
            });

            it('should handle daily recurrence with interval of 2', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                const taskData = {
                    name: 'Every Other Day Task',
                    recurrence_type: 'daily',
                    recurrence_interval: 2,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);

                expect(response.status).toBe(201);
                expect(response.body.recurrence_type).toBe('daily');
                expect(response.body.recurrence_interval).toBe(2);

                // Calculate next occurrence
                const task = await Task.findByPk(response.body.id);
                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );
                const expectedDate = new Date(today);
                expectedDate.setUTCDate(expectedDate.getUTCDate() + 2);

                expect(nextDate.toISOString().split('T')[0]).toBe(
                    expectedDate.toISOString().split('T')[0]
                );
            });

            it('should handle daily recurrence with interval of 7', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                const taskData = {
                    name: 'Weekly via Daily',
                    recurrence_type: 'daily',
                    recurrence_interval: 7,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);

                expect(response.status).toBe(201);

                const task = await Task.findByPk(response.body.id);
                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );
                const expectedDate = new Date(today);
                expectedDate.setUTCDate(expectedDate.getUTCDate() + 7);

                expect(nextDate.toISOString().split('T')[0]).toBe(
                    expectedDate.toISOString().split('T')[0]
                );
            });
        });

        describe('Weekly Recurrence', () => {
            it('should set correct due date for weekly recurring task', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const todayWeekday = today.getUTCDay();

                const taskData = {
                    name: 'Weekly Meeting',
                    recurrence_type: 'weekly',
                    recurrence_interval: 1,
                    recurrence_weekday: todayWeekday,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);

                expect(response.status).toBe(201);
                expect(response.body.recurrence_type).toBe('weekly');
                expect(response.body.recurrence_weekday).toBe(todayWeekday);

                const createdTask = await Task.findByPk(response.body.id);
                expect(createdTask.due_date).toBeDefined();
            });

            it('should calculate next week for weekly recurrence', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const todayWeekday = today.getUTCDay();

                const taskData = {
                    name: 'Weekly Review',
                    recurrence_type: 'weekly',
                    recurrence_interval: 1,
                    recurrence_weekday: todayWeekday,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );
                const expectedDate = new Date(today);
                expectedDate.setUTCDate(expectedDate.getUTCDate() + 7);

                expect(nextDate.toISOString().split('T')[0]).toBe(
                    expectedDate.toISOString().split('T')[0]
                );
            });

            it('should handle bi-weekly recurrence', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const todayWeekday = today.getUTCDay();

                const taskData = {
                    name: 'Bi-weekly Task',
                    recurrence_type: 'weekly',
                    recurrence_interval: 2,
                    recurrence_weekday: todayWeekday,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );
                const expectedDate = new Date(today);
                expectedDate.setUTCDate(expectedDate.getUTCDate() + 14);

                expect(nextDate.toISOString().split('T')[0]).toBe(
                    expectedDate.toISOString().split('T')[0]
                );
            });

            it('should handle weekly recurrence on a different weekday', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const todayWeekday = today.getUTCDay();
                // Target a different weekday (e.g., if today is Monday (1), target Friday (5))
                const targetWeekday = (todayWeekday + 4) % 7;

                const taskData = {
                    name: 'Weekly on Different Day',
                    recurrence_type: 'weekly',
                    recurrence_interval: 1,
                    recurrence_weekday: targetWeekday,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );
                expect(nextDate.getUTCDay()).toBe(targetWeekday);
            });
        });

        describe('Monthly Recurrence', () => {
            it('should set correct due date for monthly recurring task', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const dayOfMonth = today.getUTCDate();

                const taskData = {
                    name: 'Monthly Report',
                    recurrence_type: 'monthly',
                    recurrence_interval: 1,
                    recurrence_month_day: dayOfMonth,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);

                expect(response.status).toBe(201);
                expect(response.body.recurrence_type).toBe('monthly');
                expect(response.body.recurrence_month_day).toBe(dayOfMonth);

                const createdTask = await Task.findByPk(response.body.id);
                expect(createdTask.due_date).toBeDefined();
            });

            it('should calculate next month for monthly recurrence', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);
                const dayOfMonth = 15; // Use a safe day that exists in all months

                const taskData = {
                    name: 'Monthly Bill',
                    recurrence_type: 'monthly',
                    recurrence_interval: 1,
                    recurrence_month_day: dayOfMonth,
                    due_date: new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth(),
                            dayOfMonth
                        )
                    )
                        .toISOString()
                        .split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );
                const expectedMonth = (today.getUTCMonth() + 1) % 12;

                expect(nextDate.getUTCDate()).toBe(dayOfMonth);
                expect(nextDate.getUTCMonth()).toBe(expectedMonth);
            });

            it('should handle monthly recurrence on last day of month', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                const taskData = {
                    name: 'End of Month Task',
                    recurrence_type: 'monthly_last_day',
                    recurrence_interval: 1,
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );

                // Should be last day of next month
                const expectedDate = new Date(
                    Date.UTC(
                        nextDate.getUTCFullYear(),
                        nextDate.getUTCMonth() + 1,
                        0
                    )
                );
                expect(nextDate.getUTCDate()).toBe(expectedDate.getUTCDate());
            });

            it('should not skip months for monthly_last_day when starting from 31st', async () => {
                // Bug fix: Jan 31 -> should go to Feb 28, not March 31
                const jan31 = new Date(Date.UTC(2025, 0, 31, 0, 0, 0, 0));

                const taskData = {
                    name: 'End of Month Task',
                    recurrence_type: 'monthly_last_day',
                    recurrence_interval: 1,
                    due_date: jan31.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                // First occurrence: Jan 31 -> Feb 28
                const nextDate1 = calculateNextDueDate(task, jan31);
                expect(nextDate1.getUTCMonth()).toBe(1); // February
                expect(nextDate1.getUTCDate()).toBe(28);

                // Second occurrence: Feb 28 -> Mar 31
                const nextDate2 = calculateNextDueDate(task, nextDate1);
                expect(nextDate2.getUTCMonth()).toBe(2); // March
                expect(nextDate2.getUTCDate()).toBe(31);

                // Third occurrence: Mar 31 -> Apr 30
                const nextDate3 = calculateNextDueDate(task, nextDate2);
                expect(nextDate3.getUTCMonth()).toBe(3); // April
                expect(nextDate3.getUTCDate()).toBe(30);
            });

            it('should handle monthly recurrence when day does not exist in target month', async () => {
                // Create a task for Jan 31
                const jan31 = new Date(Date.UTC(2024, 0, 31, 0, 0, 0, 0));

                const taskData = {
                    name: 'Monthly on 31st',
                    recurrence_type: 'monthly',
                    recurrence_interval: 1,
                    recurrence_month_day: 31,
                    due_date: jan31.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);

                // Next occurrence should be Feb 29 (if leap year) or Feb 28
                const nextDate = calculateNextDueDate(task, jan31);

                // February should cap at the last day of the month
                expect(nextDate.getUTCMonth()).toBe(1); // February
                expect(nextDate.getUTCDate()).toBeLessThanOrEqual(29);
            });
        });

        describe('Monthly Weekday Recurrence', () => {
            it('should handle first Monday of the month', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                const taskData = {
                    name: 'First Monday Meeting',
                    recurrence_type: 'monthly_weekday',
                    recurrence_interval: 1,
                    recurrence_weekday: 1, // Monday
                    recurrence_week_of_month: 1, // First week
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                expect(response.status).toBe(201);

                const task = await Task.findByPk(response.body.id);
                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );

                // Should be a Monday
                expect(nextDate.getUTCDay()).toBe(1);
            });

            it('should handle third Friday of the month', async () => {
                const today = new Date();
                today.setUTCHours(0, 0, 0, 0);

                const taskData = {
                    name: 'Third Friday Task',
                    recurrence_type: 'monthly_weekday',
                    recurrence_interval: 1,
                    recurrence_weekday: 5, // Friday
                    recurrence_week_of_month: 3, // Third week
                    due_date: today.toISOString().split('T')[0],
                };

                const response = await agent.post('/api/task').send(taskData);
                const task = await Task.findByPk(response.body.id);
                const nextDate = calculateNextDueDate(
                    task,
                    new Date(task.due_date)
                );

                // Should be a Friday
                expect(nextDate.getUTCDay()).toBe(5);
            });
        });
    });

    describe('Due Date Refresh on Completion', () => {
        it('should advance due date when daily recurring task is completed', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            // Create a daily recurring task
            const task = await Task.create({
                name: 'Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const originalDueDate = new Date(task.due_date);

            // Mark the task as completed
            const response = await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            expect(response.status).toBe(200);

            // Reload the task
            await task.reload();

            // Task should be reset to NOT_STARTED
            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            expect(task.completed_at).toBeNull();

            // Due date should be advanced by 1 day
            const newDueDate = new Date(task.due_date);
            const expectedDate = new Date(originalDueDate);
            expectedDate.setUTCDate(expectedDate.getUTCDate() + 1);

            expect(newDueDate.toISOString().split('T')[0]).toBe(
                expectedDate.toISOString().split('T')[0]
            );

            // Verify RecurringCompletion was created
            const completions = await RecurringCompletion.findAll({
                where: { task_id: task.id },
            });
            expect(completions.length).toBe(1);
            expect(completions[0].original_due_date).toBeDefined();
        });

        it('should advance due date when weekly recurring task is completed', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const todayWeekday = today.getUTCDay();

            const task = await Task.create({
                name: 'Weekly Task',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: todayWeekday,
                due_date: today,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const originalDueDate = new Date(task.due_date);

            // Complete the task
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Due date should be advanced by 1 week
            const newDueDate = new Date(task.due_date);
            const expectedDate = new Date(originalDueDate);
            expectedDate.setUTCDate(expectedDate.getUTCDate() + 7);

            expect(newDueDate.toISOString().split('T')[0]).toBe(
                expectedDate.toISOString().split('T')[0]
            );
            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
        });

        it('should advance due date when monthly recurring task is completed', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const dayOfMonth = 15; // Use a safe day

            const startDate = new Date(
                Date.UTC(
                    today.getUTCFullYear(),
                    today.getUTCMonth(),
                    dayOfMonth
                )
            );

            const task = await Task.create({
                name: 'Monthly Task',
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: dayOfMonth,
                due_date: startDate,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const originalMonth = new Date(task.due_date).getUTCMonth();

            // Complete the task
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Due date should be in the next month
            const newDueDate = new Date(task.due_date);
            const expectedMonth = (originalMonth + 1) % 12;

            expect(newDueDate.getUTCMonth()).toBe(expectedMonth);
            expect(newDueDate.getUTCDate()).toBe(dayOfMonth);
            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
        });

        it('should track multiple completions in RecurringCompletion table', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete the task three times
            for (let i = 0; i < 3; i++) {
                await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ status: Task.STATUS.DONE });
                await task.reload();
            }

            // Verify three completions were recorded
            const completions = await RecurringCompletion.findAll({
                where: { task_id: task.id },
                order: [['completed_at', 'ASC']],
            });

            expect(completions.length).toBe(3);

            // Verify each completion has the correct original_due_date
            for (let i = 0; i < 3; i++) {
                expect(completions[i].original_due_date).toBeDefined();
                expect(completions[i].skipped).toBe(false);
            }
        });
    });

    describe('Completion-Based Recurrence', () => {
        it('should use completion date when completion_based is true', async () => {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            threeDaysAgo.setHours(0, 0, 0, 0);

            // Create a task due 3 days ago with completion-based recurrence
            const task = await Task.create({
                name: 'Completion Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: threeDaysAgo,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete it today
            const completionTime = new Date();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Next due date should be tomorrow (completion date + interval)
            // not 2 days ago (original due date + interval)
            const newDueDate = new Date(task.due_date);
            const tomorrow = new Date(completionTime);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);

            const dayDiff = Math.round(
                (newDueDate - completionTime) / (1000 * 60 * 60 * 24)
            );

            // Should be approximately 1 day from completion
            expect(dayDiff).toBeGreaterThanOrEqual(0);
            expect(dayDiff).toBeLessThanOrEqual(1);
        });

        it('should use original due date when completion_based is false', async () => {
            const threeDaysAgo = new Date();
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
            threeDaysAgo.setHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Date Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: threeDaysAgo,
                completion_based: false,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const originalDueDate = new Date(task.due_date);

            // Complete it today
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Next due date should be 2 days ago (original due date + 1 day)
            const newDueDate = new Date(task.due_date);
            const expectedDate = new Date(originalDueDate);
            expectedDate.setUTCDate(expectedDate.getUTCDate() + 1);

            expect(newDueDate.toISOString().split('T')[0]).toBe(
                expectedDate.toISOString().split('T')[0]
            );
        });

        it('should use completion date for early completion when completion_based is true', async () => {
            const twoDaysFromNow = new Date();
            twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
            twoDaysFromNow.setHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Early Completion Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: twoDaysFromNow,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete it today (2 days early)
            const completionTime = new Date();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Next due date should be tomorrow (today + 1 day)
            // not 3 days from now (original due date + 1 day)
            const newDueDate = new Date(task.due_date);
            const dayDiff = Math.round(
                (newDueDate - completionTime) / (1000 * 60 * 60 * 24)
            );

            // Should be approximately 1 day from completion (today)
            expect(dayDiff).toBeGreaterThanOrEqual(0);
            expect(dayDiff).toBeLessThanOrEqual(1);

            // Verify it's NOT 3 days from now
            const threeDaysFromNow = new Date();
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
            expect(newDueDate.toISOString().split('T')[0]).not.toBe(
                threeDaysFromNow.toISOString().split('T')[0]
            );
        });

        it('should work with weekly completion_based recurrence', async () => {
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            lastWeek.setHours(0, 0, 0, 0);
            const lastWeekWeekday = lastWeek.getDay();

            const task = await Task.create({
                name: 'Weekly Completion Based',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: lastWeekWeekday,
                due_date: lastWeek,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete it today
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Next due date should be approximately 7 days from today
            // not 7 days from last week (which would be today)
            const newDueDate = new Date(task.due_date);
            const today = new Date();
            const dayDiff = Math.round(
                (newDueDate - today) / (1000 * 60 * 60 * 24)
            );

            // Should be around 6-7 days from now
            expect(dayDiff).toBeGreaterThanOrEqual(6);
            expect(dayDiff).toBeLessThanOrEqual(8);
        });

        it('should work with monthly completion_based recurrence', async () => {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            lastMonth.setUTCHours(0, 0, 0, 0);
            const dayOfMonth = 15;

            const task = await Task.create({
                name: 'Monthly Completion Based',
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: dayOfMonth,
                due_date: new Date(
                    Date.UTC(
                        lastMonth.getUTCFullYear(),
                        lastMonth.getUTCMonth(),
                        dayOfMonth
                    )
                ),
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete it today
            const completionMonth = new Date().getUTCMonth();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Next due date should be approximately 1 month from today
            // not 1 month from last month (which would be this month)
            const newDueDate = new Date(task.due_date);
            const expectedMonth = (completionMonth + 1) % 12;

            // Should be next month
            expect(newDueDate.getUTCMonth()).toBe(expectedMonth);
        });

        it('should handle interval > 1 with completion_based', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Every 3 Days Completion Based',
                recurrence_type: 'daily',
                recurrence_interval: 3,
                due_date: today,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const completionTime = new Date();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Next due date should be 3 days from completion
            const newDueDate = new Date(task.due_date);
            const dayDiff = Math.round(
                (newDueDate - completionTime) / (1000 * 60 * 60 * 24)
            );

            // Should be approximately 3 days from completion
            expect(dayDiff).toBeGreaterThanOrEqual(2);
            expect(dayDiff).toBeLessThanOrEqual(3);
        });

        it('should respect updated completion_based flag', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            // Create task with completion_based = false
            const task = await Task.create({
                name: 'Toggle Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                completion_based: false,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Update to completion_based = true
            await agent.patch(`/api/task/${task.uid}`).send({
                completion_based: true,
            });

            await task.reload();
            expect(task.completion_based).toBe(true);

            // Now complete it - should use completion-based logic
            const completionTime = new Date();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Should advance from completion time, not original due date
            const newDueDate = new Date(task.due_date);
            const dayDiff = Math.round(
                (newDueDate - completionTime) / (1000 * 60 * 60 * 24)
            );

            expect(dayDiff).toBeGreaterThanOrEqual(0);
            expect(dayDiff).toBeLessThanOrEqual(1);
        });

        it('should handle multiple rapid completions with completion_based', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Rapid Completions',
                recurrence_type: 'daily',
                recurrence_interval: 2,
                due_date: today,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // First completion
            const firstCompletionTime = new Date();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            const firstNewDueDate = new Date(task.due_date);

            // Should be approximately 2 days from completion
            const firstDayDiff = Math.round(
                (firstNewDueDate - firstCompletionTime) / (1000 * 60 * 60 * 24)
            );
            expect(firstDayDiff).toBeGreaterThanOrEqual(1);
            expect(firstDayDiff).toBeLessThanOrEqual(2);

            // Second completion immediately after first
            const secondCompletionTime = new Date();
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            const secondNewDueDate = new Date(task.due_date);

            // Should be approximately 2 days from second completion
            // which means it should be later than the first new due date
            expect(secondNewDueDate.getTime()).toBeGreaterThan(
                firstNewDueDate.getTime()
            );

            const secondDayDiff = Math.round(
                (secondNewDueDate - secondCompletionTime) /
                    (1000 * 60 * 60 * 24)
            );
            expect(secondDayDiff).toBeGreaterThanOrEqual(1);
            expect(secondDayDiff).toBeLessThanOrEqual(2);

            // Verify both completions were recorded
            const completions = await RecurringCompletion.findAll({
                where: { task_id: task.id },
            });
            expect(completions.length).toBe(2);
        });
    });

    describe('Recurrence End Date', () => {
        it('should stop recurring when end date is reached', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dayAfterTomorrow = new Date(today);
            dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
            const threeDaysFromNow = new Date(today);
            threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

            // Create a daily task due today with end date 3 days from now
            // Note: end date is exclusive (uses <, not <=)
            // So this task can recur on: today (day 0), tomorrow (day 1), day 2
            // But NOT on day 3 (the end date itself)
            const task = await Task.create({
                name: 'Limited Recurring Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                recurrence_end_date: threeDaysFromNow,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete the task (first completion) - should advance to tomorrow (day 1)
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            let newDueDate = new Date(task.due_date);
            expect(newDueDate.toISOString().split('T')[0]).toBe(
                tomorrow.toISOString().split('T')[0]
            );

            // Complete again - should advance to day after tomorrow (day 2, last valid occurrence)
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            newDueDate = new Date(task.due_date);
            expect(newDueDate.toISOString().split('T')[0]).toBe(
                dayAfterTomorrow.toISOString().split('T')[0]
            );

            // Complete one more time - this time it should stop recurring
            // because the next occurrence would be day 3 (threeDaysFromNow) which is >= end date
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });

            await task.reload();

            // Task should remain completed since next occurrence would be on or past end date
            expect(task.status).toBe(Task.STATUS.DONE);
            expect(task.completed_at).not.toBeNull();
        });

        it('should allow recurring tasks without end date to continue indefinitely', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Infinite Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                recurrence_end_date: null,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete multiple times
            for (let i = 0; i < 5; i++) {
                await agent
                    .patch(`/api/task/${task.uid}`)
                    .send({ status: Task.STATUS.DONE });
                await task.reload();
                expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            }

            // Verify all completions were recorded
            const completions = await RecurringCompletion.findAll({
                where: { task_id: task.id },
            });
            expect(completions.length).toBe(5);
        });
    });

    describe('Edge Cases', () => {
        it('should handle completing a task multiple times in quick succession', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Quick Complete Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Try to complete it twice rapidly
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            const dueDateAfterFirst = new Date(task.due_date);

            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            const dueDateAfterSecond = new Date(task.due_date);

            // Both completions should have been recorded
            const completions = await RecurringCompletion.findAll({
                where: { task_id: task.id },
            });
            expect(completions.length).toBe(2);

            // Second due date should be one day after first
            const expectedDate = new Date(dueDateAfterFirst);
            expectedDate.setUTCDate(expectedDate.getUTCDate() + 1);
            expect(dueDateAfterSecond.toISOString().split('T')[0]).toBe(
                expectedDate.toISOString().split('T')[0]
            );
        });

        it('should handle uncompleting a recurring task', async () => {
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);

            const task = await Task.create({
                name: 'Uncomplete Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: today,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const originalDueDate = new Date(task.due_date);

            // Complete the task
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            const advancedDueDate = new Date(task.due_date);

            // Due date should have advanced
            expect(advancedDueDate.getTime()).toBeGreaterThan(
                originalDueDate.getTime()
            );

            // Change status to in_progress (not completed)
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.IN_PROGRESS });
            await task.reload();

            // Due date should remain the same
            expect(new Date(task.due_date).getTime()).toBe(
                advancedDueDate.getTime()
            );
            expect(task.status).toBe(Task.STATUS.IN_PROGRESS);
        });

        it('should not create recurring completion for non-recurring tasks', async () => {
            const task = await Task.create({
                name: 'Regular Task',
                recurrence_type: 'none',
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete the task
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            // Should stay completed
            expect(task.status).toBe(Task.STATUS.DONE);
            expect(task.completed_at).not.toBeNull();

            // No recurring completion should be created
            const completions = await RecurringCompletion.findAll({
                where: { task_id: task.id },
            });
            expect(completions.length).toBe(0);
        });

        it('should handle tasks without a due date', async () => {
            const task = await Task.create({
                name: 'No Due Date Recurring',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: null,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Complete the task
            await agent
                .patch(`/api/task/${task.uid}`)
                .send({ status: Task.STATUS.DONE });
            await task.reload();

            // Should calculate next due date from completion time
            expect(task.status).toBe(Task.STATUS.NOT_STARTED);
            expect(task.due_date).not.toBeNull();

            const dueDate = new Date(task.due_date);
            const today = new Date();
            today.setUTCHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Due date should be approximately today or tomorrow
            expect(dueDate.getTime()).toBeGreaterThanOrEqual(today.getTime());
            expect(dueDate.getTime()).toBeLessThan(
                tomorrow.getTime() + 24 * 60 * 60 * 1000
            );
        });
    });

    describe('Service Function Tests', () => {
        it('calculateNextDueDate should return null for invalid inputs', () => {
            expect(calculateNextDueDate(null, new Date())).toBeNull();
            expect(
                calculateNextDueDate({ recurrence_type: null }, new Date())
            ).toBeNull();
            expect(
                calculateNextDueDate({ recurrence_type: 'daily' }, null)
            ).toBeNull();
            expect(
                calculateNextDueDate(
                    { recurrence_type: 'daily' },
                    new Date('invalid')
                )
            ).toBeNull();
        });

        it('calculateNextDueDate should handle unknown recurrence types', () => {
            const result = calculateNextDueDate(
                { recurrence_type: 'unknown_type' },
                new Date()
            );
            expect(result).toBeNull();
        });
    });
});
