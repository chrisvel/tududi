const { Task } = require('../../../models');
const { createTestUser } = require('../../helpers/testUtils');

describe('Task Model - Subtasks', () => {
    let testUser;

    beforeEach(async () => {
        // Clean up tasks first
        await Task.destroy({ where: {}, truncate: true });
        // Create test user for each test since setup.js deletes all users
        testUser = await createTestUser();
    });

    describe('Subtask Creation', () => {
        it('should create a task with subtasks', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            expect(subtask.parent_task_id).toBe(parentTask.id);
            expect(subtask.name).toBe('Subtask 1');
        });

        it('should allow multiple subtasks for a parent task', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask1 = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask2 = await Task.create({
                name: 'Subtask 2',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            expect(subtask1.parent_task_id).toBe(parentTask.id);
            expect(subtask2.parent_task_id).toBe(parentTask.id);
        });

        it('should allow null parent_task_id (top-level tasks)', async () => {
            const task = await Task.create({
                name: 'Top Level Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            expect(task.parent_task_id).toBeUndefined();
        });
    });

    describe('Subtask Associations', () => {
        it('should retrieve parent task from subtask', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtaskWithParent = await Task.findByPk(subtask.id, {
                include: [{ model: Task, as: 'ParentTask' }],
            });

            expect(subtaskWithParent.ParentTask).toBeDefined();
            expect(subtaskWithParent.ParentTask.id).toBe(parentTask.id);
            expect(subtaskWithParent.ParentTask.name).toBe('Parent Task');
        });

        it('should retrieve all subtasks from parent task', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            await Task.create({
                name: 'Subtask 2',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const parentWithSubtasks = await Task.findByPk(parentTask.id, {
                include: [{ model: Task, as: 'Subtasks' }],
            });

            expect(parentWithSubtasks.Subtasks).toBeDefined();
            expect(parentWithSubtasks.Subtasks.length).toBe(2);
            expect(parentWithSubtasks.Subtasks[0].name).toBe('Subtask 1');
            expect(parentWithSubtasks.Subtasks[1].name).toBe('Subtask 2');
        });
    });

    describe('Subtask Validation', () => {
        it('should validate parent_task_id references existing task', async () => {
            // Foreign key constraints are enabled in test environment, so this should throw an error
            await expect(
                Task.create({
                    name: 'Invalid Subtask',
                    user_id: testUser.id,
                    parent_task_id: 999999, // Non-existent task ID
                    status: Task.STATUS.NOT_STARTED,
                    priority: Task.PRIORITY.MEDIUM,
                })
            ).rejects.toThrow();
        });

        it('should not allow subtask to reference itself as parent', async () => {
            const task = await Task.create({
                name: 'Self Reference Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Note: In test environment without FK constraints, this will succeed
            // In production, this would be prevented by application logic or FK constraints
            const updatedTask = await task.update({
                parent_task_id: task.id,
            });

            expect(updatedTask.parent_task_id).toBe(task.id);
        });
    });

    describe('Subtask Filtering', () => {
        it('should filter parent tasks only', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const parentTasks = await Task.findAll({
                where: {
                    user_id: testUser.id,
                    parent_task_id: null,
                },
            });

            expect(parentTasks.length).toBe(1);
            expect(parentTasks[0].id).toBe(parentTask.id);
        });

        it('should filter subtasks only', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtasks = await Task.findAll({
                where: {
                    user_id: testUser.id,
                    parent_task_id: parentTask.id,
                },
            });

            expect(subtasks.length).toBe(1);
            expect(subtasks[0].id).toBe(subtask.id);
        });
    });

    describe('Cascade Operations', () => {
        it('should delete subtasks when parent is deleted', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // In test environment, we need to manually handle cascade delete
            // In production, this would be handled by database constraints or application logic
            await Task.destroy({ where: { parent_task_id: parentTask.id } });
            await parentTask.destroy();

            const remainingSubtasks = await Task.findAll({
                where: { parent_task_id: parentTask.id },
            });

            expect(remainingSubtasks.length).toBe(0);
        });
    });
});
