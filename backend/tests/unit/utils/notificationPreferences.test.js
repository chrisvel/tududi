const {
    shouldSendInAppNotification,
    getDefaultNotificationPreferences,
    NOTIFICATION_TYPE_MAPPING,
} = require('../../../utils/notificationPreferences');

describe('notificationPreferences utils', () => {
    describe('getDefaultNotificationPreferences', () => {
        it('should return default preferences with all in-app enabled', () => {
            const defaults = getDefaultNotificationPreferences();

            expect(defaults).toEqual({
                dueTasks: { inApp: true, email: false, push: false },
                overdueTasks: { inApp: true, email: false, push: false },
                dueProjects: { inApp: true, email: false, push: false },
                overdueProjects: { inApp: true, email: false, push: false },
                deferUntil: { inApp: true, email: false, push: false },
            });
        });

        it('should return a new object each time', () => {
            const defaults1 = getDefaultNotificationPreferences();
            const defaults2 = getDefaultNotificationPreferences();

            expect(defaults1).not.toBe(defaults2);
            expect(defaults1).toEqual(defaults2);
        });
    });

    describe('shouldSendInAppNotification', () => {
        it('should return true when user has no preferences set', () => {
            const user = { notification_preferences: null };

            expect(shouldSendInAppNotification(user, 'task_due_soon')).toBe(
                true
            );
            expect(shouldSendInAppNotification(user, 'task_overdue')).toBe(
                true
            );
            expect(shouldSendInAppNotification(user, 'project_due_soon')).toBe(
                true
            );
            expect(shouldSendInAppNotification(user, 'project_overdue')).toBe(
                true
            );
        });

        it('should return true when user object is null', () => {
            expect(shouldSendInAppNotification(null, 'task_due_soon')).toBe(
                true
            );
        });

        it('should return true when notification type is enabled', () => {
            const user = {
                notification_preferences: {
                    dueTasks: { inApp: true, email: false, push: false },
                    overdueTasks: { inApp: true, email: false, push: false },
                },
            };

            expect(shouldSendInAppNotification(user, 'task_due_soon')).toBe(
                true
            );
            expect(shouldSendInAppNotification(user, 'task_overdue')).toBe(
                true
            );
        });

        it('should return false when notification type is disabled', () => {
            const user = {
                notification_preferences: {
                    dueTasks: { inApp: false, email: false, push: false },
                    overdueTasks: { inApp: false, email: false, push: false },
                },
            };

            expect(shouldSendInAppNotification(user, 'task_due_soon')).toBe(
                false
            );
            expect(shouldSendInAppNotification(user, 'task_overdue')).toBe(
                false
            );
        });

        it('should map backend notification types correctly', () => {
            const user = {
                notification_preferences: {
                    dueTasks: { inApp: false, email: false, push: false },
                    overdueTasks: { inApp: true, email: false, push: false },
                    dueProjects: { inApp: false, email: false, push: false },
                    overdueProjects: { inApp: true, email: false, push: false },
                },
            };

            // task_due_soon maps to dueTasks (disabled)
            expect(shouldSendInAppNotification(user, 'task_due_soon')).toBe(
                false
            );

            // task_overdue maps to overdueTasks (enabled)
            expect(shouldSendInAppNotification(user, 'task_overdue')).toBe(
                true
            );

            // project_due_soon maps to dueProjects (disabled)
            expect(shouldSendInAppNotification(user, 'project_due_soon')).toBe(
                false
            );

            // project_overdue maps to overdueProjects (enabled)
            expect(shouldSendInAppNotification(user, 'project_overdue')).toBe(
                true
            );
        });

        it('should handle deferUntil type directly', () => {
            const user = {
                notification_preferences: {
                    deferUntil: { inApp: false, email: false, push: false },
                },
            };

            expect(shouldSendInAppNotification(user, 'deferUntil')).toBe(false);
        });

        it('should default to true for unknown notification types', () => {
            const user = {
                notification_preferences: {
                    dueTasks: { inApp: true, email: false, push: false },
                },
            };

            // Unknown type should default to enabled
            expect(shouldSendInAppNotification(user, 'unknown_type')).toBe(
                true
            );
        });

        it('should handle partial preferences object', () => {
            const user = {
                notification_preferences: {
                    dueTasks: { inApp: false, email: false, push: false },
                    // overdueTasks not defined
                },
            };

            // Defined type should respect setting
            expect(shouldSendInAppNotification(user, 'task_due_soon')).toBe(
                false
            );

            // Undefined type should default to enabled
            expect(shouldSendInAppNotification(user, 'task_overdue')).toBe(
                true
            );
        });

        it('should handle missing inApp property', () => {
            const user = {
                notification_preferences: {
                    dueTasks: { email: false, push: false },
                },
            };

            // Missing inApp should default to true
            expect(shouldSendInAppNotification(user, 'task_due_soon')).toBe(
                true
            );
        });
    });

    describe('NOTIFICATION_TYPE_MAPPING', () => {
        it('should have correct mappings', () => {
            expect(NOTIFICATION_TYPE_MAPPING).toEqual({
                task_due_soon: 'dueTasks',
                task_overdue: 'overdueTasks',
                project_due_soon: 'dueProjects',
                project_overdue: 'overdueProjects',
            });
        });
    });
});
