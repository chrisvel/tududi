const { Task, Notification, User } = require('../../../../models');
const { checkDueTasks } = require('../../../../modules/tasks/dueTaskService');
const bcrypt = require('bcrypt');

describe('dueTaskService', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
            notification_preferences: {
                inApp: {
                    task_due_soon: true,
                    task_overdue: true,
                },
            },
        });
    });

    describe('checkDueTasks', () => {
        describe('notification deduplication', () => {
            it('should delete existing unread notification before creating a new one', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                const task = await Task.create({
                    name: 'Test Task',
                    user_id: user.id,
                    due_date: tomorrow,
                    status: Task.STATUS.NOT_STARTED,
                });

                // Create initial notification
                const firstNotification = await Notification.createNotification(
                    {
                        userId: user.id,
                        type: 'task_due_soon',
                        title: 'Task due soon',
                        message: 'Your task "Test Task" is due tomorrow',
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            dueDate: task.due_date,
                            isOverdue: false,
                        },
                    }
                );

                expect(firstNotification.read_at).toBeFalsy();

                // Run the check again (simulating the next day's cron job)
                await checkDueTasks();

                // First notification should be deleted
                const deletedNotification = await Notification.findByPk(
                    firstNotification.id
                );
                expect(deletedNotification).toBeNull();

                // New notification should exist
                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                        type: 'task_due_soon',
                    },
                });

                expect(notifications.length).toBe(1);
                expect(notifications[0].id).not.toBe(firstNotification.id);
                expect(notifications[0].data.taskUid).toBe(task.uid);
            });

            it('should not create duplicate if previous notification was read', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                const task = await Task.create({
                    name: 'Test Task',
                    user_id: user.id,
                    due_date: tomorrow,
                    status: Task.STATUS.NOT_STARTED,
                });

                // Create and mark as read
                const firstNotification = await Notification.createNotification(
                    {
                        userId: user.id,
                        type: 'task_due_soon',
                        title: 'Task due soon',
                        message: 'Your task "Test Task" is due tomorrow',
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            dueDate: task.due_date,
                            isOverdue: false,
                        },
                    }
                );

                await firstNotification.markAsRead();

                // Run the check again
                const result = await checkDueTasks();

                // Should not create a new notification
                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                        type: 'task_due_soon',
                    },
                });

                expect(notifications.length).toBe(1);
                expect(notifications[0].id).toBe(firstNotification.id);
                expect(result.notificationsCreated).toBe(0);
            });

            it('should not create duplicate if previous notification was dismissed', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                const task = await Task.create({
                    name: 'Test Task',
                    user_id: user.id,
                    due_date: tomorrow,
                    status: Task.STATUS.NOT_STARTED,
                });

                // Create and dismiss
                const firstNotification = await Notification.createNotification(
                    {
                        userId: user.id,
                        type: 'task_due_soon',
                        title: 'Task due soon',
                        message: 'Your task "Test Task" is due tomorrow',
                        data: {
                            taskUid: task.uid,
                            taskName: task.name,
                            dueDate: task.due_date,
                            isOverdue: false,
                        },
                    }
                );

                await firstNotification.dismiss();

                // Run the check again
                const result = await checkDueTasks();

                // Should not create a new notification
                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                        type: 'task_due_soon',
                    },
                });

                expect(notifications.length).toBe(1);
                expect(notifications[0].id).toBe(firstNotification.id);
                expect(result.notificationsCreated).toBe(0);
            });

            it('should handle transition from task_due_soon to task_overdue', async () => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                const task = await Task.create({
                    name: 'Test Task',
                    user_id: user.id,
                    due_date: yesterday,
                    status: Task.STATUS.NOT_STARTED,
                });

                // Create task_due_soon notification (from when it was due tomorrow)
                await Notification.createNotification({
                    userId: user.id,
                    type: 'task_due_soon',
                    title: 'Task due soon',
                    message: 'Your task "Test Task" is due tomorrow',
                    data: {
                        taskUid: task.uid,
                        taskName: task.name,
                        dueDate: task.due_date,
                        isOverdue: false,
                    },
                });

                // Run the check (task is now overdue)
                await checkDueTasks();

                // Should create task_overdue notification
                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                    },
                    order: [['created_at', 'DESC']],
                });

                // Both notifications should exist (different types)
                expect(notifications.length).toBe(2);
                expect(notifications[0].type).toBe('task_overdue');
                expect(notifications[1].type).toBe('task_due_soon');
            });

            it('should only keep one notification for the same overdue task over multiple days', async () => {
                const threeDaysAgo = new Date();
                threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

                const task = await Task.create({
                    name: 'Test Task',
                    user_id: user.id,
                    due_date: threeDaysAgo,
                    status: Task.STATUS.NOT_STARTED,
                });

                // Simulate 3 days of cron jobs
                for (let i = 0; i < 3; i++) {
                    await checkDueTasks();
                }

                // Should only have 1 notification
                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                        type: 'task_overdue',
                    },
                });

                expect(notifications.length).toBe(1);
                expect(notifications[0].data.taskUid).toBe(task.uid);
            });
        });

        describe('basic functionality', () => {
            it('should create notification for task due tomorrow', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                await Task.create({
                    name: 'Test Task',
                    user_id: user.id,
                    due_date: tomorrow,
                    status: Task.STATUS.NOT_STARTED,
                });

                const result = await checkDueTasks();

                expect(result.success).toBe(true);
                expect(result.notificationsCreated).toBe(1);

                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                        type: 'task_due_soon',
                    },
                });

                expect(notifications.length).toBe(1);
            });

            it('should create notification for overdue task', async () => {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                await Task.create({
                    name: 'Overdue Task',
                    user_id: user.id,
                    due_date: yesterday,
                    status: Task.STATUS.NOT_STARTED,
                });

                const result = await checkDueTasks();

                expect(result.success).toBe(true);
                expect(result.notificationsCreated).toBe(1);

                const notifications = await Notification.findAll({
                    where: {
                        user_id: user.id,
                        type: 'task_overdue',
                    },
                });

                expect(notifications.length).toBe(1);
            });

            it('should not create notification for completed tasks', async () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);

                await Task.create({
                    name: 'Completed Task',
                    user_id: user.id,
                    due_date: tomorrow,
                    status: Task.STATUS.DONE,
                });

                const result = await checkDueTasks();

                expect(result.notificationsCreated).toBe(0);
            });
        });
    });
});