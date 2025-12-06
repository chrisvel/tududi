const request = require('supertest');
const app = require('../../app');
const { Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Smart Recurring Task Deletion', () => {
    let agent;
    let user;
    let parentTask;

    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });

    beforeEach(async () => {
        agent = request.agent(app);
        user = await createTestUser();

        // Login
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });

        // Create a recurring parent task
        parentTask = await Task.create({
            name: 'Daily Exercise',
            recurrence_type: 'daily',
            recurrence_interval: 1,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });
    });

    afterEach(async () => {
        await sequelize.query('DELETE FROM tasks');
        await sequelize.query('DELETE FROM users');
    });

    afterAll(async () => {
        await sequelize.close();
    });

    it('should delete future instances and orphan past instances when deleting recurring parent', async () => {
        const now = new Date();

        // Create a completed past instance
        const pastInstance = await Task.create({
            name: 'Daily Exercise - Aug 15',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.COMPLETED,
            completed_at: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Yesterday
            due_date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        });

        // Create an in-progress instance
        const inProgressInstance = await Task.create({
            name: 'Daily Exercise - Today',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.IN_PROGRESS,
            due_date: now,
        });

        // Create future instances
        const futureInstance1 = await Task.create({
            name: 'Daily Exercise - Tomorrow',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000), // Tomorrow
        });

        const futureInstance2 = await Task.create({
            name: 'Daily Exercise - Day After',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            due_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // Day after tomorrow
        });

        // Verify initial setup
        const initialChildTasks = await Task.findAll({
            where: { recurring_parent_id: parentTask.id },
        });
        expect(initialChildTasks).toHaveLength(4);

        // Delete the parent task
        const response = await agent.delete(`/api/task/${parentTask.uid}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Task successfully deleted');

        // Verify parent is deleted
        const deletedParent = await Task.findByPk(parentTask.id);
        expect(deletedParent).toBeNull();

        // Verify future instances are deleted
        const deletedFuture1 = await Task.findByPk(futureInstance1.id);
        const deletedFuture2 = await Task.findByPk(futureInstance2.id);
        expect(deletedFuture1).toBeNull();
        expect(deletedFuture2).toBeNull();

        // Verify past instances still exist but are orphaned
        const orphanedPast = await Task.findByPk(pastInstance.id);
        const orphanedInProgress = await Task.findByPk(inProgressInstance.id);

        expect(orphanedPast).not.toBeNull();
        expect(orphanedPast.recurring_parent_id).toBeNull();

        expect(orphanedInProgress).not.toBeNull();
        expect(orphanedInProgress.recurring_parent_id).toBeNull();
    });

    it('should handle edge case where all instances are future', async () => {
        const now = new Date();

        // Create only future instances
        const futureInstance1 = await Task.create({
            name: 'Future Task 1',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            due_date: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        });

        const futureInstance2 = await Task.create({
            name: 'Future Task 2',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
            due_date: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
        });

        // Delete parent
        const response = await agent.delete(`/api/task/${parentTask.uid}`);

        expect(response.status).toBe(200);

        // All instances should be deleted
        const remainingTasks = await Task.findAll({
            where: { recurring_parent_id: parentTask.id },
        });
        expect(remainingTasks).toHaveLength(0);

        const deletedFuture1 = await Task.findByPk(futureInstance1.id);
        const deletedFuture2 = await Task.findByPk(futureInstance2.id);
        expect(deletedFuture1).toBeNull();
        expect(deletedFuture2).toBeNull();
    });

    it('should handle edge case where all instances are past', async () => {
        const now = new Date();

        // Create only past instances
        const pastInstance1 = await Task.create({
            name: 'Past Task 1',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.COMPLETED,
            completed_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
            due_date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
        });

        const pastInstance2 = await Task.create({
            name: 'Past Task 2',
            recurrence_type: 'none',
            recurring_parent_id: parentTask.id,
            user_id: user.id,
            status: Task.STATUS.IN_PROGRESS,
            due_date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        });

        // Delete parent
        const response = await agent.delete(`/api/task/${parentTask.uid}`);

        expect(response.status).toBe(200);

        // All instances should be orphaned but still exist
        const orphanedTasks = await Task.findAll({
            where: { id: [pastInstance1.id, pastInstance2.id] },
        });
        expect(orphanedTasks).toHaveLength(2);

        orphanedTasks.forEach((task) => {
            expect(task.recurring_parent_id).toBeNull();
        });
    });

    it('should still work for non-recurring tasks (no child tasks)', async () => {
        // Create a standalone task
        const standaloneTask = await Task.create({
            name: 'One-time Task',
            recurrence_type: 'none',
            user_id: user.id,
            status: Task.STATUS.NOT_STARTED,
        });

        const response = await agent.delete(`/api/task/${standaloneTask.uid}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Task successfully deleted');

        const deletedTask = await Task.findByPk(standaloneTask.id);
        expect(deletedTask).toBeNull();
    });
});
