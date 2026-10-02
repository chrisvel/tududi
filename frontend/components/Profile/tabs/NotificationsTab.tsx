import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    BellIcon,
    BellAlertIcon,
    ExclamationTriangleIcon,
    FolderIcon,
    FolderOpenIcon,
    ClockIcon,
    FireIcon,
    ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline';
import type { NotificationPreferences } from '../types';
import { getCsrfToken } from '../../../utils/csrfService';
import PushDeviceCard from './PushDeviceCard';
import { PushState, countPushDevices } from '../../../utils/pushService';

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
    taskAssigned: { inApp: true, email: false, push: false, telegram: false },
    habitReminders: {
        inApp: true,
        email: false,
        push: false,
        telegram: false,
    },
    comments: { inApp: true, email: false, push: false, telegram: false },
};

type Channel = 'inApp' | 'email' | 'push' | 'telegram';

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
    pushAvailable: boolean;
}

const NotificationTypeRow: React.FC<NotificationTypeRowProps> = ({
    icon: Icon,
    label,
    description,
    preferences,
    onToggle,
    telegramConfigured,
    pushAvailable,
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
                {renderToggle('push', preferences.push, pushAvailable)}
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
    const [testingChannel, setTestingChannel] = React.useState<Channel | null>(
        null
    );
    const [testResult, setTestResult] = React.useState<{
        ok: boolean;
        text: string;
    } | null>(null);
    const [pushState, setPushState] = React.useState<PushState | null>(null);
    const [pushDevices, setPushDevices] = React.useState<number>(0);

    // Fetch profile data to check telegram configuration
    React.useEffect(() => {
        if (isActive) {
            fetch('/api/profile')
                .then((res) => res.json())
                .then((data) => setProfile(data))
                .catch((err) => console.error('Failed to fetch profile', err));
            countPushDevices()
                .then(setPushDevices)
                .catch(() => setPushDevices(0));
        }
    }, [isActive, pushState]);

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

    // Push toggles work once any device of this account can receive push,
    // so they can be set from a desktop for a phone and the other way round.
    const pushAvailable = pushState === 'subscribed' || pushDevices > 0;

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

    const handleTest = async (channel: Channel) => {
        setTestingChannel(channel);
        setTestResult(null);
        try {
            const response = await fetch('/api/test-notifications/trigger', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                body: JSON.stringify({ channel }),
            });
            const data = await response.json().catch(() => ({}));
            setTestResult(
                response.ok
                    ? {
                          ok: true,
                          text: t(
                              'notifications.test.sent',
                              'Test sent via {{channel}}.',
                              { channel: channelLabel(channel) }
                          ),
                      }
                    : {
                          ok: false,
                          text:
                              data.error ||
                              t(
                                  'notifications.test.failed',
                                  'Could not send the test.'
                              ),
                      }
            );
        } catch {
            setTestResult({
                ok: false,
                text: t(
                    'notifications.test.failed',
                    'Could not send the test.'
                ),
            });
        } finally {
            setTestingChannel(null);
        }
    };

    const channelLabel = (channel: Channel) =>
        ({
            inApp: t('notifications.channels.inApp', 'In-app'),
            email: t('notifications.channels.email', 'Email'),
            push: t('notifications.channels.push', 'Push'),
            telegram: t('notifications.channels.telegram', 'Telegram'),
        })[channel];

    const channelAvailable: Record<Channel, boolean> = {
        inApp: true,
        email: false,
        push: pushAvailable,
        telegram: telegramConfigured,
    };

    const renderTestButton = (channel: Channel) => (
        <button
            type="button"
            onClick={() => handleTest(channel)}
            disabled={!channelAvailable[channel] || testingChannel !== null}
            aria-label={t(
                'notifications.test.sendVia',
                'Send a test via {{channel}}',
                {
                    channel: channelLabel(channel),
                }
            )}
            className="px-2.5 py-1 text-xs font-medium rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
            {testingChannel === channel
                ? t('notifications.test.sending', 'Sending...')
                : t('notifications.test.button', 'Test')}
        </button>
    );

    return (
        <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <BellIcon className="w-6 h-6 mr-3 text-purple-500" />
                {t('profile.tabs.notifications', 'Notifications')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                {t(
                    'profile.notificationsDescription',
                    'Choose how you want to be notified about important events.'
                )}
            </p>

            <PushDeviceCard onStateChange={setPushState} />

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
                                {t('notifications.channels.push', 'Push')}
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
                            pushAvailable={pushAvailable}
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
                            pushAvailable={pushAvailable}
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
                            pushAvailable={pushAvailable}
                        />
                        <NotificationTypeRow
                            icon={BellIcon}
                            label={t(
                                'notifications.types.taskAssigned',
                                'Task Assigned'
                            )}
                            description={t(
                                'notifications.descriptions.taskAssigned',
                                'A task was assigned to you by someone else'
                            )}
                            preferences={preferences.taskAssigned}
                            onToggle={(channel, value) =>
                                handleToggle('taskAssigned', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                            pushAvailable={pushAvailable}
                        />
                        <NotificationTypeRow
                            icon={ChatBubbleLeftRightIcon}
                            label={t(
                                'notifications.types.comments',
                                'Comments & Mentions'
                            )}
                            description={t(
                                'notifications.descriptions.comments',
                                'Replies, comments on your tasks, and @mentions'
                            )}
                            preferences={preferences.comments}
                            onToggle={(channel, value) =>
                                handleToggle('comments', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                            pushAvailable={pushAvailable}
                        />
                        <NotificationTypeRow
                            icon={FireIcon}
                            label={t(
                                'notifications.types.habitReminders',
                                'Habit Reminders'
                            )}
                            description={t(
                                'notifications.descriptions.habitReminders',
                                'At the reminder time set on a habit, while it is still open'
                            )}
                            preferences={preferences.habitReminders}
                            onToggle={(channel, value) =>
                                handleToggle('habitReminders', channel, value)
                            }
                            telegramConfigured={telegramConfigured}
                            pushAvailable={pushAvailable}
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
                            pushAvailable={pushAvailable}
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
                            pushAvailable={pushAvailable}
                        />
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="py-4 px-4 text-sm text-gray-600 dark:text-gray-400">
                                {t(
                                    'notifications.test.rowLabel',
                                    'Send a test notification'
                                )}
                            </td>
                            {(
                                ['inApp', 'email', 'push', 'telegram'] as const
                            ).map((channel) => (
                                <td
                                    key={channel}
                                    className="py-4 px-4 text-center"
                                >
                                    {renderTestButton(channel)}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>
            {testResult && (
                <p
                    role="status"
                    className={`mt-2 px-4 text-sm ${testResult.ok ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}
                >
                    {testResult.text}
                </p>
            )}

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                    <span className="font-medium">
                        {t('notifications.info.title', 'Note:')}
                    </span>{' '}
                    {t(
                        'notifications.info.message',
                        'Email notifications are coming soon. In-app, Push and Telegram notifications are available.'
                    )}
                </p>
            </div>
        </div>
    );
};

export default NotificationsTab;
