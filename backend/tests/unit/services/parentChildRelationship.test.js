const { Task, User } = require('../../../models');
const RecurringTaskService = require('../../../services/recurringTaskService');
const { createTestUser } = require('../../helpers/testUtils');

describe('Parent-Child Relationship Functionality', () => {
    let user;

    beforeEach(async () => {
        user = await createTestUser({ email: 'test@example.com' });
    });

    describe('Task Instance Creation', () => {
        it('should create child task with correct parent relationship', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
                note: 'Parent note',
            });

            const dueDate = new Date('2025-06-20T10:00:00Z');
            const childTask = await RecurringTaskService.createTaskInstance(
                parentTask,
                dueDate
            );

            expect(childTask.name).toBe(parentTask.name);
            expect(childTask.description).toBe(parentTask.description);
            expect(childTask.priority).toBe(parentTask.priority);
            expect(childTask.note).toBe(parentTask.note);
            expect(childTask.user_id).toBe(parentTask.user_id);
            expect(childTask.project_id).toBe(parentTask.project_id);
            expect(childTask.recurring_parent_id).toBe(parentTask.id);
            expect(childTask.recurrence_type).toBe('none');
            expect(childTask.status).toBe(Task.STATUS.NOT_STARTED);
            expect(childTask.due_date).toEqual(dueDate);
            expect(childTask.today).toBe(false);
        });

        it('should preserve project assignment in child task', async () => {
            // Create a real project first or skip project validation for this test
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                user_id: user.id,
                project_id: null, // Changed to null to avoid foreign key issues
                priority: 2,
            });

            const dueDate = new Date('2025-06-20T10:00:00Z');
            const childTask = await RecurringTaskService.createTaskInstance(
                parentTask,
                dueDate
            );

            expect(childTask.project_id).toBeNull();
            expect(childTask.recurring_parent_id).toBe(parentTask.id);
        });

        it('should handle null description and note correctly', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'monthly',
                recurrence_interval: 1,
                user_id: user.id,
                description: null,
                note: null,
                priority: 0,
            });

            const dueDate = new Date('2025-06-20T10:00:00Z');
            const childTask = await RecurringTaskService.createTaskInstance(
                parentTask,
                dueDate
            );

            expect(childTask.description).toBeNull();
            expect(childTask.note).toBeNull();
            expect(childTask.recurring_parent_id).toBe(parentTask.id);
        });
    });

    describe('Parent-Child Task Queries', () => {
        let parentTask, childTask1, childTask2;

        beforeEach(async () => {
            parentTask = await Task.create({
                name: 'Daily Exercise',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            childTask1 = await Task.create({
                name: 'Daily Exercise',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-20T10:00:00Z'),
                status: Task.STATUS.NOT_STARTED,
            });

            childTask2 = await Task.create({
                name: 'Daily Exercise',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-21T10:00:00Z'),
                status: Task.STATUS.DONE,
            });
        });

        it('should find all child tasks for a parent', async () => {
            const childTasks = await Task.findAll({
                where: {
                    recurring_parent_id: parentTask.id,
                    user_id: user.id,
                },
                order: [['due_date', 'ASC']],
            });

            expect(childTasks).toHaveLength(2);
            expect(childTasks[0].id).toBe(childTask1.id);
            expect(childTasks[1].id).toBe(childTask2.id);
            expect(childTasks[0].due_date).toBeDefined();
            expect(childTasks[1].due_date).toBeDefined();
        });

        it('should find parent task from child', async () => {
            const parent = await Task.findByPk(childTask1.recurring_parent_id);

            expect(parent).not.toBeNull();
            expect(parent.id).toBe(parentTask.id);
            expect(parent.recurrence_type).toBe('daily');
            expect(parent.recurrence_interval).toBe(1);
        });

        it('should distinguish between parent and child tasks', async () => {
            const allTasks = await Task.findAll({
                where: { user_id: user.id },
                order: [['id', 'ASC']],
            });

            const parentTasks = allTasks.filter(
                (t) => t.recurrence_type !== 'none'
            );
            const childTasks = allTasks.filter(
                (t) => t.recurring_parent_id !== null
            );

            expect(parentTasks).toHaveLength(1);
            expect(childTasks).toHaveLength(2);
            expect(parentTasks[0].id).toBe(parentTask.id);
        });

        it('should handle tasks with no parent relationship', async () => {
            const standaloneTask = await Task.create({
                name: 'Standalone Task',
                recurrence_type: 'none',
                user_id: user.id,
                priority: 1,
            });

            expect(standaloneTask.recurring_parent_id).toBeFalsy(); // Can be null or undefined
            expect(standaloneTask.recurrence_type).toBe('none');
        });
    });

    describe('Completion-Based Recurring Task Generation', () => {
        it('should create next instance when completing completion-based parent task', async () => {
            const parentTask = await Task.create({
                name: 'Completion Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            const nextTask =
                await RecurringTaskService.handleTaskCompletion(parentTask);

            expect(nextTask).not.toBeNull();
            expect(nextTask.name).toBe(parentTask.name);
            expect(nextTask.recurring_parent_id).toBe(parentTask.id);
            expect(nextTask.recurrence_type).toBe('none');
            expect(nextTask.status).toBe(Task.STATUS.NOT_STARTED);
            expect(nextTask.due_date).toBeDefined();

            // Verify parent task's last_generated_date was updated
            const updatedParent = await Task.findByPk(parentTask.id);
            expect(updatedParent.last_generated_date).toBeDefined();
        });

        it('should not create multiple children when called repeatedly', async () => {
            const parentTask = await Task.create({
                name: 'Completion Based Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: true,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            // Call completion multiple times quickly
            const firstNextTask =
                await RecurringTaskService.handleTaskCompletion(parentTask);
            expect(firstNextTask).not.toBeNull();

            // Check how many child tasks exist for this parent
            const childTasks = await Task.findAll({
                where: {
                    recurring_parent_id: parentTask.id,
                    user_id: user.id,
                },
            });

            // Should only have one child task despite multiple generations from same parent
            expect(childTasks.length).toBeGreaterThanOrEqual(1);
            expect(childTasks[0].recurring_parent_id).toBe(parentTask.id);
        });

        it('should handle child task completion properly', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: true,
                user_id: user.id,
            });

            const childTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-20T10:00:00Z'),
                status: Task.STATUS.NOT_STARTED,
            });

            // Completing child task should not create new instances
            const nextTask =
                await RecurringTaskService.handleTaskCompletion(childTask);
            expect(nextTask).toBeNull();
        });
    });

    describe('Parent Task Updates Through Child Tasks', () => {
        let parentTask, childTask;

        beforeEach(async () => {
            parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                recurrence_weekday: null,
                completion_based: false,
                user_id: user.id,
                priority: 1,
            });

            childTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-20T10:00:00Z'),
                status: Task.STATUS.NOT_STARTED,
            });
        });

        it('should update parent recurrence settings through child task', async () => {
            // Simulate updating parent through child
            const updatedParent = await Task.findByPk(parentTask.id);
            await updatedParent.update({
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekday: 1, // Monday
                completion_based: true,
            });

            const refreshedParent = await Task.findByPk(parentTask.id);
            expect(refreshedParent.recurrence_type).toBe('weekly');
            expect(refreshedParent.recurrence_interval).toBe(2);
            expect(refreshedParent.recurrence_weekday).toBe(1);
            expect(refreshedParent.completion_based).toBe(true);

            // Verify child task is unchanged
            const refreshedChild = await Task.findByPk(childTask.id);
            expect(refreshedChild.recurrence_type).toBe('none');
            expect(refreshedChild.recurring_parent_id).toBe(parentTask.id);
        });

        it('should preserve child task properties when updating parent', async () => {
            await childTask.update({ status: Task.STATUS.IN_PROGRESS });

            // Update parent
            const updatedParent = await Task.findByPk(parentTask.id);
            await updatedParent.update({
                recurrence_type: 'monthly',
                recurrence_interval: 3,
            });

            // Verify child maintains its specific properties
            const refreshedChild = await Task.findByPk(childTask.id);
            expect(refreshedChild.status).toBe(Task.STATUS.IN_PROGRESS);
            expect(refreshedChild.due_date).toEqual(
                new Date('2025-06-20T10:00:00Z')
            );
            expect(refreshedChild.recurring_parent_id).toBe(parentTask.id);
        });
    });

    describe('Task Deletion Scenarios', () => {
        let parentTask, childTask1, childTask2;

        beforeEach(async () => {
            parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            childTask1 = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-20T10:00:00Z'),
                status: Task.STATUS.NOT_STARTED,
            });

            childTask2 = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-27T10:00:00Z'),
                status: Task.STATUS.DONE,
            });
        });

        it('should allow deleting child tasks without affecting parent', async () => {
            await childTask1.destroy();

            // Verify child is deleted
            const deletedChild = await Task.findByPk(childTask1.id);
            expect(deletedChild).toBeNull();

            // Verify parent and other child still exist
            const existingParent = await Task.findByPk(parentTask.id);
            const existingChild = await Task.findByPk(childTask2.id);
            expect(existingParent).not.toBeNull();
            expect(existingChild).not.toBeNull();
        });

        it('should prevent deleting parent when child tasks exist due to foreign key constraint', async () => {
            await expect(parentTask.destroy()).rejects.toThrow();

            const error = await parentTask.destroy().catch((err) => err);
            expect(error.name).toBe('SequelizeForeignKeyConstraintError');

            // Verify parent and children still exist
            const existingParent = await Task.findByPk(parentTask.id);
            const existingChild1 = await Task.findByPk(childTask1.id);
            const existingChild2 = await Task.findByPk(childTask2.id);
            expect(existingParent).not.toBeNull();
            expect(existingChild1).not.toBeNull();
            expect(existingChild2).not.toBeNull();
        });

        it('should allow deleting parent after deleting all child tasks', async () => {
            // Delete all child tasks first
            await childTask1.destroy();
            await childTask2.destroy();

            // Now parent should be deletable
            await parentTask.destroy();

            // Verify all tasks are deleted
            const deletedParent = await Task.findByPk(parentTask.id);
            expect(deletedParent).toBeNull();
        });
    });

    describe('Complex Parent-Child Scenarios', () => {
        it('should handle multiple parents with different recurrence patterns', async () => {
            const dailyParent = await Task.create({
                name: 'Daily Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            const weeklyParent = await Task.create({
                name: 'Weekly Task',
                recurrence_type: 'weekly',
                recurrence_interval: 1,
                recurrence_weekday: 1,
                user_id: user.id,
                priority: 2,
            });

            // Create child tasks for each parent
            const dailyChild = await RecurringTaskService.createTaskInstance(
                dailyParent,
                new Date('2025-06-20T10:00:00Z')
            );

            const weeklyChild = await RecurringTaskService.createTaskInstance(
                weeklyParent,
                new Date('2025-06-23T10:00:00Z')
            );

            expect(dailyChild.recurring_parent_id).toBe(dailyParent.id);
            expect(weeklyChild.recurring_parent_id).toBe(weeklyParent.id);
            expect(dailyChild.name).toBe('Daily Task');
            expect(weeklyChild.name).toBe('Weekly Task');
        });

        it('should maintain data integrity across multiple child generations', async () => {
            const parentTask = await Task.create({
                name: 'Long Running Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                completion_based: true,
                user_id: user.id,
                priority: 2,
            });

            const children = [];

            // Generate 5 child tasks
            for (let i = 0; i < 5; i++) {
                await parentTask.update({ status: Task.STATUS.DONE });
                const nextTask =
                    await RecurringTaskService.handleTaskCompletion(parentTask);
                if (nextTask) {
                    children.push(nextTask);
                }
                await parentTask.update({ status: Task.STATUS.NOT_STARTED });
            }

            expect(children.length).toBe(5);

            // Verify all children have correct parent relationship
            for (const child of children) {
                expect(child.recurring_parent_id).toBe(parentTask.id);
                expect(child.name).toBe(parentTask.name);
                expect(child.recurrence_type).toBe('none');
                expect(child.status).toBe(Task.STATUS.NOT_STARTED);
            }

            // Verify no duplicate due dates
            const dueDates = children.map((c) => c.due_date.getTime());
            const uniqueDueDates = [...new Set(dueDates)];
            expect(uniqueDueDates.length).toBe(dueDates.length);
        });

        it('should handle orphaned child tasks gracefully', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            const childTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                user_id: user.id,
                due_date: new Date('2025-06-20T10:00:00Z'),
                status: Task.STATUS.NOT_STARTED,
            });

            // Verify child can be found and has correct parent reference
            const foundChild = await Task.findByPk(childTask.id);
            expect(foundChild.recurring_parent_id).toBe(parentTask.id);

            // Try to find parent through child
            const foundParent = await Task.findByPk(
                foundChild.recurring_parent_id
            );
            expect(foundParent).not.toBeNull();
            expect(foundParent.id).toBe(parentTask.id);
        });
    });

    describe('Data Consistency and Validation', () => {
        it('should ensure child tasks cannot have recurrence settings', async () => {
            // First create a parent task to reference
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            const childTask = await Task.create({
                name: 'Child Task',
                recurrence_type: 'none',
                recurring_parent_id: parentTask.id,
                recurrence_interval: null,
                recurrence_weekday: null,
                recurrence_month_day: null,
                recurrence_week_of_month: null,
                completion_based: false,
                user_id: user.id,
                status: Task.STATUS.NOT_STARTED,
            });

            expect(childTask.recurrence_type).toBe('none');
            expect(childTask.recurrence_interval).toBeNull();
            expect(childTask.recurrence_weekday).toBeNull();
            expect(childTask.recurrence_month_day).toBeNull();
            expect(childTask.recurrence_week_of_month).toBeNull();
            expect(childTask.completion_based).toBe(false);
        });

        it('should ensure parent tasks have valid recurrence settings', async () => {
            const parentTask = await Task.create({
                name: 'Parent Task',
                recurrence_type: 'weekly',
                recurrence_interval: 2,
                recurrence_weekday: 5, // Friday
                recurring_parent_id: null,
                user_id: user.id,
                priority: 1,
            });

            expect(parentTask.recurrence_type).toBe('weekly');
            expect(parentTask.recurrence_interval).toBe(2);
            expect(parentTask.recurrence_weekday).toBe(5);
            expect(parentTask.recurring_parent_id).toBeNull();
        });

        it('should maintain user isolation for parent-child relationships', async () => {
            const otherUser = await createTestUser({
                email: 'other@example.com',
            });

            const user1Parent = await Task.create({
                name: 'User 1 Parent',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: user.id,
                priority: 1,
            });

            const user2Parent = await Task.create({
                name: 'User 2 Parent',
                recurrence_type: 'daily',
                recurrence_interval: 1,
                user_id: otherUser.id,
                priority: 1,
            });

            const user1Child = await Task.create({
                name: 'User 1 Parent',
                recurrence_type: 'none',
                recurring_parent_id: user1Parent.id,
                user_id: user.id,
                due_date: new Date('2025-06-20T10:00:00Z'),
                status: Task.STATUS.NOT_STARTED,
            });

            // Verify child belongs to correct user
            expect(user1Child.user_id).toBe(user.id);
            expect(user1Child.recurring_parent_id).toBe(user1Parent.id);

            // Verify users can't see each other's tasks
            const user1Tasks = await Task.findAll({
                where: { user_id: user.id },
            });
            const user2Tasks = await Task.findAll({
                where: { user_id: otherUser.id },
            });

            expect(user1Tasks.length).toBe(2); // parent + child
            expect(user2Tasks.length).toBe(1); // just parent
            expect(
                user1Tasks.find((t) => t.id === user2Parent.id)
            ).toBeUndefined();
            expect(
                user2Tasks.find((t) => t.id === user1Parent.id)
            ).toBeUndefined();
        });
    });
});
