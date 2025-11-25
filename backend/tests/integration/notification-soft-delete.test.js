const request = require('supertest');
const app = require('../../app');
const { User, Notification, Task } = require('../../models');
const { createTestUser } = require('../helpers/testUtils');

describe('Notification Soft Delete', () => {
    let user, agent, task;

    beforeEach(async () => {
        user = await createTestUser({
            email: `test_${Date.now()}@example.com`,
        });

        // Create authenticated agent
        agent = request.agent(app);
        await agent.post('/api/login').send({
            email: user.email,
            password: 'password123',
        });

        // Create a test task directly in database
        task = await Task.create({
            name: 'Test Task',
            user_id: user.id,
            status: 0,
        });
    });

    describe('DELETE /api/notifications/:id - Soft Delete', () => {
        it('should soft delete (dismiss) a notification', async () => {
            // Create a notification
            const notification = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Test Notification',
                message: 'This is a test',
                sources: [],
                data: { taskUid: task.uid },
            });

            // Delete (dismiss) the notification
            const deleteResponse = await agent.delete(
                `/api/notifications/${notification.id}`
            );

            expect(deleteResponse.status).toBe(200);
            expect(deleteResponse.body.message).toBe(
                'Notification dismissed successfully'
            );

            // Verify the notification still exists in database but is dismissed
            const dismissedNotification = await Notification.findByPk(
                notification.id
            );
            expect(dismissedNotification).not.toBeNull();
            expect(dismissedNotification.dismissed_at).not.toBeNull();
            expect(dismissedNotification.isDismissed()).toBe(true);
        });

        it('should not allow dismissing an already dismissed notification', async () => {
            // Create and dismiss a notification
            const notification = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Test Notification',
                message: 'This is a test',
                sources: [],
                data: { taskUid: task.uid },
            });

            await notification.dismiss();

            // Try to dismiss again
            const deleteResponse = await agent.delete(
                `/api/notifications/${notification.id}`
            );

            expect(deleteResponse.status).toBe(404);
            expect(deleteResponse.body.error).toBe('Notification not found');
        });

        it('should hide dismissed notifications from GET /api/notifications', async () => {
            // Create two notifications
            const notification1 = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Notification 1',
                message: 'This is test 1',
                sources: [],
            });

            const notification2 = await Notification.createNotification({
                userId: user.id,
                type: 'task_overdue',
                title: 'Notification 2',
                message: 'This is test 2',
                sources: [],
            });

            // Dismiss the first notification
            await agent.delete(`/api/notifications/${notification1.id}`);

            // Get notifications
            const getResponse = await agent.get('/api/notifications');

            expect(getResponse.status).toBe(200);
            expect(getResponse.body.total).toBe(1);
            expect(getResponse.body.notifications.length).toBe(1);
            expect(getResponse.body.notifications[0].id).toBe(notification2.id);
        });

        it('should exclude dismissed notifications from unread count', async () => {
            // Create two unread notifications
            const notification1 = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Notification 1',
                message: 'This is test 1',
                sources: [],
            });

            await Notification.createNotification({
                userId: user.id,
                type: 'task_overdue',
                title: 'Notification 2',
                message: 'This is test 2',
                sources: [],
            });

            // Check unread count (should be 2)
            let countResponse = await agent.get(
                '/api/notifications/unread-count'
            );
            expect(countResponse.body.count).toBe(2);

            // Dismiss one notification
            await agent.delete(`/api/notifications/${notification1.id}`);

            // Check unread count again (should be 1)
            countResponse = await agent.get('/api/notifications/unread-count');
            expect(countResponse.body.count).toBe(1);
        });

        it('should not recreate dismissed notifications in cron jobs', async () => {
            // Update task with due date in the past
            const dueDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
            await task.update({
                due_date: dueDate,
            });

            // Run the due task service
            const { checkDueTasks } = require('../../services/dueTaskService');
            let result = await checkDueTasks();

            // Should create 1 notification
            expect(result.notificationsCreated).toBe(1);

            // Get the notification
            const notifications = await Notification.findAll({
                where: { user_id: user.id },
            });
            expect(notifications.length).toBe(1);

            const notification = notifications[0];

            // Dismiss the notification
            await notification.dismiss();

            // Run the service again
            result = await checkDueTasks();

            // Should not create a new notification (dismissed one should be skipped)
            expect(result.notificationsCreated).toBe(0);

            // Verify only one notification exists (the dismissed one)
            const allNotifications = await Notification.findAll({
                where: { user_id: user.id },
            });
            expect(allNotifications.length).toBe(1);
            expect(allNotifications[0].isDismissed()).toBe(true);
        });
    });

    describe('Notification model - isDismissed and dismiss methods', () => {
        it('should correctly identify dismissed notifications', async () => {
            const notification = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Test',
                message: 'Test',
                sources: [],
            });

            // Reload from database to get actual values
            await notification.reload();

            expect(notification.dismissed_at).toBeNull();
            expect(notification.isDismissed()).toBe(false);

            await notification.dismiss();

            expect(notification.isDismissed()).toBe(true);
            expect(notification.dismissed_at).not.toBeNull();
        });

        it('should not change dismissed_at if already dismissed', async () => {
            const notification = await Notification.createNotification({
                userId: user.id,
                type: 'task_due_soon',
                title: 'Test',
                message: 'Test',
                sources: [],
            });

            await notification.dismiss();
            const firstDismissedAt = notification.dismissed_at;

            // Wait a bit
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Try to dismiss again
            await notification.dismiss();

            // dismissed_at should be the same
            expect(notification.dismissed_at.getTime()).toBe(
                firstDismissedAt.getTime()
            );
        });
    });
});
