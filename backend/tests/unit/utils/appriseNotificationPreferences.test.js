const {
    shouldSendAppriseNotification,
    reminderSources,
    deliverySources,
    ensureNotificationPreferences,
} = require('../../../utils/notificationPreferences');

describe('Apprise notification preferences', () => {
    const userWith = (prefs) => ({ notification_preferences: prefs });

    it('is off by default and when the type is missing', () => {
        expect(shouldSendAppriseNotification(null, 'task_due_soon')).toBe(
            false
        );
        expect(
            shouldSendAppriseNotification(
                userWith({ dueTasks: { inApp: true } }),
                'task_due_soon'
            )
        ).toBe(false);
    });

    it('follows the per-type apprise flag', () => {
        const user = userWith({ dueTasks: { inApp: true, apprise: true } });
        expect(shouldSendAppriseNotification(user, 'task_due_soon')).toBe(true);
        expect(shouldSendAppriseNotification(user, 'task_overdue')).toBe(false);
    });

    it('adds apprise next to push for reminders', () => {
        const user = userWith({
            dueTasks: { push: true, apprise: true },
        });
        expect(reminderSources(user, 'dueTasks')).toEqual(['push', 'apprise']);
    });

    it('adds apprise to comment and assignment delivery', () => {
        const user = userWith({
            comments: { apprise: true, telegram: false, push: false },
        });
        expect(deliverySources(user, 'comment_added')).toEqual(['apprise']);
    });

    it('fills in apprise when merging stored preferences with defaults', () => {
        const merged = ensureNotificationPreferences({
            dueTasks: {
                inApp: true,
                email: false,
                push: false,
                telegram: false,
            },
        });
        expect(merged.dueTasks.apprise).toBe(false);
        expect(merged.comments.apprise).toBe(false);
    });
});
