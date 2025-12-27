const { Task, Project } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');
const {
    getTaskMetrics,
} = require('../../routes/tasks/queries/metrics-computation');

const dayFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

describe('Task Metrics Suggested Tasks', () => {
    let user;

    const createTask = async (overrides = {}) => {
        const { priority, status, ...rest } = overrides;
        return await Task.create({
            name: rest.name || 'Suggested task',
            user_id: user.id,
            status:
                typeof status === 'string'
                    ? Task.getStatusValue(status)
                    : (status ?? Task.STATUS.NOT_STARTED),
            today: false,
            priority:
                typeof priority === 'string'
                    ? Task.getPriorityValue(priority)
                    : (priority ?? Task.PRIORITY.LOW),
            parent_task_id: null,
            recurring_parent_id: null,
            ...rest,
        });
    };

    beforeEach(async () => {
        user = await createTestUser({ email: 'metrics@example.com' });
    });

    it('orders suggested tasks by priority, due date, and project', async () => {
        const projectAlpha = await Project.create({
            name: 'Alpha Project',
            user_id: user.id,
        });
        const projectBeta = await Project.create({
            name: 'Beta Project',
            user_id: user.id,
        });

        await createTask({
            name: 'High Due Later',
            priority: 'high',
            due_date: dayFromNow(3),
            project_id: projectBeta.id,
        });
        await createTask({
            name: 'High Due Soon',
            priority: 'high',
            due_date: dayFromNow(1),
            project_id: projectAlpha.id,
        });
        await createTask({
            name: 'Medium Alpha',
            priority: 'medium',
            due_date: dayFromNow(4),
            project_id: projectAlpha.id,
        });
        await createTask({
            name: 'Medium Beta',
            priority: 'medium',
            due_date: dayFromNow(4),
            project_id: projectBeta.id,
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const names = metrics.suggested_tasks.map((task) => task.name);
        expect(names).toEqual([
            'High Due Soon',
            'High Due Later',
            'Medium Alpha',
            'Medium Beta',
        ]);
    });

    it('excludes tasks deferred into the future from suggested results', async () => {
        await createTask({ name: 'Ready Task', priority: 'high' });
        await createTask({
            name: 'Deferred Past Task',
            defer_until: dayFromNow(-1),
        });
        await createTask({
            name: 'Deferred Future Task',
            defer_until: dayFromNow(2),
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const names = metrics.suggested_tasks.map((task) => task.name);
        expect(names).toContain('Ready Task');
        expect(names).toContain('Deferred Past Task');
        expect(names).not.toContain('Deferred Future Task');
    });

    it('excludes overdue tasks from suggested results (they show in Overdue section)', async () => {
        // Need at least 3 open tasks for suggested to compute
        await createTask({ name: 'Ready Task 1', priority: 'high' });
        await createTask({ name: 'Ready Task 2', priority: 'medium' });
        await createTask({ name: 'Ready Task 3', priority: 'low' });
        await createTask({
            name: 'Overdue Task',
            due_date: dayFromNow(-3),
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const suggestedNames = metrics.suggested_tasks.map((task) => task.name);
        const overdueNames = metrics.tasks_overdue.map((task) => task.name);

        // Overdue task should be in overdue section, not suggested
        expect(overdueNames).toContain('Overdue Task');
        expect(suggestedNames).not.toContain('Overdue Task');
    });
});

describe('Task Metrics Overdue and Due Today Tasks', () => {
    let user;

    const createTask = async (overrides = {}) => {
        const { priority, status, ...rest } = overrides;
        return await Task.create({
            name: rest.name || 'Test task',
            user_id: user.id,
            status:
                typeof status === 'string'
                    ? Task.getStatusValue(status)
                    : (status ?? Task.STATUS.NOT_STARTED),
            priority:
                typeof priority === 'string'
                    ? Task.getPriorityValue(priority)
                    : (priority ?? Task.PRIORITY.LOW),
            parent_task_id: null,
            recurring_parent_id: null,
            ...rest,
        });
    };

    beforeEach(async () => {
        user = await createTestUser({ email: 'overdue-test@example.com' });
    });

    it('excludes overdue tasks with active status from tasks_overdue (they show in Planned)', async () => {
        // Create an overdue task with IN_PROGRESS status (shows in Planned section)
        await createTask({
            name: 'Overdue In Progress',
            due_date: dayFromNow(-3),
            status: Task.STATUS.IN_PROGRESS,
        });
        // Create a regular overdue task with NOT_STARTED status
        await createTask({
            name: 'Regular Overdue Task',
            due_date: dayFromNow(-2),
            status: Task.STATUS.NOT_STARTED,
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const overdueNames = metrics.tasks_overdue.map((task) => task.name);

        // IN_PROGRESS task should NOT be in overdue (it's in Planned section)
        expect(overdueNames).not.toContain('Overdue In Progress');
        // NOT_STARTED task should be in overdue
        expect(overdueNames).toContain('Regular Overdue Task');
    });

    it('excludes due today tasks with active status from tasks_due_today (they show in Planned)', async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        // Create a task due today with PLANNED status (shows in Planned section)
        await createTask({
            name: 'Due Today Planned',
            due_date: today,
            status: Task.STATUS.PLANNED,
        });
        // Create a regular due today task with NOT_STARTED status
        await createTask({
            name: 'Regular Due Today',
            due_date: today,
            status: Task.STATUS.NOT_STARTED,
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const dueTodayNames = metrics.tasks_due_today.map((task) => task.name);

        // PLANNED task should NOT be in due today (it's in Planned section)
        expect(dueTodayNames).not.toContain('Due Today Planned');
        // NOT_STARTED task should be in due today
        expect(dueTodayNames).toContain('Regular Due Today');
    });

    it('includes tasks with WAITING status in Planned section, not in overdue', async () => {
        await createTask({
            name: 'Overdue Waiting',
            due_date: dayFromNow(-1),
            status: Task.STATUS.WAITING,
        });

        const metrics = await getTaskMetrics(user.id, 'UTC');
        const overdueNames = metrics.tasks_overdue.map((task) => task.name);
        const todayPlanNames = metrics.tasks_today_plan.map(
            (task) => task.name
        );

        // WAITING task should be in today plan, not in overdue
        expect(overdueNames).not.toContain('Overdue Waiting');
        expect(todayPlanNames).toContain('Overdue Waiting');
    });
});
