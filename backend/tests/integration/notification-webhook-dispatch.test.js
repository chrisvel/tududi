const bcrypt = require('bcrypt');
const { Notification, User } = require('../../models');
const webhookNotificationService = require('../../modules/webhooks/webhookNotificationService');

// Mock the webhook notification service, mirroring how
// notification-telegram-rate-limit.test.js mocks the Telegram equivalent.
jest.mock('../../modules/webhooks/webhookNotificationService');

describe('Notification webhook dispatch', () => {
    let user;
    let dispatchSpy;

    beforeEach(async () => {
        user = await User.create({
            email: 'test@example.com',
            password_digest: await bcrypt.hash('password123', 10),
        });

        dispatchSpy = jest
            .spyOn(webhookNotificationService, 'dispatchForNotification')
            .mockResolvedValue();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('dispatches to webhooks when sources includes webhook', async () => {
        const notification = await Notification.createNotification({
            userId: user.id,
            type: 'task_due_soon',
            title: 'Task Due Soon',
            message: 'Your task is due tomorrow',
            sources: ['webhook'],
            level: 'info',
        });

        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy).toHaveBeenCalledWith(
            user.id,
            expect.objectContaining({
                type: 'task_due_soon',
                title: 'Task Due Soon',
                message: 'Your task is due tomorrow',
            })
        );
        expect(notification.sources).toContain('webhook');
    });

    it('does not dispatch when sources omits webhook', async () => {
        await Notification.createNotification({
            userId: user.id,
            type: 'task_due_soon',
            title: 'Task Due Soon',
            message: 'Your task is due tomorrow',
            sources: [],
            level: 'info',
        });

        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('never throws back into createNotification when dispatch fails', async () => {
        dispatchSpy.mockRejectedValueOnce(new Error('boom'));

        await expect(
            Notification.createNotification({
                userId: user.id,
                type: 'task_overdue',
                title: 'Task Overdue',
                message: 'Your task is overdue',
                sources: ['webhook'],
                level: 'error',
            })
        ).resolves.toBeDefined();
    });
});
