/**
 * Utility functions for checking user notification preferences
 */

const DEFAULT_PREFERENCES = {
    dueTasks: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
        webhook: false,
    },
    overdueTasks: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
        webhook: false,
    },
    dueProjects: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
        webhook: false,
    },
    overdueProjects: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
        webhook: false,
    },
    deferUntil: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
        webhook: false,
    },
    taskAssigned: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
        webhook: false,
    },
};

/**
 * Mapping from backend notification types to preference keys
 */
const NOTIFICATION_TYPE_MAPPING = {
    task_due_soon: 'dueTasks',
    task_overdue: 'overdueTasks',
    project_due_soon: 'dueProjects',
    project_overdue: 'overdueProjects',
    task_assigned: 'taskAssigned',
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
 * Check if user has enabled Telegram notifications for a specific type
 * @param {Object} user - User model instance with notification_preferences field
 * @param {string} notificationType - Backend notification type (e.g., 'task_due_soon', 'task_overdue')
 * @returns {boolean} - True if Telegram notifications are enabled for this type
 */
function shouldSendTelegramNotification(user, notificationType) {
    // If no user or no preferences set, default to disabled for Telegram
    if (!user || !user.notification_preferences) {
        return false;
    }

    const prefs = user.notification_preferences;

    // Map notification type to preference key
    const prefKey =
        NOTIFICATION_TYPE_MAPPING[notificationType] || notificationType;

    // If notification type not configured, default to disabled
    if (!prefs[prefKey]) {
        return false;
    }

    // Check if telegram channel is enabled (default to false if not set)
    return prefs[prefKey].telegram === true;
}

/**
 * Check if user has enabled Webhook notifications for a specific type
 * @param {Object} user - User model instance with notification_preferences field
 * @param {string} notificationType - Backend notification type (e.g., 'task_due_soon', 'task_overdue')
 * @returns {boolean} - True if Webhook notifications are enabled for this type
 */
function shouldSendWebhookNotification(user, notificationType) {
    // If no user or no preferences set, default to disabled for Webhooks
    if (!user || !user.notification_preferences) {
        return false;
    }

    const prefs = user.notification_preferences;

    // Map notification type to preference key
    const prefKey =
        NOTIFICATION_TYPE_MAPPING[notificationType] || notificationType;

    // If notification type not configured, default to disabled
    if (!prefs[prefKey]) {
        return false;
    }

    // Check if webhook channel is enabled (default to false if not set)
    return prefs[prefKey].webhook === true;
}

/**
 * Build the `sources` array for Notification.createNotification from a
 * user's channel preferences, so call sites don't each re-implement the
 * same "check preference, push channel name" duplication.
 * @param {Object} user - User model instance with notification_preferences field
 * @param {string} notificationType - Backend notification type
 * @param {Object} [options]
 * @param {boolean} [options.telegram] - Whether to evaluate the telegram channel too (callers that dispatch Telegram separately, e.g. as a batched digest, leave this false)
 * @returns {string[]} - e.g. ['telegram', 'webhook']
 */
function resolveNotificationSources(
    user,
    notificationType,
    { telegram = false } = {}
) {
    const sources = [];
    if (telegram && shouldSendTelegramNotification(user, notificationType)) {
        sources.push('telegram');
    }
    if (shouldSendWebhookNotification(user, notificationType)) {
        sources.push('webhook');
    }
    return sources;
}

/**
 * Get default notification preferences
 * @returns {Object} - Default preferences object
 */
function getDefaultNotificationPreferences() {
    return { ...DEFAULT_PREFERENCES };
}

/**
 * Ensure notification preferences are properly initialized
 * Returns default preferences if input is null/undefined, otherwise merges with defaults
 * @param {Object|null|undefined} preferences - Existing notification preferences
 * @returns {Object} - Valid notification preferences object with all required keys
 */
function ensureNotificationPreferences(preferences) {
    if (!preferences || typeof preferences !== 'object') {
        return getDefaultNotificationPreferences();
    }

    // Merge with defaults to ensure all keys exist
    const result = {};
    const defaults = getDefaultNotificationPreferences();

    for (const key of Object.keys(defaults)) {
        if (preferences[key] && typeof preferences[key] === 'object') {
            // Preserve existing preferences but ensure all channels exist
            result[key] = {
                inApp:
                    preferences[key].inApp !== undefined
                        ? preferences[key].inApp
                        : defaults[key].inApp,
                email:
                    preferences[key].email !== undefined
                        ? preferences[key].email
                        : defaults[key].email,
                push:
                    preferences[key].push !== undefined
                        ? preferences[key].push
                        : defaults[key].push,
                telegram:
                    preferences[key].telegram !== undefined
                        ? preferences[key].telegram
                        : defaults[key].telegram,
                webhook:
                    preferences[key].webhook !== undefined
                        ? preferences[key].webhook
                        : defaults[key].webhook,
            };
        } else {
            // Missing preference type, use default
            result[key] = { ...defaults[key] };
        }
    }

    return result;
}

module.exports = {
    shouldSendInAppNotification,
    shouldSendTelegramNotification,
    shouldSendWebhookNotification,
    resolveNotificationSources,
    getDefaultNotificationPreferences,
    ensureNotificationPreferences,
    NOTIFICATION_TYPE_MAPPING,
};
