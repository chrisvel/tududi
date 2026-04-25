const { Task, Notification, User } = require('../../../../models');
const {
    checkDeferredTasks,
} = require('../../../../modules/tasks/deferredTaskService');
const telegramNotificationService = require('../../../../modules/telegram/telegramNotificationService');
const bcrypt = require('bcrypt');

describe('deferredTaskService', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            email: 'deferred@example.com',
            password_digest: await bcrypt.hash('password123', 10),
            telegram_bot_token: '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-12345678',
            telegram_chat_id: '123456789',
            notification_preferences: {
                deferUntil: { inApp: false, telegram: true },
            },
        });

        jest.spyOn(
            telegramNotificationService,
            'isTelegramConfigured'
        ).mockReturnValue(true);
        jest.spyOn(
            telegramNotificationService,
            'sendTelegramNotification'
        ).mockResolvedValue({ success: true });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should send Telegram and create a dismissed tracking record when inApp is disabled', async () => {
        const now = new Date();

        await Task.create({
            name: 'Deferred Telegram Only',
            user_id: user.id,
            defer_until: now,
            status: Task.STATUS.NOT_STARTED,
        });

        const result = await checkDeferredTasks();

        expect(result.success).toBe(true);
        expect(result.notificationsCreated).toBe(1);
        expect(
            telegramNotificationService.sendTelegramNotification
        ).toHaveBeenCalledTimes(1);

        // A dismissed tracking record is created for deduplication/rate-limiting.
        // It must not appear as unread (badge must not increment).
        const allNotifications = await Notification.findAll({
            where: { user_id: user.id },
        });
        expect(allNotifications.length).toBe(1);
        expect(allNotifications[0].dismissed_at).not.toBeNull();

        const unreadCount = await Notification.count({
            where: { user_id: user.id, read_at: null, dismissed_at: null },
        });
        expect(unreadCount).toBe(0);
    });

    it('should not resend Telegram within the 24-hour deduplication window', async () => {
        const now = new Date();

        await Task.create({
            name: 'Deferred Telegram Rate Limit',
            user_id: user.id,
            defer_until: now,
            status: Task.STATUS.NOT_STARTED,
        });

        // First run: Telegram sent, tracking record created and dismissed
        await checkDeferredTasks();

        const sendTelegramSpy = jest.spyOn(
            telegramNotificationService,
            'sendTelegramNotification'
        );
        sendTelegramSpy.mockClear();

        // Second run within the same day: dismissed record found, skip
        await checkDeferredTasks();

        expect(sendTelegramSpy).not.toHaveBeenCalled();

        const allNotifications = await Notification.findAll({
            where: { user_id: user.id },
        });
        expect(allNotifications.length).toBe(1);
    });
});
