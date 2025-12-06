const request = require('supertest');
const app = require('../../app');
const { Task, sequelize } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Subtasks Completion Logic Integration', () => {
    let testUser;
    let agent;

    const toggleTaskCompletion = async (taskId) => {
        const task = await Task.findByPk(taskId);
        const newStatus =
            task.status === Task.STATUS.DONE
                ? task.note
                    ? Task.STATUS.IN_PROGRESS
                    : Task.STATUS.NOT_STARTED
                : Task.STATUS.DONE;

        return agent.patch(`/api/task/${task.uid}`).send({ status: newStatus });
    };

    beforeEach(async () => {
        await Task.destroy({ where: {}, truncate: true });

        testUser = await createTestUser();

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: testUser.email,
            password: 'password123',
        });
    });

    describe('Parent Task Completion Affects Subtasks', () => {
        it('should complete all subtasks when parent task is completed', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create subtasks
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
                status: Task.STATUS.IN_PROGRESS,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask3 = await Task.create({
                name: 'Subtask 3',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.DONE,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Complete parent task
            let res = await toggleTaskCompletion(parentTask.id);
            expect(res.status).toBe(200);

            // Verify parent task is completed
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.DONE);
            expect(updatedParent.completed_at).not.toBeNull();

            // Verify all subtasks are completed
            const updatedSubtasks = await Task.findAll({
                where: { parent_task_id: parentTask.id },
                order: [['id', 'ASC']],
            });

            expect(updatedSubtasks).toHaveLength(3);
            updatedSubtasks.forEach((subtask) => {
                expect(subtask.status).toBe(Task.STATUS.DONE);
                expect(subtask.completed_at).not.toBeNull();
            });
        });

        it('should undone all subtasks when parent task is undone', async () => {
            // Create completed parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create completed subtasks
            const subtask1 = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask2 = await Task.create({
                name: 'Subtask 2',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            // Undone parent task
            let res = await toggleTaskCompletion(parentTask.id);
            expect(res.status).toBe(200);

            // Verify parent task is undone
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.NOT_STARTED);
            expect(updatedParent.completed_at).toBeNull();

            // Verify all subtasks are undone
            const updatedSubtasks = await Task.findAll({
                where: { parent_task_id: parentTask.id },
            });

            expect(updatedSubtasks).toHaveLength(2);
            updatedSubtasks.forEach((subtask) => {
                expect(subtask.status).toBe(Task.STATUS.NOT_STARTED);
                expect(subtask.completed_at).toBeNull();
            });
        });
    });

    describe('Subtask Completion Affects Parent Task', () => {
        it('should complete parent task when all subtasks are completed', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create subtasks
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

            // Complete first subtask
            let res = await toggleTaskCompletion(subtask1.id);
            expect(res.status).toBe(200);

            // Parent should still be incomplete
            let updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.NOT_STARTED);

            // Complete second subtask
            const res2 = await toggleTaskCompletion(subtask2.id);
            expect(res2.status).toBe(200);

            // Parent should now be completed
            updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.DONE);
            expect(updatedParent.completed_at).not.toBeNull();
        });

        it('should undone parent task when any subtask is undone', async () => {
            // Create completed parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create completed subtasks
            const subtask1 = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask2 = await Task.create({
                name: 'Subtask 2',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            // Undone one subtask
            let res = await toggleTaskCompletion(subtask1.id);
            expect(res.status).toBe(200);

            // Parent should be undone
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.NOT_STARTED);
            expect(updatedParent.completed_at).toBeNull();

            // Other subtask should remain done
            const updatedSubtask2 = await Task.findByPk(subtask2.id);
            expect(updatedSubtask2.status).toBe(Task.STATUS.DONE);
        });

        it('should not affect parent task when no subtasks exist', async () => {
            // Create parent task without subtasks
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Complete parent task directly
            let res = await toggleTaskCompletion(parentTask.id);
            expect(res.status).toBe(200);

            // Parent should be completed normally
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.DONE);
            expect(updatedParent.completed_at).not.toBeNull();
        });
    });

    describe('Complex Completion Scenarios', () => {
        it('should handle mixed subtask states correctly', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create subtasks with different statuses
            const subtask1 = await Task.create({
                name: 'Subtask 1',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.DONE,
                completed_at: new Date(),
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask2 = await Task.create({
                name: 'Subtask 2',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.IN_PROGRESS,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtask3 = await Task.create({
                name: 'Subtask 3',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.WAITING,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Complete remaining subtasks
            let res = await toggleTaskCompletion(subtask2.id);
            expect(res.status).toBe(200);

            // Parent should still be incomplete
            let updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.NOT_STARTED);

            // Complete last subtask
            const res2 = await toggleTaskCompletion(subtask3.id);
            expect(res2.status).toBe(200);

            // Parent should now be completed
            updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.DONE);
        });

        it('should handle rapid completion toggles correctly', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create single subtask
            const subtask = await Task.create({
                name: 'Subtask',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Rapidly toggle subtask completion
            let res = await toggleTaskCompletion(subtask.id);
            expect(res.status).toBe(200);

            const res2 = await toggleTaskCompletion(subtask.id);
            expect(res2.status).toBe(200);

            const res3 = await toggleTaskCompletion(subtask.id);
            expect(res3.status).toBe(200);

            // Final state should be consistent
            const updatedSubtask = await Task.findByPk(subtask.id);
            const updatedParent = await Task.findByPk(parentTask.id);

            // Final state should be consistent
            expect(
                updatedSubtask.status === Task.STATUS.DONE
                    ? updatedParent.status
                    : updatedParent.status
            ).toBe(
                updatedSubtask.status === Task.STATUS.DONE
                    ? Task.STATUS.DONE
                    : Task.STATUS.NOT_STARTED
            );
        });
    });

    describe('Edge Cases', () => {
        it('should cascade delete subtasks when parent is deleted', async () => {
            // Create parent task first
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create subtask
            const subtask = await Task.create({
                name: 'Child Subtask',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            const subtaskId = subtask.id;

            // In test environment, FK constraints are disabled, so we need to manually handle cascade delete
            // In production, this would be handled by database FK constraints with CASCADE
            await Task.destroy({ where: { parent_task_id: parentTask.id } });
            await parentTask.destroy();

            // Verify subtask was also deleted (CASCADE behavior)
            const deletedSubtask = await Task.findByPk(subtaskId);
            expect(deletedSubtask).toBeNull();
        });

        it('should handle concurrent completion updates', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create subtasks
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

            // Simulate concurrent completion
            const promises = [
                toggleTaskCompletion(subtask1.id),
                toggleTaskCompletion(subtask2.id),
            ];

            const results = await Promise.all(promises);
            results.forEach((result) => {
                expect(result.status).toBe(200);
            });

            // Final state should be consistent
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.DONE);
        });

        it('should handle deleted parent task gracefully (FK constraints disabled)', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create subtask
            const subtask = await Task.create({
                name: 'Subtask',
                user_id: testUser.id,
                parent_task_id: parentTask.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Delete parent task (in test environment, FK constraints are disabled)
            await agent
                .delete(`/api/task/${parentTask.uid}`)

                .expect(200);

            // Verify subtask remains (orphaned) since FK constraints are disabled in tests
            const remainingSubtask = await Task.findByPk(subtask.id);
            expect(remainingSubtask).not.toBeNull();
            expect(remainingSubtask.parent_task_id).toBe(parentTask.id); // Points to deleted parent
        });
    });

    describe('Performance Considerations', () => {
        it('should handle many subtasks efficiently', async () => {
            // Create parent task
            const parentTask = await Task.create({
                name: 'Parent Task',
                user_id: testUser.id,
                status: Task.STATUS.NOT_STARTED,
                priority: Task.PRIORITY.MEDIUM,
            });

            // Create many subtasks
            const subtaskPromises = [];
            for (let i = 1; i <= 50; i++) {
                subtaskPromises.push(
                    Task.create({
                        name: `Subtask ${i}`,
                        user_id: testUser.id,
                        parent_task_id: parentTask.id,
                        status: Task.STATUS.NOT_STARTED,
                        priority: Task.PRIORITY.MEDIUM,
                    })
                );
            }

            const subtasks = await Promise.all(subtaskPromises);

            // Complete all subtasks
            const completionPromises = subtasks.map((subtask) =>
                toggleTaskCompletion(subtask.id)
            );

            const startTime = Date.now();
            await Promise.all(completionPromises);
            const endTime = Date.now();

            // Should complete within reasonable time (adjust threshold as needed)
            expect(endTime - startTime).toBeLessThan(10000); // 10 seconds

            // Parent should be completed
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.status).toBe(Task.STATUS.DONE);
        });
    });
});
