/**
 * Utility functions for checking user notification preferences
 */

const DEFAULT_PREFERENCES = {
    dueTasks: { inApp: true, email: false, push: false },
    overdueTasks: { inApp: true, email: false, push: false },
    dueProjects: { inApp: true, email: false, push: false },
    overdueProjects: { inApp: true, email: false, push: false },
    deferUntil: { inApp: true, email: false, push: false },
};

/**
 * Mapping from backend notification types to preference keys
 */
const NOTIFICATION_TYPE_MAPPING = {
    task_due_soon: 'dueTasks',
    task_overdue: 'overdueTasks',
    project_due_soon: 'dueProjects',
    project_overdue: 'overdueProjects',
};

/**
 * Check if user has enabled in-app notifications for a specific type
 * @param {Object} user - User model instance with notification_preferences field
 * @param {string} notificationType - Backend notification type (e.g., 'task_due_soon', 'task_overdue')
 * @returns {boolean} - True if in-app notifications are enabled for this type
 */
function shouldSendInAppNotification(user, notificationType) {
    // If no user or no preferences set, default to enabled
    if (!user || !user.notification_preferences) {
        return true;
    }

    const prefs = user.notification_preferences;

    // Map notification type to preference key
    const prefKey =
        NOTIFICATION_TYPE_MAPPING[notificationType] || notificationType;

    // If notification type not configured, default to enabled
    if (!prefs[prefKey]) {
        return true;
    }

    // Check if in-app channel is enabled (default to true if not set)
    return prefs[prefKey].inApp !== false;
}

/**
 * Get default notification preferences
 * @returns {Object} - Default preferences object
 */
function getDefaultNotificationPreferences() {
    return { ...DEFAULT_PREFERENCES };
}

module.exports = {
    shouldSendInAppNotification,
    getDefaultNotificationPreferences,
    NOTIFICATION_TYPE_MAPPING,
};
