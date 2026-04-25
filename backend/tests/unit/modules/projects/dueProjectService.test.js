const { Project, Notification, User } = require('../../../../models');
const {
    checkDueProjects,
} = require('../../../../modules/projects/dueProjectService');
const telegramNotificationService = require('../../../../modules/telegram/telegramNotificationService');
const bcrypt = require('bcrypt');

describe('dueProjectService', () => {
    let user;

    beforeEach(async () => {
        user = await User.create({
            email: 'project@example.com',
            password_digest: await bcrypt.hash('password123', 10),
            telegram_bot_token: '123456789:ABCdefGHIjklMNOPQRSTUVwxyz-12345678',
            telegram_chat_id: '123456789',
            notification_preferences: {
                dueProjects: { inApp: false, telegram: true },
                overdueProjects: { inApp: false, telegram: true },
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
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        await Project.create({
            name: 'Telegram Project',
            user_id: user.id,
            due_date_at: tomorrow,
            status: 'not_started',
        });

        const result = await checkDueProjects();

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

    it('should not resend Telegram within the 2-day deduplication window', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        await Project.create({
            name: 'Telegram Rate Limit Project',
            user_id: user.id,
            due_date_at: tomorrow,
            status: 'not_started',
        });

        // First run: Telegram sent, dismissed tracking record created
        await checkDueProjects();

        const sendTelegramSpy = jest.spyOn(
            telegramNotificationService,
            'sendTelegramNotification'
        );
        sendTelegramSpy.mockClear();

        // Second run within 2-day window: dismissed record found, skip
        await checkDueProjects();

        expect(sendTelegramSpy).not.toHaveBeenCalled();

        const allNotifications = await Notification.findAll({
            where: { user_id: user.id },
        });
        expect(allNotifications.length).toBe(1);
    });
});
