import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    BellIcon,
    BellAlertIcon,
    ExclamationTriangleIcon,
    FolderIcon,
    FolderOpenIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import type { NotificationPreferences } from '../types';

interface NotificationsTabProps {
    isActive: boolean;
    notificationPreferences: NotificationPreferences | null | undefined;
    onChange: (preferences: NotificationPreferences) => void;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
    dueTasks: { inApp: true, email: false, push: false, telegram: false },
    overdueTasks: { inApp: true, email: false, push: false, telegram: false },
    dueProjects: { inApp: true, email: false, push: false, telegram: false },
    overdueProjects: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
    },
    deferUntil: { inApp: true, email: false, push: false, telegram: false },
};

interface NotificationTypeRowProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    preferences: {
        inApp: boolean;
        email: boolean;
        push: boolean;
        telegram: boolean;
    };
    onToggle: (
        channel: 'inApp' | 'email' | 'push' | 'telegram',
        value: boolean
    ) => void;
    telegramConfigured: boolean;
}

const NotificationTypeRow: React.FC<NotificationTypeRowProps> = ({
    icon: Icon,
    label,
    description,
    preferences,
    onToggle,
    telegramConfigured,
}) => {
    const renderToggle = (
        channel: 'inApp' | 'email' | 'push' | 'telegram',
        isEnabled: boolean,
        isAvailable: boolean
    ) => (
        <button
            type="button"
            onClick={() => isAvailable && onToggle(channel, !isEnabled)}
            disabled={!isAvailable}
            className={`
                relative inline-flex h-5 w-9 items-center rounded-full
                transition-colors duration-200 ease-in-out
                ${isAvailable ? 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' : 'cursor-not-allowed opacity-50'}
                ${isEnabled && isAvailable ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
            aria-label={`Toggle ${channel} for ${label}`}
        >
            <span
                className={`
                    inline-block h-3 w-3 transform rounded-full
                    bg-white transition-transform duration-200 ease-in-out
                    ${isEnabled && isAvailable ? 'translate-x-5' : 'translate-x-1'}
                `}
            />
        </button>
    );

    return (
        <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
            <td className="py-4 px-4">
                <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                    <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {label}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {description}
                        </div>
                    </div>
                </div>
            </td>
            <td className="py-4 px-4 text-center">
                {renderToggle('inApp', preferences.inApp, true)}
            </td>
            <td className="py-4 px-4 text-center">
                {renderToggle('email', preferences.email, false)}
            </td>
            <td className="py-4 px-4 text-center">
                {renderToggle('push', preferences.push, false)}
            </td>
            <td className="py-4 px-4 text-center">
                {renderToggle(
                    'telegram',
                    preferences.telegram,
                    telegramConfigured
                )}
            </td>
        </tr>
    );
};

const NotificationsTab: React.FC<NotificationsTabProps> = ({
    isActive,
    notificationPreferences,
    onChange,
}) => {
    const { t } = useTranslation();
    const [profile, setProfile] = React.useState<any>(null);
    const [selectedTestType, setSelectedTestType] =
        React.useState<string>('task_due_soon');
    const [testLoading, setTestLoading] = React.useState<boolean>(false);
    const [testMessage, setTestMessage] = React.useState<string>('');

    // Fetch profile data to check telegram configuration
    React.useEffect(() => {
        if (isActive) {
            fetch('/api/profile')
                .then((res) => res.json())
                .then((data) => setProfile(data))
                .catch((err) => console.error('Failed to fetch profile', err));
        }
    }, [isActive]);

    if (!isActive) return null;

    // Merge with defaults to ensure all types exist
    const preferences: NotificationPreferences = {
        ...DEFAULT_PREFERENCES,
        ...notificationPreferences,
    };

    // Check if Telegram is configured
    const telegramConfigured = !!(
        profile?.telegram_bot_token && profile?.telegram_chat_id
    );

    const handleToggle = (
        notificationType: keyof NotificationPreferences,
        channel: 'inApp' | 'email' | 'push' | 'telegram',
        value: boolean
    ) => {
        const updatedPreferences = {
            ...preferences,
            [notificationType]: {
                ...preferences[notificationType],
                [channel]: value,
            },
        };
        onChange(updatedPreferences);
    };

    const handleTestNotification = async () => {
        setTestLoading(true);
        setTestMessage('');

        try {
            const response = await fetch('/api/test-notifications/trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type: selectedTestType }),
            });

            const data = await response.json();

            if (response.ok) {
                const sources = data.notification.sources;
                const sourcesList =
                    sources.length > 0 ? sources.join(', ') : 'in-app only';
                setTestMessage(`✅ Test notification sent! (${sourcesList})`);
            } else {
                setTestMessage(`❌ Failed: ${data.error}`);
            }
        } catch (error) {
            setTestMessage(
                `❌ Error: ${error.message || 'Failed to send test'}`
            );
        } finally {
            setTestLoading(false);
            // Clear message after 5 seconds
            setTimeout(() => setTestMessage(''), 5000);
        }
    };

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <BellIcon className="w-6 h-6 mr-3 text-purple-500" />
                {t('profile.tabs.notifications', 'Notification Preferences')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t(
                    'profile.notificationsDescription',
                    'Choose how you want to be notified about important events.'
                )}
            </p>

            {/* Telegram Not Configured Warning */}
            {!telegramConfigured && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        <span className="font-medium">
                            {t(
                                'notifications.telegram.notConfigured.title',
                                'Telegram Not Configured:'
                            )}
                        </span>{' '}
                        {t(
                            'notifications.telegram.notConfigured.message',
                            'To receive Telegram notifications, please configure your Telegram bot in the Telegram tab.'
                        )}
                    </p>
                </div>
            )}

            {/* Notifications Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                            <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {t(
                                    'notifications.table.type',
                                    'Notification Type'
                                )}
                            </th>
                            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {t('notifications.channels.inApp', 'In-app')}
                            </th>
                            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                    {t('notifications.channels.email', 'Email')}
                                    <span className="text-[10px] text-gray-500 dark:text-gray-500 font-normal">
                                        ({t('common.comingSoon', 'Coming Soon')}
                                        )
                                    </span>
                                </div>
                            </th>
                            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                                <div className="flex items-center justify-center gap-1">
                                    {t('notifications.channels.push', 'Push')}
                                    <span className="text-[10px] text-gray-500 dark:text-gray-500 font-normal">
                                        ({t('common.comingSoon', 'Coming Soon')}
                                        )
                                    </span>
                                </div>
                            </th>
                            <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                                {t(
                                    'notifications.channels.telegram',
                                    'Telegram'
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <NotificationTypeRow
                            icon={BellAlertIcon}
                            label={t(
                                'notifications.types.dueTasks',
                                'Due Tasks'
                            )}
                            description={t(
                                'notifications.descriptions.dueTasks',
                                'Tasks that are due within 24 hours'
                            )}
                            preferences={preferences.dueTasks}
                            onToggle={(channel, value) =>
                                handleToggle('dueTasks', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                        />
                        <NotificationTypeRow
                            icon={ExclamationTriangleIcon}
                            label={t(
                                'notifications.types.overdueTasks',
                                'Overdue Tasks'
                            )}
                            description={t(
                                'notifications.descriptions.overdueTasks',
                                'Tasks that have passed their due date'
                            )}
                            preferences={preferences.overdueTasks}
                            onToggle={(channel, value) =>
                                handleToggle('overdueTasks', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                        />
                        <NotificationTypeRow
                            icon={ClockIcon}
                            label={t(
                                'notifications.types.deferUntil',
                                'Defer Until'
                            )}
                            description={t(
                                'notifications.descriptions.deferUntil',
                                'Tasks that are now available to work on'
                            )}
                            preferences={preferences.deferUntil}
                            onToggle={(channel, value) =>
                                handleToggle('deferUntil', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                        />
                        <NotificationTypeRow
                            icon={FolderIcon}
                            label={t(
                                'notifications.types.dueProjects',
                                'Due Projects'
                            )}
                            description={t(
                                'notifications.descriptions.dueProjects',
                                'Projects that are due within 24 hours'
                            )}
                            preferences={preferences.dueProjects}
                            onToggle={(channel, value) =>
                                handleToggle('dueProjects', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                        />
                        <NotificationTypeRow
                            icon={FolderOpenIcon}
                            label={t(
                                'notifications.types.overdueProjects',
                                'Overdue Projects'
                            )}
                            description={t(
                                'notifications.descriptions.overdueProjects',
                                'Projects that have passed their due date'
                            )}
                            preferences={preferences.overdueProjects}
                            onToggle={(channel, value) =>
                                handleToggle('overdueProjects', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                        />
                    </tbody>
                </table>
            </div>

            {/* Test Notifications Section */}
            <div className="mt-6 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center">
                    <ClockIcon className="w-4 h-4 mr-2" />
                    {t('notifications.test.title', 'Test Notifications')}
                </h4>
                <p className="text-xs text-purple-700 dark:text-purple-300 mb-4">
                    {t(
                        'notifications.test.description',
                        'Send a test notification to see how it appears in-app and on enabled channels (Telegram, etc.)'
                    )}
                </p>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedTestType}
                        onChange={(e) => setSelectedTestType(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-purple-300 dark:border-purple-700 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                        <option value="task_due_soon">
                            {t('notifications.types.dueTasks', 'Due Tasks')}
                        </option>
                        <option value="task_overdue">
                            {t(
                                'notifications.types.overdueTasks',
                                'Overdue Tasks'
                            )}
                        </option>
                        <option value="defer_until">
                            {t('notifications.types.deferUntil', 'Defer Until')}
                        </option>
                        <option value="project_due_soon">
                            {t(
                                'notifications.types.dueProjects',
                                'Due Projects'
                            )}
                        </option>
                        <option value="project_overdue">
                            {t(
                                'notifications.types.overdueProjects',
                                'Overdue Projects'
                            )}
                        </option>
                    </select>
                    <button
                        onClick={handleTestNotification}
                        disabled={testLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
                    >
                        {testLoading ? (
                            <span className="flex items-center">
                                <svg
                                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                >
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                {t('notifications.test.sending', 'Sending...')}
                            </span>
                        ) : (
                            t('notifications.test.send', 'Send Test')
                        )}
                    </button>
                </div>
                {testMessage && (
                    <div className="mt-3 p-2 text-sm text-purple-900 dark:text-purple-100 bg-purple-100 dark:bg-purple-900/40 rounded">
                        {testMessage}
                    </div>
                )}
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">
                        {t('notifications.info.title', 'Note:')}
                    </span>{' '}
                    {t(
                        'notifications.info.message',
                        'Email and Push notifications are coming soon. In-app and Telegram notifications are currently available.'
                    )}
                </p>
            </div>
        </div>
    );
};

export default NotificationsTab;
