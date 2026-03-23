const request = require('supertest');
const app = require('../../app');
const { Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    calculateNextDueDate,
} = require('../../modules/tasks/recurringTaskService');

describe('Recurring Tasks - DST Transition Handling', () => {
    let user, agent;

    beforeEach(async () => {
        user = await createTestUser({
            email: 'test@example.com',
        });

        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'test@example.com',
            password: 'password123',
        });
    });

    describe('DST Spring Forward (March 10, 2024 - America/New_York)', () => {
        const dstSpringDate = new Date(Date.UTC(2024, 2, 10, 7, 0, 0, 0));

        it('should create daily recurring task on DST transition day', async () => {
            const taskData = {
                name: 'DST Spring Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: dstSpringDate.toISOString().split('T')[0],
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.due_date).toBe('2024-03-10');
        });

        it('should advance daily task correctly from before DST to after DST', async () => {
            const beforeDST = new Date(Date.UTC(2024, 2, 9, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, beforeDST);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-10');
            expect(nextDate.getUTCDate()).toBe(10);
        });

        it('should advance daily task correctly from DST day to next day', async () => {
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, dstSpringDate);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-11');
            expect(nextDate.getUTCDate()).toBe(11);
        });

        it('should handle weekly recurring task spanning DST transition', async () => {
            const sunday = new Date(Date.UTC(2024, 2, 3, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 0,
            };

            const nextDate = calculateNextDueDate(task, sunday);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-10');
            expect(nextDate.getUTCDay()).toBe(0);
        });

        it('should not skip occurrences during DST spring forward', async () => {
            const march8 = new Date(Date.UTC(2024, 2, 8, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            let currentDate = march8;
            const dates = [];

            for (let i = 0; i < 5; i++) {
                dates.push(currentDate.toISOString().split('T')[0]);
                currentDate = calculateNextDueDate(task, currentDate);
            }

            expect(dates).toEqual([
                '2024-03-08',
                '2024-03-09',
                '2024-03-10',
                '2024-03-11',
                '2024-03-12',
            ]);
        });

        it('should handle monthly task due on DST transition day', async () => {
            const feb10 = new Date(Date.UTC(2024, 1, 10, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: 10,
            };

            const nextDate = calculateNextDueDate(task, feb10);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-10');
            expect(nextDate.getUTCDate()).toBe(10);
        });
    });

    describe('DST Fall Back (November 3, 2024 - America/New_York)', () => {
        const dstFallDate = new Date(Date.UTC(2024, 10, 3, 6, 0, 0, 0));

        it('should create daily recurring task on DST end day', async () => {
            const taskData = {
                name: 'DST Fall Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                due_date: dstFallDate.toISOString().split('T')[0],
            };

            const response = await agent.post('/api/task').send(taskData);

            expect(response.status).toBe(201);
            expect(response.body.due_date).toBe('2024-11-03');
        });

        it('should advance daily task correctly from before DST end to after', async () => {
            const beforeDSTEnd = new Date(Date.UTC(2024, 10, 2, 4, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, beforeDSTEnd);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-11-03');
            expect(nextDate.getUTCDate()).toBe(3);
        });

        it('should advance daily task correctly from DST end day to next day', async () => {
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, dstFallDate);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-11-04');
            expect(nextDate.getUTCDate()).toBe(4);
        });

        it('should not duplicate occurrences during DST fall back', async () => {
            const nov1 = new Date(Date.UTC(2024, 10, 1, 4, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            let currentDate = nov1;
            const dates = [];

            for (let i = 0; i < 5; i++) {
                dates.push(currentDate.toISOString().split('T')[0]);
                currentDate = calculateNextDueDate(task, currentDate);
            }

            expect(dates).toEqual([
                '2024-11-01',
                '2024-11-02',
                '2024-11-03',
                '2024-11-04',
                '2024-11-05',
            ]);
        });

        it('should handle weekly recurring task spanning DST end', async () => {
            const sunday = new Date(Date.UTC(2024, 9, 27, 4, 0, 0, 0));
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 0,
            };

            const nextDate = calculateNextDueDate(task, sunday);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-11-03');
            expect(nextDate.getUTCDay()).toBe(0);
        });

        it('should maintain date consistency through DST end', async () => {
            const oct15 = new Date(Date.UTC(2024, 9, 15, 4, 0, 0, 0));
            const task = {
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: 15,
            };

            const nextDate = calculateNextDueDate(task, oct15);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-11-15');
            expect(nextDate.getUTCDate()).toBe(15);
        });
    });

    describe('DST Across Multiple Timezones', () => {
        it('should handle Europe/London DST (different dates than US)', async () => {
            const march28 = new Date(Date.UTC(2024, 2, 28, 1, 0, 0, 0));
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 4,
            };

            const nextDate = calculateNextDueDate(task, march28);

            expect(nextDate.getUTCDay()).toBe(4);
            expect(nextDate.getUTCDate()).toBe(4);
        });

        it('should handle timezones without DST correctly', async () => {
            const arizona = new Date(Date.UTC(2024, 2, 10, 7, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, arizona);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-11');
        });

        it('should handle Australia/Sydney DST (opposite hemisphere)', async () => {
            const aprilSydney = new Date(Date.UTC(2024, 3, 7, 0, 0, 0, 0));
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 0,
            };

            const nextDate = calculateNextDueDate(task, aprilSydney);

            expect(nextDate.getUTCDay()).toBe(0);
        });
    });

    describe('Virtual Occurrences Spanning DST', () => {
        it('should generate virtual occurrences correctly across DST spring forward', async () => {
            const march7 = new Date(Date.UTC(2024, 2, 7, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            let currentDate = march7;
            const occurrences = [];

            for (let i = 0; i < 7; i++) {
                occurrences.push({
                    due_date: currentDate.toISOString().split('T')[0],
                });
                currentDate = calculateNextDueDate(task, currentDate);
            }

            expect(occurrences.map((o) => o.due_date)).toEqual([
                '2024-03-07',
                '2024-03-08',
                '2024-03-09',
                '2024-03-10',
                '2024-03-11',
                '2024-03-12',
                '2024-03-13',
            ]);
        });

        it('should generate virtual occurrences correctly across DST fall back', async () => {
            const oct31 = new Date(Date.UTC(2024, 9, 31, 4, 0, 0, 0));
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            let currentDate = oct31;
            const occurrences = [];

            for (let i = 0; i < 7; i++) {
                occurrences.push({
                    due_date: currentDate.toISOString().split('T')[0],
                });
                currentDate = calculateNextDueDate(task, currentDate);
            }

            expect(occurrences.map((o) => o.due_date)).toEqual([
                '2024-10-31',
                '2024-11-01',
                '2024-11-02',
                '2024-11-03',
                '2024-11-04',
                '2024-11-05',
                '2024-11-06',
            ]);
        });

        it('should handle bi-weekly recurrence across DST transition', async () => {
            const feb25 = new Date(Date.UTC(2024, 1, 25, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekday: 0,
            };

            let currentDate = feb25;
            const occurrences = [];

            for (let i = 0; i < 4; i++) {
                occurrences.push({
                    due_date: currentDate.toISOString().split('T')[0],
                });
                currentDate = calculateNextDueDate(task, currentDate);
            }

            expect(occurrences.map((o) => o.due_date)).toEqual([
                '2024-02-25',
                '2024-03-10',
                '2024-03-24',
                '2024-04-07',
            ]);
        });
    });

    describe('Monthly Recurrence During DST Months', () => {
        it('should handle monthly recurrence during DST start month', async () => {
            const feb15 = new Date(Date.UTC(2024, 1, 15, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: 15,
            };

            const nextDate = calculateNextDueDate(task, feb15);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-15');
            expect(nextDate.getUTCDate()).toBe(15);
        });

        it('should handle monthly recurrence during DST end month', async () => {
            const oct20 = new Date(Date.UTC(2024, 9, 20, 4, 0, 0, 0));
            const task = {
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                recurrence_month_day: 20,
            };

            const nextDate = calculateNextDueDate(task, oct20);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-11-20');
            expect(nextDate.getUTCDate()).toBe(20);
        });

        it('should handle monthly weekday recurrence across DST', async () => {
            const feb1st = new Date(Date.UTC(2024, 1, 5, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'monthly_weekday',
                recurrence_interval: 1,
                recurrence_weekday: 1,
                recurrence_week_of_month: 1,
            };

            const nextDate = calculateNextDueDate(task, feb1st);

            expect(nextDate.getUTCDay()).toBe(1);
            expect(nextDate.getUTCMonth()).toBe(2);
        });

        it('should handle monthly last day across DST', async () => {
            const feb29 = new Date(Date.UTC(2024, 1, 29, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'monthly_last_day',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, feb29);

            expect(nextDate.getUTCMonth()).toBe(2);
            expect(nextDate.getUTCDate()).toBe(31);
        });
    });

    describe('Edge Cases During DST Transition Hour', () => {
        it('should handle task created exactly at DST transition (2 AM)', async () => {
            const dstTransitionMoment = new Date(
                Date.UTC(2024, 2, 10, 7, 0, 0, 0)
            );
            const task = {
                recurrence_type: 'daily',
                recurrence_interval: 1,
            };

            const nextDate = calculateNextDueDate(task, dstTransitionMoment);

            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-11');
        });

        it('should handle weekly task due Sunday when DST transitions Sunday', async () => {
            const sundayDST = new Date(Date.UTC(2024, 2, 10, 5, 0, 0, 0));
            const task = {
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 0,
            };

            const nextDate = calculateNextDueDate(task, sundayDST);

            expect(nextDate.getUTCDay()).toBe(0);
            expect(nextDate.toISOString().split('T')[0]).toBe('2024-03-17');
        });
    });
});
