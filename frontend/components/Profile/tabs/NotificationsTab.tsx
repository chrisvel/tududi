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
    dueTasks: { inApp: true, email: false, push: false },
    overdueTasks: { inApp: true, email: false, push: false },
    dueProjects: { inApp: true, email: false, push: false },
    overdueProjects: { inApp: true, email: false, push: false },
    deferUntil: { inApp: true, email: false, push: false },
};

interface NotificationTypeRowProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    preferences: { inApp: boolean; email: boolean; push: boolean };
    onToggle: (channel: 'inApp' | 'email' | 'push', value: boolean) => void;
}

const NotificationTypeRow: React.FC<NotificationTypeRowProps> = ({
    icon: Icon,
    label,
    description,
    preferences,
    onToggle,
}) => {
    const renderToggle = (
        channel: 'inApp' | 'email' | 'push',
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
        </tr>
    );
};

const NotificationsTab: React.FC<NotificationsTabProps> = ({
    isActive,
    notificationPreferences,
    onChange,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    // Merge with defaults to ensure all types exist
    const preferences: NotificationPreferences = {
        ...DEFAULT_PREFERENCES,
        ...notificationPreferences,
    };

    const handleToggle = (
        notificationType: keyof NotificationPreferences,
        channel: 'inApp' | 'email' | 'push',
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

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
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
                        />
                    </tbody>
                </table>
            </div>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">
                        {t('notifications.info.title', 'Note:')}
                    </span>{' '}
                    {t(
                        'notifications.info.message',
                        'Email and Push notifications are coming soon. In-app notifications are currently available.'
                    )}
                </p>
            </div>
        </div>
    );
};

export default NotificationsTab;
