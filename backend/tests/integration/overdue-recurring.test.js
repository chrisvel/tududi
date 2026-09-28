const request = require('supertest');
const moment = require('moment-timezone');
const app = require('../../app');
const { Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Overdue recurring tasks', () => {
    const timezone = 'UTC';
    let user, agent, yesterday, bill;

    const matching = (list, task) =>
        (list || []).filter((t) => t.id === task.id || t.uid === task.uid);

    beforeEach(async () => {
        user = await createTestUser({
            email: 'overdue-recurring@example.com',
            timezone,
        });
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: 'overdue-recurring@example.com',
            password: 'password123',
        });

        yesterday = moment.tz(timezone).subtract(1, 'day').startOf('day');
        bill = await Task.create({
            name: 'Pay the electricity bill',
            user_id: user.id,
            recurrence_type: 'monthly',
            recurrence_interval: 1,
            recurrence_month_day: yesterday.date(),
            due_date: yesterday.toDate(),
            status: Task.STATUS.NOT_STARTED,
        });
    });

    it('stays in the default task list with its missed due date', async () => {
        const res = await agent.get('/api/tasks?status=active');

        expect(res.status).toBe(200);
        const found = matching(res.body.tasks, bill);
        expect(found).toHaveLength(1);
        expect(found[0].due_date).toBe(yesterday.format('YYYY-MM-DD'));
    });

    it('stays in the all tasks list', async () => {
        const res = await agent.get('/api/tasks?type=all');

        expect(res.status).toBe(200);
        expect(matching(res.body.tasks, bill)).toHaveLength(1);
    });

    it('shows once in the Today overdue section', async () => {
        const res = await agent.get('/api/tasks?type=today&include_lists=true');

        expect(res.status).toBe(200);
        const overdue = matching(res.body.tasks_overdue, bill);
        expect(overdue).toHaveLength(1);
        expect(overdue[0].due_date).toBe(yesterday.format('YYYY-MM-DD'));
        expect(matching(res.body.tasks_due_today, bill)).toHaveLength(0);
    });

    it('shows once as overdue in the Plan my day candidates', async () => {
        const res = await agent.get('/api/daily-plan/candidates');

        expect(res.status).toBe(200);
        expect(matching(res.body.overdue, bill)).toHaveLength(1);
        const elsewhere = [
            ...res.body.due_today,
            ...res.body.in_progress,
            ...res.body.suggested,
        ];
        expect(matching(elsewhere, bill)).toHaveLength(0);
    });

    it('does not repeat the missed occurrence in the upcoming view', async () => {
        const standup = await Task.create({
            name: 'Weekly standup',
            user_id: user.id,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            due_date: yesterday.toDate(),
            status: Task.STATUS.NOT_STARTED,
        });

        const res = await agent.get('/api/tasks?type=upcoming&groupBy=day');

        expect(res.status).toBe(200);
        const today = moment.tz(timezone).format('YYYY-MM-DD');
        const occurrences = matching(res.body.tasks, standup);
        expect(occurrences.length).toBeGreaterThanOrEqual(1);
        occurrences.forEach((t) => {
            expect(t.due_date >= today).toBe(true);
        });
    });

    it('moves to next month and leaves overdue once completed', async () => {
        const done = await agent
            .patch(`/api/task/${bill.uid}`)
            .send({ status: Task.STATUS.DONE });
        expect(done.status).toBe(200);

        const nextMonth = yesterday.clone().add(1, 'month');
        const fetched = await agent.get(`/api/task/${bill.uid}`);
        expect(fetched.status).toBe(200);
        expect(fetched.body.status).toBe(Task.STATUS.NOT_STARTED);
        expect(fetched.body.due_date).toBe(nextMonth.format('YYYY-MM-DD'));

        const today = await agent.get(
            '/api/tasks?type=today&include_lists=true'
        );
        expect(matching(today.body.tasks_overdue, bill)).toHaveLength(0);

        const list = await agent.get('/api/tasks?status=active');
        const found = matching(list.body.tasks, bill);
        expect(found).toHaveLength(1);
        expect(found[0].due_date).toBe(nextMonth.format('YYYY-MM-DD'));
    });

    it('drops out of the active list once archived or cancelled', async () => {
        await bill.update({ status: Task.STATUS.CANCELLED });
        let res = await agent.get('/api/tasks?status=active');
        expect(matching(res.body.tasks, bill)).toHaveLength(0);

        await bill.update({ status: Task.STATUS.ARCHIVED });
        res = await agent.get('/api/tasks?status=active');
        expect(matching(res.body.tasks, bill)).toHaveLength(0);
    });

    it('still lists an open task whose recurrence already ended', async () => {
        await bill.update({
            recurrence_end_date: yesterday.clone().subtract(1, 'day').toDate(),
        });

        const res = await agent.get('/api/tasks?status=active');
        const found = matching(res.body.tasks, bill);
        expect(found).toHaveLength(1);
        expect(found[0].due_date).toBe(yesterday.format('YYYY-MM-DD'));
    });

    it('keeps listing recurring tasks due in the future', async () => {
        const rent = await Task.create({
            name: 'Pay rent',
            user_id: user.id,
            recurrence_type: 'weekly',
            recurrence_interval: 1,
            due_date: moment.tz(timezone).add(3, 'days').toDate(),
            status: Task.STATUS.NOT_STARTED,
        });

        const res = await agent.get('/api/tasks?status=active');
        expect(matching(res.body.tasks, rent)).toHaveLength(1);

        const today = await agent.get(
            '/api/tasks?type=today&include_lists=true'
        );
        expect(matching(today.body.tasks_overdue, rent)).toHaveLength(0);
    });
});
