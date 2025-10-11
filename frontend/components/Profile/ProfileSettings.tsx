import React, {
    useState,
    useEffect,
    ChangeEvent,
    FormEvent,
    useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
    InformationCircleIcon,
    EyeIcon,
    EyeSlashIcon,
    UserIcon,
    ClockIcon,
    ShieldCheckIcon,
    LightBulbIcon,
    CogIcon,
    ClipboardDocumentListIcon,
    BoltIcon,
    ChevronRightIcon,
    ExclamationTriangleIcon,
    FaceSmileIcon,
    CheckIcon,
    SunIcon,
    MoonIcon,
} from '@heroicons/react/24/outline';
import TelegramIcon from '../Icons/TelegramIcon';
import { useToast } from '../Shared/ToastContext';
import { dispatchTelegramStatusChange } from '../../contexts/TelegramStatusContext';
import LanguageDropdown from '../Shared/LanguageDropdown';
import FirstDayOfWeekDropdown from '../Shared/FirstDayOfWeekDropdown';
import { getLocaleFirstDayOfWeek } from '../../utils/profileService';

interface ProfileSettingsProps {
    currentUser: { uid: string; email: string };
    isDarkMode?: boolean;
    toggleDarkMode?: () => void;
}

interface Profile {
    uid: string;
    email: string;
    name?: string;
    surname?: string;
    appearance: 'light' | 'dark';
    language: string;
    timezone: string;
    first_day_of_week: number;
    avatar_image: string | null;
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
    telegram_allowed_users: string | null;
    task_summary_enabled: boolean;
    task_summary_frequency: string;
    task_intelligence_enabled: boolean;
    auto_suggest_next_actions_enabled: boolean;
    productivity_assistant_enabled: boolean;
    next_task_suggestion_enabled: boolean;
    pomodoro_enabled: boolean;
}

interface TelegramBotInfo {
    username: string;
    first_name?: string;
    polling_status: any;
    chat_url: string;
}

const formatFrequency = (frequency: string): string => {
    if (frequency.endsWith('h')) {
        const value = frequency.replace('h', '');
        return `${value} ${parseInt(value) === 1 ? 'hour' : 'hours'}`;
    } else if (frequency === 'daily') {
        return '1 day';
    } else if (frequency === 'weekly') {
        return '1 week';
    } else if (frequency === 'weekdays') {
        return 'Weekdays';
    }
    return frequency;
};

const ProfileSettings: React.FC<ProfileSettingsProps> = ({
    isDarkMode,
    toggleDarkMode,
}) => {
    const { t, i18n } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const [activeTab, setActiveTab] = useState('general');

    // Password visibility state
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [profile, setProfile] = useState<Profile | null>(null);
    const [formData, setFormData] = useState<
        Partial<
            Profile & {
                currentPassword: string;
                newPassword: string;
                confirmPassword: string;
            }
        >
    >({
        name: '',
        surname: '',
        appearance: isDarkMode ? 'dark' : 'light',
        language: 'en',
        timezone: 'UTC',
        first_day_of_week: 1, // Monday by default
        avatar_image: '',
        telegram_bot_token: '',
        telegram_allowed_users: '',
        task_intelligence_enabled: true,
        task_summary_enabled: false,
        task_summary_frequency: 'daily',
        auto_suggest_next_actions_enabled: true,
        productivity_assistant_enabled: true,
        next_task_suggestion_enabled: true,
        pomodoro_enabled: true,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(true);
    const [updateKey, setUpdateKey] = useState(0);
    const [isChangingLanguage, setIsChangingLanguage] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const [telegramSetupStatus, setTelegramSetupStatus] = useState<
        'idle' | 'loading' | 'success' | 'error'
    >('idle');
    const [telegramBotInfo, setTelegramBotInfo] =
        useState<TelegramBotInfo | null>(null);

    const forceUpdate = useCallback(() => {
        setUpdateKey((prevKey) => prevKey + 1);
    }, []);

    // Password validation
    const validatePasswordForm = (): {
        valid: boolean;
        errors: { [key: string]: string };
    } => {
        const errors: { [key: string]: string } = {};

        // Only validate if user is trying to change password
        if (
            formData.currentPassword ||
            formData.newPassword ||
            formData.confirmPassword
        ) {
            if (!formData.currentPassword) {
                errors.currentPassword = t(
                    'profile.currentPasswordRequired',
                    'Current password is required'
                );
            }

            if (!formData.newPassword) {
                errors.newPassword = t(
                    'profile.newPasswordRequired',
                    'New password is required'
                );
            } else if (formData.newPassword.length < 6) {
                errors.newPassword = t(
                    'profile.passwordTooShort',
                    'Password must be at least 6 characters'
                );
            }

            if (formData.newPassword !== formData.confirmPassword) {
                errors.confirmPassword = t(
                    'profile.passwordMismatch',
                    'Passwords do not match'
                );
            }
        }

        return { valid: Object.keys(errors).length === 0, errors };
    };

    const handleChange = (
        e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleLanguageChange = async (value: string) => {
        try {
            setIsChangingLanguage(true);

            await i18n.changeLanguage(value);

            document.documentElement.lang = value;

            const resources = i18n.getResourceBundle(value, 'translation');

            if (!resources || Object.keys(resources).length === 0) {
                const loadPath = `/locales/${value}/translation.json`;
                try {
                    const response = await fetch(loadPath);
                    if (response.ok) {
                        const data = await response.json();
                        i18n.addResourceBundle(
                            value,
                            'translation',
                            data,
                            true,
                            true
                        );

                        if (window.forceLanguageReload) {
                            window.forceLanguageReload(value);
                        }
                    }
                } catch {
                    // Ignore errors loading language resources
                }
            }

            setTimeout(() => {
                forceUpdate();

                const checkAndLoadResources = i18n.getResourceBundle(
                    value,
                    'translation'
                );
                if (
                    !checkAndLoadResources ||
                    Object.keys(checkAndLoadResources).length === 0
                ) {
                    if (window.forceLanguageReload) {
                        window.forceLanguageReload(value);
                    }
                }

                setTimeout(() => {
                    if (isChangingLanguage) {
                        setIsChangingLanguage(false);
                    }
                }, 800);
            }, 200);
        } catch {
            setIsChangingLanguage(false);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/profile');

                if (!response.ok) {
                    throw new Error(
                        t('profile.fetchError', 'Failed to fetch profile data.')
                    );
                }

                const data = await response.json();
                setProfile(data);
                setFormData({
                    name: data.name || '',
                    surname: data.surname || '',
                    appearance:
                        data.appearance || (isDarkMode ? 'dark' : 'light'),
                    language: data.language || 'en',
                    timezone: data.timezone || 'UTC',
                    first_day_of_week:
                        data.first_day_of_week !== undefined
                            ? data.first_day_of_week
                            : 1,
                    avatar_image: data.avatar_image || '',
                    telegram_bot_token: data.telegram_bot_token || '',
                    telegram_allowed_users: data.telegram_allowed_users || '',
                    task_intelligence_enabled:
                        data.task_intelligence_enabled !== undefined
                            ? data.task_intelligence_enabled
                            : true,
                    task_summary_enabled:
                        data.task_summary_enabled !== undefined
                            ? data.task_summary_enabled
                            : false,
                    task_summary_frequency:
                        data.task_summary_frequency || 'daily',
                    auto_suggest_next_actions_enabled:
                        data.auto_suggest_next_actions_enabled !== undefined
                            ? data.auto_suggest_next_actions_enabled
                            : true,
                    productivity_assistant_enabled:
                        data.productivity_assistant_enabled !== undefined
                            ? data.productivity_assistant_enabled
                            : true,
                    next_task_suggestion_enabled:
                        data.next_task_suggestion_enabled !== undefined
                            ? data.next_task_suggestion_enabled
                            : true,
                    pomodoro_enabled:
                        data.pomodoro_enabled !== undefined
                            ? data.pomodoro_enabled
                            : true,
                });

                // Note: Task summary status checking functionality removed for now

                if (data.telegram_bot_token) {
                    fetchPollingStatus();
                }
            } catch (error) {
                showErrorToast((error as Error).message);
            } finally {
                setLoading(false);
            }
        };

        const fetchPollingStatus = async () => {
            try {
                const response = await fetch('/api/telegram/polling-status');

                if (!response.ok) {
                    throw new Error(
                        t(
                            'profile.pollingStatusError',
                            'Failed to fetch polling status.'
                        )
                    );
                }

                const data = await response.json();
                setIsPolling(data.status?.running || false);

                // Auto-start polling if user has a bot token but polling is not running
                if (data.telegram_bot_token && !data.status?.running) {
                    handleStartPolling();
                }
            } catch {
                // Ignore errors fetching polling status
            }
        };
        fetchProfile();
    }, []);

    // Fetch Telegram bot info when profile loads
    useEffect(() => {
        const fetchTelegramInfo = async () => {
            if (profile?.telegram_bot_token) {
                try {
                    // Fetch bot info
                    const setupResponse = await fetch('/api/telegram/setup', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            token: profile.telegram_bot_token,
                        }),
                    });

                    if (setupResponse.ok) {
                        const setupData = await setupResponse.json();
                        if (setupData.bot) {
                            setTelegramBotInfo({
                                username: setupData.bot.username,
                                first_name: setupData.bot.first_name,
                                chat_url: `https://t.me/${setupData.bot.username}`,
                                polling_status: null,
                            });
                        }
                    }

                    // Also fetch and auto-start polling status
                    const pollingResponse = await fetch(
                        '/api/telegram/polling-status',
                        {
                            credentials: 'include',
                            headers: {
                                Accept: 'application/json',
                            },
                        }
                    );

                    if (pollingResponse.ok) {
                        const pollingData = await pollingResponse.json();
                        setIsPolling(pollingData.status?.running || false);

                        // Auto-start polling if not running
                        if (!pollingData.status?.running) {
                            setTimeout(() => {
                                handleStartPolling();
                            }, 1000);
                        } else {
                            // Dispatch healthy status if already running
                            dispatchTelegramStatusChange('healthy');
                        }
                    }
                } catch (error) {
                    console.error('Error fetching Telegram info:', error);
                }
            }
        };

        fetchTelegramInfo();
    }, [profile?.telegram_bot_token]);

    useEffect(() => {}, [updateKey, i18n.language]);

    useEffect(() => {
        setFormData((prev) => ({
            ...prev,
            appearance: isDarkMode ? 'dark' : 'light',
        }));
    }, [isDarkMode]);

    useEffect(() => {
        const handleLanguageChanged = () => {
            forceUpdate();
        };

        const handleAppLanguageChanged = () => {
            forceUpdate();
            setTimeout(() => {
                setIsChangingLanguage(false);
            }, 300);
        };

        i18n.on('languageChanged', handleLanguageChanged);
        window.addEventListener(
            'app-language-changed',
            handleAppLanguageChanged as EventListener
        );

        return () => {
            i18n.off('languageChanged', handleLanguageChanged);
            window.removeEventListener(
                'app-language-changed',
                handleAppLanguageChanged as EventListener
            );
        };
    }, []);

    const handleSetupTelegram = async () => {
        setTelegramSetupStatus('loading');
        setTelegramBotInfo(null);

        try {
            if (
                !formData.telegram_bot_token ||
                !formData.telegram_bot_token.includes(':')
            ) {
                throw new Error(t('profile.invalidTelegramToken'));
            }

            const response = await fetch('/api/telegram/setup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token: formData.telegram_bot_token }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t('profile.telegramSetupFailed'));
            }

            const data = await response.json();
            setTelegramSetupStatus('success');

            // Extract bot info properly
            const bot = data.bot;
            let botDisplayName = 'Bot';

            if (bot) {
                if (bot.first_name && bot.username) {
                    botDisplayName = `${bot.first_name} (@${bot.username})`;
                } else if (bot.first_name) {
                    botDisplayName = bot.first_name;
                } else if (bot.username) {
                    botDisplayName = `@${bot.username}`;
                }
            }

            showSuccessToast(
                t(
                    'profile.telegramSetupSuccess',
                    'Telegram bot "{{botName}}" configured successfully!',
                    { botName: botDisplayName }
                )
            );

            if (data.bot) {
                setTelegramBotInfo({
                    username: data.bot.username,
                    first_name: data.bot.first_name,
                    chat_url: `https://t.me/${data.bot.username}`,
                    polling_status: null,
                });
                setIsPolling(true);

                // Send welcome message on first setup
                if (profile?.telegram_chat_id) {
                    try {
                        await fetch('/api/telegram/send-welcome', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                chatId: profile.telegram_chat_id,
                            }),
                        });
                    } catch (error) {
                        console.error('Error sending welcome message:', error);
                    }
                }

                if (!data.bot.polling_status?.running) {
                    setTimeout(() => {
                        handleStartPolling();
                    }, 1000);
                }

                // Dispatch status change event
                dispatchTelegramStatusChange('healthy');
            }
        } catch (error) {
            setTelegramSetupStatus('error');
            showErrorToast((error as Error).message);
        }
    };

    const handleStartPolling = async () => {
        try {
            const response = await fetch('/api/telegram/start-polling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t('profile.startPollingFailed'));
            }

            const data = await response.json();
            setIsPolling(true);
            showSuccessToast(t('profile.pollingStarted'));

            // Dispatch status change event
            dispatchTelegramStatusChange('healthy');

            if (telegramBotInfo) {
                setTelegramBotInfo({
                    ...telegramBotInfo,
                    polling_status: data.status,
                });
            }
        } catch {
            showErrorToast(t('profile.pollingError'));
            dispatchTelegramStatusChange('problem');
        }
    };

    const handleStopPolling = async () => {
        try {
            const response = await fetch('/api/telegram/stop-polling', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t('profile.stopPollingFailed'));
            }

            const data = await response.json();
            setIsPolling(false);
            showSuccessToast(
                t('profile.pollingStopped', 'Polling stopped successfully.')
            );

            // Dispatch status change event
            dispatchTelegramStatusChange('problem');

            if (telegramBotInfo) {
                setTelegramBotInfo({
                    ...telegramBotInfo,
                    polling_status: data.status,
                });
            }
        } catch {
            showErrorToast(t('profile.pollingError'));
            dispatchTelegramStatusChange('problem');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        // Check if user is trying to change password
        const isPasswordChange =
            formData.currentPassword ||
            formData.newPassword ||
            formData.confirmPassword;

        // Only validate password if user is trying to change password
        if (isPasswordChange) {
            const passwordValidation = validatePasswordForm();
            if (!passwordValidation.valid) {
                showErrorToast(Object.values(passwordValidation.errors)[0]);
                return;
            }
        }

        try {
            // Prepare data to send - exclude password fields if not changing password
            const dataToSend = { ...formData };
            if (!isPasswordChange) {
                delete dataToSend.currentPassword;
                delete dataToSend.newPassword;
                delete dataToSend.confirmPassword;
            }

            const response = await fetch('/api/profile', {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(dataToSend),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update profile.');
            }

            const updatedProfile: Profile = await response.json();
            setProfile(updatedProfile);

            // Update formData to reflect the saved changes, preserving any fields not in response
            setFormData((prev) => ({
                ...prev,
                appearance:
                    updatedProfile.appearance || prev.appearance || 'light',
                language: updatedProfile.language || prev.language || 'en',
                timezone: updatedProfile.timezone || prev.timezone || 'UTC',
                avatar_image:
                    updatedProfile.avatar_image !== undefined
                        ? updatedProfile.avatar_image
                        : prev.avatar_image || '',
                telegram_bot_token:
                    updatedProfile.telegram_bot_token !== undefined
                        ? updatedProfile.telegram_bot_token
                        : prev.telegram_bot_token || '',
                telegram_allowed_users:
                    updatedProfile.telegram_allowed_users !== undefined
                        ? updatedProfile.telegram_allowed_users
                        : prev.telegram_allowed_users || '',
                task_intelligence_enabled:
                    updatedProfile.task_intelligence_enabled !== undefined
                        ? updatedProfile.task_intelligence_enabled
                        : prev.task_intelligence_enabled !== undefined
                          ? prev.task_intelligence_enabled
                          : true,
                task_summary_enabled:
                    updatedProfile.task_summary_enabled !== undefined
                        ? updatedProfile.task_summary_enabled
                        : prev.task_summary_enabled !== undefined
                          ? prev.task_summary_enabled
                          : false,
                task_summary_frequency:
                    updatedProfile.task_summary_frequency ||
                    prev.task_summary_frequency ||
                    'daily',
                auto_suggest_next_actions_enabled:
                    updatedProfile.auto_suggest_next_actions_enabled !==
                    undefined
                        ? updatedProfile.auto_suggest_next_actions_enabled
                        : prev.auto_suggest_next_actions_enabled !== undefined
                          ? prev.auto_suggest_next_actions_enabled
                          : true,
                productivity_assistant_enabled:
                    updatedProfile.productivity_assistant_enabled !== undefined
                        ? updatedProfile.productivity_assistant_enabled
                        : prev.productivity_assistant_enabled !== undefined
                          ? prev.productivity_assistant_enabled
                          : true,
                next_task_suggestion_enabled:
                    updatedProfile.next_task_suggestion_enabled !== undefined
                        ? updatedProfile.next_task_suggestion_enabled
                        : prev.next_task_suggestion_enabled !== undefined
                          ? prev.next_task_suggestion_enabled
                          : true,
                pomodoro_enabled:
                    updatedProfile.pomodoro_enabled !== undefined
                        ? updatedProfile.pomodoro_enabled
                        : prev.pomodoro_enabled !== undefined
                          ? prev.pomodoro_enabled
                          : true,
            }));

            // Apply appearance change after save
            if (
                updatedProfile.appearance !== (isDarkMode ? 'dark' : 'light') &&
                toggleDarkMode
            ) {
                toggleDarkMode();
            }

            // Apply language change after save
            if (updatedProfile.language !== i18n.language) {
                await handleLanguageChange(updatedProfile.language);
            }

            // Notify other components about Pomodoro setting change
            if (updatedProfile.pomodoro_enabled !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('pomodoroSettingChanged', {
                        detail: { enabled: updatedProfile.pomodoro_enabled },
                    })
                );
            }

            // Clear password fields on successful save
            if (isPasswordChange) {
                setFormData((prev) => ({
                    ...prev,
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: '',
                }));
            }

            const successMessage = isPasswordChange
                ? t(
                      'profile.passwordChangeSuccess',
                      'Password changed successfully!'
                  )
                : t('profile.successMessage', 'Profile updated successfully!');
            showSuccessToast(successMessage);
        } catch (err) {
            showErrorToast((err as Error).message);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('common.loading')}
                </div>
            </div>
        );
    }

    const tabs = [
        {
            id: 'general',
            name: t('profile.tabs.general', 'General'),
            icon: 'user',
        },
        {
            id: 'security',
            name: t('profile.tabs.security', 'Security'),
            icon: 'shield',
        },
        {
            id: 'productivity',
            name: t('profile.tabs.productivity', 'Productivity'),
            icon: 'clock',
        },
        {
            id: 'telegram',
            name: t('profile.tabs.telegram', 'Telegram'),
            icon: 'chat',
        },
        {
            id: 'ai',
            name: t('profile.tabs.ai', 'AI Features'),
            icon: 'sparkles',
        },
    ];

    const renderTabIcon = (iconType: string) => {
        switch (iconType) {
            case 'user':
                return <UserIcon className="w-5 h-5" />;
            case 'clock':
                return <ClockIcon className="w-5 h-5" />;
            case 'chat':
                return <TelegramIcon className="w-5 h-5" />;
            case 'shield':
                return <ShieldCheckIcon className="w-5 h-5" />;
            case 'sparkles':
                return <LightBulbIcon className="w-5 h-5" />;
            default:
                return null;
        }
    };

    return (
        <div
            className="max-w-5xl mx-auto p-6"
            key={`profile-settings-${updateKey}`}
        >
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                {t('profile.title')}
            </h2>

            {/* Navigation Tabs */}
            <div className="mb-8">
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="-mb-px flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-hide">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`group inline-flex items-center py-2 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                                    activeTab === tab.id
                                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                                }`}
                            >
                                <span className="mr-1 sm:mr-2">
                                    {renderTabIcon(tab.icon)}
                                </span>
                                {tab.name}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* General Tab */}
                {activeTab === 'general' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                            <UserIcon className="w-6 h-6 mr-3 text-blue-500" />
                            {t(
                                'profile.accountSettings',
                                'Account & Preferences'
                            )}
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('profile.name', 'Name')}
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={t(
                                        'profile.enterName',
                                        'Enter your name'
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('profile.surname', 'Surname')}
                                </label>
                                <input
                                    type="text"
                                    name="surname"
                                    value={formData.surname || ''}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={t(
                                        'profile.enterSurname',
                                        'Enter your surname'
                                    )}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('profile.appearance')}
                                </label>
                                <div className="flex rounded-md border border-gray-300 dark:border-gray-600 overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                appearance: 'light',
                                            }))
                                        }
                                        className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors ${
                                            formData.appearance === 'light'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        <SunIcon className="h-4 w-4 mr-2" />
                                        {t('profile.lightMode', 'Light')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                appearance: 'dark',
                                            }))
                                        }
                                        className={`flex-1 flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors ${
                                            formData.appearance === 'dark'
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                                        }`}
                                    >
                                        <MoonIcon className="h-4 w-4 mr-2" />
                                        {t('profile.darkMode', 'Dark')}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('profile.language')}
                                </label>
                                <LanguageDropdown
                                    value={formData.language || 'en'}
                                    onChange={(languageCode) => {
                                        // Auto-set first day of week based on language/locale
                                        const localeFirstDay =
                                            getLocaleFirstDayOfWeek(
                                                languageCode
                                            );
                                        setFormData((prev) => ({
                                            ...prev,
                                            language: languageCode,
                                            first_day_of_week: localeFirstDay,
                                        }));
                                    }}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('profile.timezone')}
                                </label>
                                <select
                                    name="timezone"
                                    value={formData.timezone}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="UTC">UTC</option>

                                    {/* Americas */}
                                    <optgroup label="Americas">
                                        <option value="America/New_York">
                                            Eastern Time (New York)
                                        </option>
                                        <option value="America/Chicago">
                                            Central Time (Chicago)
                                        </option>
                                        <option value="America/Denver">
                                            Mountain Time (Denver)
                                        </option>
                                        <option value="America/Los_Angeles">
                                            Pacific Time (Los Angeles)
                                        </option>
                                        <option value="America/Anchorage">
                                            Alaska Time (Anchorage)
                                        </option>
                                        <option value="Pacific/Honolulu">
                                            Hawaii Time (Honolulu)
                                        </option>
                                        <option value="America/Toronto">
                                            Eastern Time (Toronto)
                                        </option>
                                        <option value="America/Vancouver">
                                            Pacific Time (Vancouver)
                                        </option>
                                        <option value="America/Mexico_City">
                                            Central Time (Mexico City)
                                        </option>
                                        <option value="America/Sao_Paulo">
                                            Brasília Time (São Paulo)
                                        </option>
                                        <option value="America/Argentina/Buenos_Aires">
                                            Argentina Time (Buenos Aires)
                                        </option>
                                        <option value="America/Lima">
                                            Peru Time (Lima)
                                        </option>
                                        <option value="America/Bogota">
                                            Colombia Time (Bogotá)
                                        </option>
                                        <option value="America/Caracas">
                                            Venezuela Time (Caracas)
                                        </option>
                                        <option value="America/Santiago">
                                            Chile Time (Santiago)
                                        </option>
                                    </optgroup>

                                    {/* Europe */}
                                    <optgroup label="Europe">
                                        <option value="Europe/London">
                                            Greenwich Mean Time (London)
                                        </option>
                                        <option value="Europe/Dublin">
                                            Greenwich Mean Time (Dublin)
                                        </option>
                                        <option value="Europe/Lisbon">
                                            Western European Time (Lisbon)
                                        </option>
                                        <option value="Europe/Paris">
                                            Central European Time (Paris)
                                        </option>
                                        <option value="Europe/Berlin">
                                            Central European Time (Berlin)
                                        </option>
                                        <option value="Europe/Madrid">
                                            Central European Time (Madrid)
                                        </option>
                                        <option value="Europe/Rome">
                                            Central European Time (Rome)
                                        </option>
                                        <option value="Europe/Amsterdam">
                                            Central European Time (Amsterdam)
                                        </option>
                                        <option value="Europe/Brussels">
                                            Central European Time (Brussels)
                                        </option>
                                        <option value="Europe/Vienna">
                                            Central European Time (Vienna)
                                        </option>
                                        <option value="Europe/Zurich">
                                            Central European Time (Zurich)
                                        </option>
                                        <option value="Europe/Prague">
                                            Central European Time (Prague)
                                        </option>
                                        <option value="Europe/Warsaw">
                                            Central European Time (Warsaw)
                                        </option>
                                        <option value="Europe/Stockholm">
                                            Central European Time (Stockholm)
                                        </option>
                                        <option value="Europe/Oslo">
                                            Central European Time (Oslo)
                                        </option>
                                        <option value="Europe/Copenhagen">
                                            Central European Time (Copenhagen)
                                        </option>
                                        <option value="Europe/Helsinki">
                                            Eastern European Time (Helsinki)
                                        </option>
                                        <option value="Europe/Athens">
                                            Eastern European Time (Athens)
                                        </option>
                                        <option value="Europe/Kiev">
                                            Eastern European Time (Kiev)
                                        </option>
                                        <option value="Europe/Moscow">
                                            Moscow Time (Moscow)
                                        </option>
                                        <option value="Europe/Istanbul">
                                            Turkey Time (Istanbul)
                                        </option>
                                    </optgroup>

                                    {/* Asia */}
                                    <optgroup label="Asia">
                                        <option value="Asia/Dubai">
                                            Gulf Standard Time (Dubai)
                                        </option>
                                        <option value="Asia/Tehran">
                                            Iran Standard Time (Tehran)
                                        </option>
                                        <option value="Asia/Yerevan">
                                            Armenia Time (Yerevan)
                                        </option>
                                        <option value="Asia/Baku">
                                            Azerbaijan Time (Baku)
                                        </option>
                                        <option value="Asia/Karachi">
                                            Pakistan Standard Time (Karachi)
                                        </option>
                                        <option value="Asia/Kolkata">
                                            India Standard Time (Mumbai/Delhi)
                                        </option>
                                        <option value="Asia/Kathmandu">
                                            Nepal Time (Kathmandu)
                                        </option>
                                        <option value="Asia/Dhaka">
                                            Bangladesh Standard Time (Dhaka)
                                        </option>
                                        <option value="Asia/Yangon">
                                            Myanmar Time (Yangon)
                                        </option>
                                        <option value="Asia/Bangkok">
                                            Indochina Time (Bangkok)
                                        </option>
                                        <option value="Asia/Ho_Chi_Minh">
                                            Indochina Time (Ho Chi Minh)
                                        </option>
                                        <option value="Asia/Jakarta">
                                            Western Indonesia Time (Jakarta)
                                        </option>
                                        <option value="Asia/Kuala_Lumpur">
                                            Malaysia Time (Kuala Lumpur)
                                        </option>
                                        <option value="Asia/Singapore">
                                            Singapore Standard Time (Singapore)
                                        </option>
                                        <option value="Asia/Manila">
                                            Philippines Time (Manila)
                                        </option>
                                        <option value="Asia/Hong_Kong">
                                            Hong Kong Time (Hong Kong)
                                        </option>
                                        <option value="Asia/Shanghai">
                                            China Standard Time
                                            (Beijing/Shanghai)
                                        </option>
                                        <option value="Asia/Taipei">
                                            China Standard Time (Taipei)
                                        </option>
                                        <option value="Asia/Tokyo">
                                            Japan Standard Time (Tokyo)
                                        </option>
                                        <option value="Asia/Seoul">
                                            Korea Standard Time (Seoul)
                                        </option>
                                        <option value="Asia/Vladivostok">
                                            Vladivostok Time (Vladivostok)
                                        </option>
                                    </optgroup>

                                    {/* Africa */}
                                    <optgroup label="Africa">
                                        <option value="Africa/Casablanca">
                                            Western European Time (Casablanca)
                                        </option>
                                        <option value="Africa/Lagos">
                                            West Africa Time (Lagos)
                                        </option>
                                        <option value="Africa/Cairo">
                                            Eastern European Time (Cairo)
                                        </option>
                                        <option value="Africa/Johannesburg">
                                            South Africa Standard Time
                                            (Johannesburg)
                                        </option>
                                        <option value="Africa/Nairobi">
                                            East Africa Time (Nairobi)
                                        </option>
                                        <option value="Africa/Addis_Ababa">
                                            East Africa Time (Addis Ababa)
                                        </option>
                                    </optgroup>

                                    {/* Oceania */}
                                    <optgroup label="Oceania">
                                        <option value="Australia/Perth">
                                            Australian Western Standard Time
                                            (Perth)
                                        </option>
                                        <option value="Australia/Adelaide">
                                            Australian Central Standard Time
                                            (Adelaide)
                                        </option>
                                        <option value="Australia/Darwin">
                                            Australian Central Standard Time
                                            (Darwin)
                                        </option>
                                        <option value="Australia/Brisbane">
                                            Australian Eastern Standard Time
                                            (Brisbane)
                                        </option>
                                        <option value="Australia/Sydney">
                                            Australian Eastern Standard Time
                                            (Sydney)
                                        </option>
                                        <option value="Australia/Melbourne">
                                            Australian Eastern Standard Time
                                            (Melbourne)
                                        </option>
                                        <option value="Pacific/Auckland">
                                            New Zealand Standard Time (Auckland)
                                        </option>
                                        <option value="Pacific/Fiji">
                                            Fiji Time (Suva)
                                        </option>
                                        <option value="Pacific/Guam">
                                            Chamorro Standard Time (Guam)
                                        </option>
                                    </optgroup>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t(
                                        'profile.firstDayOfWeek',
                                        'First day of week'
                                    )}
                                </label>
                                <FirstDayOfWeekDropdown
                                    value={formData.first_day_of_week || 1}
                                    onChange={(value) => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            first_day_of_week: value,
                                        }));
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Security Tab */}
                {activeTab === 'security' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                            <ShieldCheckIcon className="w-6 h-6 mr-3 text-red-500" />
                            {t('profile.security', 'Security Settings')}
                        </h3>

                        {/* Password Change Section */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <UserIcon className="w-5 h-5 mr-2 text-blue-500" />
                                {t('profile.changePassword', 'Change Password')}
                            </h4>

                            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-200">
                                <p className="text-sm">
                                    <InformationCircleIcon className="w-4 h-4 inline mr-1" />
                                    {t(
                                        'profile.passwordChangeOptional',
                                        'Leave password fields empty to update other settings without changing your password.'
                                    )}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t(
                                            'profile.currentPassword',
                                            'Current Password'
                                        )}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={
                                                showCurrentPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="currentPassword"
                                            value={
                                                formData.currentPassword || ''
                                            }
                                            onChange={handleChange}
                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={t(
                                                'profile.enterCurrentPassword',
                                                'Enter your current password'
                                            )}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                            onClick={() =>
                                                setShowCurrentPassword(
                                                    !showCurrentPassword
                                                )
                                            }
                                        >
                                            {showCurrentPassword ? (
                                                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t(
                                            'profile.newPassword',
                                            'New Password'
                                        )}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={
                                                showNewPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="newPassword"
                                            value={formData.newPassword || ''}
                                            onChange={handleChange}
                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={t(
                                                'profile.enterNewPassword',
                                                'Enter your new password'
                                            )}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                            onClick={() =>
                                                setShowNewPassword(
                                                    !showNewPassword
                                                )
                                            }
                                        >
                                            {showNewPassword ? (
                                                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {t(
                                            'profile.confirmPassword',
                                            'Confirm New Password'
                                        )}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={
                                                showConfirmPassword
                                                    ? 'text'
                                                    : 'password'
                                            }
                                            name="confirmPassword"
                                            value={
                                                formData.confirmPassword || ''
                                            }
                                            onChange={handleChange}
                                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder={t(
                                                'profile.confirmNewPassword',
                                                'Confirm your new password'
                                            )}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                            onClick={() =>
                                                setShowConfirmPassword(
                                                    !showConfirmPassword
                                                )
                                            }
                                        >
                                            {showConfirmPassword ? (
                                                <EyeSlashIcon className="h-5 w-5 text-gray-400" />
                                            ) : (
                                                <EyeIcon className="h-5 w-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                    {t(
                                        'profile.passwordChangeNote',
                                        'Password changes will be saved when you click "Save Changes" at the bottom of the form.'
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Productivity Tab */}
                {activeTab === 'productivity' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                            <ClockIcon className="w-6 h-6 mr-3 text-green-500" />
                            {t(
                                'profile.productivityFeatures',
                                'Productivity Features'
                            )}
                        </h3>

                        <div className="space-y-6">
                            {/* Pomodoro Timer */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t(
                                            'profile.enablePomodoro',
                                            'Enable Pomodoro Timer'
                                        )}
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t(
                                            'profile.pomodoroDescription',
                                            'Enable the Pomodoro timer in the navigation bar for focused work sessions.'
                                        )}
                                    </p>
                                </div>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                        formData.pomodoro_enabled
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            pomodoro_enabled:
                                                !prev.pomodoro_enabled,
                                        }));
                                    }}
                                >
                                    <span
                                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                            formData.pomodoro_enabled
                                                ? 'translate-x-6'
                                                : 'translate-x-0'
                                        }`}
                                    ></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Telegram Tab */}
                {activeTab === 'telegram' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-blue-300 dark:border-blue-700 mb-8">
                        <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-6 flex items-center">
                            <TelegramIcon className="w-6 h-6 mr-3 text-blue-500" />
                            {t(
                                'profile.telegramIntegration',
                                'Telegram Integration'
                            )}
                        </h3>

                        {/* Bot Setup Subsection */}
                        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <CogIcon className="w-5 h-5 mr-2 text-blue-500" />
                                {t('profile.botSetup', 'Bot Setup')}
                            </h4>

                            <div className="space-y-4">
                                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-start">
                                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                                    <p>
                                        {t(
                                            'profile.telegramDescription',
                                            'Connect your tududi account to a Telegram bot to add items to your inbox via Telegram messages.'
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t(
                                            'profile.telegramBotToken',
                                            'Telegram Bot Token'
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="telegram_bot_token"
                                        value={
                                            formData.telegram_bot_token || ''
                                        }
                                        onChange={handleChange}
                                        placeholder="123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
                                        className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            'profile.telegramTokenDescription',
                                            'Create a bot with @BotFather on Telegram and paste the token here.'
                                        )}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        {t(
                                            'profile.telegramAllowedUsers',
                                            'Allowed Users'
                                        )}
                                    </label>
                                    <input
                                        type="text"
                                        name="telegram_allowed_users"
                                        value={
                                            formData.telegram_allowed_users ||
                                            ''
                                        }
                                        onChange={handleChange}
                                        placeholder="@username1, 123456789, @username2"
                                        className="mt-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                        <p>
                                            {t(
                                                'profile.telegramAllowedUsersDescription',
                                                'Control who can send messages to your bot. Leave empty to allow all users.'
                                            )}
                                        </p>
                                        <div className="space-y-1">
                                            <p className="font-semibold text-gray-600 dark:text-gray-300">
                                                {t(
                                                    'profile.examples',
                                                    'Examples:'
                                                )}
                                            </p>
                                            <ul className="list-disc list-inside ml-2 space-y-0.5">
                                                <li>
                                                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                                        @alice, @bob
                                                    </span>
                                                    {' - '}
                                                    {t(
                                                        'profile.exampleUsernames',
                                                        'Allow specific usernames'
                                                    )}
                                                </li>
                                                <li>
                                                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                                        123456789, 987654321
                                                    </span>
                                                    {' - '}
                                                    {t(
                                                        'profile.exampleUserIds',
                                                        'Allow specific user IDs'
                                                    )}
                                                </li>
                                                <li>
                                                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">
                                                        @alice, 123456789
                                                    </span>
                                                    {' - '}
                                                    {t(
                                                        'profile.exampleMixed',
                                                        'Mix usernames and user IDs'
                                                    )}
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>

                                {profile?.telegram_chat_id && (
                                    <div className="p-2 bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-800 rounded text-green-800 dark:text-green-200">
                                        <p className="text-sm">
                                            {t(
                                                'profile.telegramConnected',
                                                'Your Telegram account is connected! Send messages to your bot to add items to your tududi inbox.'
                                            )}
                                        </p>
                                    </div>
                                )}

                                {(telegramBotInfo ||
                                    profile?.telegram_bot_token) && (
                                    <div className="p-2 bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded text-blue-800 dark:text-blue-200">
                                        <p className="font-medium mb-2">
                                            {t(
                                                'profile.botConfigured',
                                                'Bot configured successfully!'
                                            )}
                                        </p>
                                        <div className="text-sm space-y-1">
                                            {telegramBotInfo?.first_name && (
                                                <p>
                                                    <span className="font-semibold">
                                                        Bot Name:{' '}
                                                    </span>
                                                    {telegramBotInfo.first_name}
                                                </p>
                                            )}
                                            {telegramBotInfo?.username && (
                                                <p>
                                                    <span className="font-semibold">
                                                        {t(
                                                            'profile.botUsername',
                                                            'Bot Username:'
                                                        )}{' '}
                                                    </span>
                                                    @{telegramBotInfo.username}
                                                </p>
                                            )}
                                            <div className="mt-2">
                                                <p className="font-semibold mb-1">
                                                    {t(
                                                        'profile.pollingStatus',
                                                        'Polling Status:'
                                                    )}{' '}
                                                </p>
                                                <div className="flex items-center mb-2">
                                                    <div
                                                        className={`w-3 h-3 rounded-full mr-2 ${isPolling ? 'bg-green-500' : 'bg-red-500'}`}
                                                    ></div>
                                                    <span>
                                                        {isPolling
                                                            ? t(
                                                                  'profile.pollingActive'
                                                              )
                                                            : t(
                                                                  'profile.pollingInactive'
                                                              )}
                                                    </span>
                                                </div>
                                                <p className="text-xs mb-2">
                                                    {t(
                                                        'profile.pollingNote',
                                                        'Polling periodically checks for new messages from Telegram and adds them to your inbox.'
                                                    )}
                                                </p>
                                                <div className="flex flex-wrap gap-2 mt-2">
                                                    {isPolling ? (
                                                        <button
                                                            onClick={
                                                                handleStopPolling
                                                            }
                                                            className="px-3 py-1 bg-red-600 text-white dark:bg-red-700 rounded text-sm hover:bg-red-700 dark:hover:bg-red-800"
                                                        >
                                                            {t(
                                                                'profile.stopPolling',
                                                                'Stop Polling'
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={
                                                                handleStartPolling
                                                            }
                                                            className="px-3 py-1 bg-blue-600 text-white dark:bg-blue-700 rounded text-sm hover:bg-blue-700 dark:hover:bg-blue-800"
                                                        >
                                                            {t(
                                                                'profile.startPolling',
                                                                'Start Polling'
                                                            )}
                                                        </button>
                                                    )}
                                                    {telegramBotInfo?.chat_url && (
                                                        <a
                                                            href={
                                                                telegramBotInfo.chat_url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1 bg-green-600 text-white dark:bg-green-700 rounded text-sm hover:bg-green-700 dark:hover:bg-green-800"
                                                        >
                                                            {t(
                                                                'profile.openTelegram',
                                                                'Open in Telegram'
                                                            )}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={handleSetupTelegram}
                                    disabled={
                                        !formData.telegram_bot_token ||
                                        telegramSetupStatus === 'loading'
                                    }
                                    className={`px-4 py-2 rounded-md ${
                                        !formData.telegram_bot_token ||
                                        telegramSetupStatus === 'loading'
                                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                                    }`}
                                >
                                    {telegramSetupStatus === 'loading'
                                        ? t(
                                              'profile.settingUp',
                                              'Setting up...'
                                          )
                                        : t(
                                              'profile.setupTelegram',
                                              'Setup Telegram'
                                          )}
                                </button>

                                {/* Status indicator */}
                                {telegramSetupStatus === 'success' && (
                                    <div className="mt-2 flex items-center text-green-600 dark:text-green-400">
                                        <svg
                                            className="w-5 h-5 mr-2"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <span className="text-sm font-medium">
                                            Bot configured successfully!
                                        </span>
                                    </div>
                                )}

                                {telegramSetupStatus === 'error' && (
                                    <div className="mt-2 flex items-center text-red-600 dark:text-red-400">
                                        <svg
                                            className="w-5 h-5 mr-2"
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                        <span className="text-sm font-medium">
                                            Setup failed. Please check your
                                            token.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Task Summary Notifications Subsection */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <ClipboardDocumentListIcon className="w-5 h-5 mr-2 text-green-500" />
                                {t(
                                    'profile.taskSummaryNotifications',
                                    'Task Summary Notifications'
                                )}
                            </h4>

                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                                <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                                <p>
                                    {t(
                                        'profile.taskSummaryDescription',
                                        'Receive regular summaries of your tasks via Telegram. This feature requires your Telegram integration to be set up.'
                                    )}
                                </p>
                            </div>

                            <div className="mb-4 flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(
                                        'profile.enableTaskSummary',
                                        'Enable Task Summaries'
                                    )}
                                </label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                        formData.task_summary_enabled
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            task_summary_enabled:
                                                !prev.task_summary_enabled,
                                        }));
                                    }}
                                >
                                    <span
                                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                            formData.task_summary_enabled
                                                ? 'translate-x-6'
                                                : 'translate-x-0'
                                        }`}
                                    ></span>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t(
                                        'profile.summaryFrequency',
                                        'Summary Frequency'
                                    )}
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        '1h',
                                        '2h',
                                        '4h',
                                        '8h',
                                        '12h',
                                        'daily',
                                        'weekly',
                                    ].map((frequency) => (
                                        <button
                                            key={frequency}
                                            type="button"
                                            className={`px-3 py-1.5 text-sm rounded-full ${
                                                formData.task_summary_frequency ===
                                                frequency
                                                    ? 'bg-blue-500 text-white'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                            }`}
                                            onClick={() => {
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    task_summary_frequency:
                                                        frequency,
                                                }));
                                            }}
                                        >
                                            {t(
                                                `profile.frequency.${frequency}`,
                                                formatFrequency(frequency)
                                            )}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {t(
                                        'profile.frequencyHelp',
                                        'Choose how often you want to receive task summaries.'
                                    )}
                                </p>
                            </div>

                            <div className="mt-4">
                                <button
                                    type="button"
                                    disabled={
                                        !profile?.telegram_bot_token ||
                                        !profile?.telegram_chat_id
                                    }
                                    className={`px-4 py-2 rounded-md ${
                                        !profile?.telegram_bot_token ||
                                        !profile?.telegram_chat_id
                                            ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600'
                                    }`}
                                    onClick={async () => {
                                        try {
                                            const response = await fetch(
                                                '/api/profile/task-summary/send-now',
                                                {
                                                    method: 'POST',
                                                    headers: {
                                                        'Content-Type':
                                                            'application/json',
                                                    },
                                                }
                                            );

                                            if (!response.ok) {
                                                const data =
                                                    await response.json();
                                                throw new Error(
                                                    data.error ||
                                                        t(
                                                            'profile.sendSummaryFailed'
                                                        )
                                                );
                                            }

                                            const data = await response.json();
                                            showSuccessToast(data.message);
                                        } catch (error) {
                                            showErrorToast(
                                                (error as Error).message
                                            );
                                        }
                                    }}
                                >
                                    {t(
                                        'profile.sendTestSummary',
                                        'Send Test Summary'
                                    )}
                                </button>
                                {(!profile?.telegram_bot_token ||
                                    !profile?.telegram_chat_id) && (
                                    <p className="mt-2 text-xs text-red-500">
                                        {t(
                                            'profile.telegramRequiredForSummaries',
                                            'Telegram integration must be set up to use task summaries.'
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Features Tab */}
                {activeTab === 'ai' && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                            <LightBulbIcon className="w-6 h-6 mr-3 text-blue-500" />
                            {t(
                                'profile.aiProductivityFeatures',
                                'AI & Productivity Features'
                            )}
                        </h3>

                        {/* Task Intelligence Subsection */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <BoltIcon className="w-5 h-5 mr-2 text-purple-500" />
                                {t(
                                    'profile.taskIntelligence',
                                    'Task Intelligence'
                                )}
                            </h4>

                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                                <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                                <p>
                                    {t(
                                        'profile.taskIntelligenceDescription',
                                        'Get helpful suggestions to make your task names more descriptive and actionable.'
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(
                                        'profile.enableTaskIntelligence',
                                        'Enable Task Intelligence Assistant'
                                    )}
                                </label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                        formData.task_intelligence_enabled
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            task_intelligence_enabled:
                                                !prev.task_intelligence_enabled,
                                        }));
                                    }}
                                >
                                    <span
                                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                            formData.task_intelligence_enabled
                                                ? 'translate-x-6'
                                                : 'translate-x-0'
                                        }`}
                                    ></span>
                                </div>
                            </div>
                        </div>

                        {/* Auto-Suggest Next Actions Subsection */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <ChevronRightIcon className="w-5 h-5 mr-2 text-green-500" />
                                {t(
                                    'profile.autoSuggestNextActions',
                                    'Auto-Suggest Next Actions'
                                )}
                            </h4>

                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                                <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                                <p>
                                    {t(
                                        'profile.autoSuggestNextActionsDescription',
                                        'When creating a project, automatically prompt for the very next physical action to take.'
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(
                                        'profile.enableAutoSuggestNextActions',
                                        'Enable Next Action Prompts'
                                    )}
                                </label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                        formData.auto_suggest_next_actions_enabled
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            auto_suggest_next_actions_enabled:
                                                !prev.auto_suggest_next_actions_enabled,
                                        }));
                                    }}
                                >
                                    <span
                                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                            formData.auto_suggest_next_actions_enabled
                                                ? 'translate-x-6'
                                                : 'translate-x-0'
                                        }`}
                                    ></span>
                                </div>
                            </div>
                        </div>

                        {/* Productivity Assistant Subsection */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-500" />
                                {t(
                                    'profile.productivityAssistant',
                                    'Productivity Assistant'
                                )}
                            </h4>

                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                                <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                                <p>
                                    {t(
                                        'profile.productivityAssistantDescription',
                                        'Show productivity insights that help identify stalled projects, vague tasks, and workflow improvements on your Today page.'
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(
                                        'profile.enableProductivityAssistant',
                                        'Enable Productivity Insights'
                                    )}
                                </label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                        formData.productivity_assistant_enabled
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            productivity_assistant_enabled:
                                                !prev.productivity_assistant_enabled,
                                        }));
                                    }}
                                >
                                    <span
                                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                            formData.productivity_assistant_enabled
                                                ? 'translate-x-6'
                                                : 'translate-x-0'
                                        }`}
                                    ></span>
                                </div>
                            </div>
                        </div>

                        {/* Next Task Suggestion Subsection */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg mt-4">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                                <FaceSmileIcon className="w-5 h-5 mr-2 text-green-500" />
                                {t(
                                    'profile.nextTaskSuggestion',
                                    'Next Task Suggestion'
                                )}
                            </h4>

                            <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                                <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                                <p>
                                    {t(
                                        'profile.nextTaskSuggestionDescription',
                                        'Automatically suggest the next best task to work on when you have nothing in progress, prioritizing due today tasks, then suggested tasks, then next actions.'
                                    )}
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t(
                                        'profile.enableNextTaskSuggestion',
                                        'Enable Next Task Suggestions'
                                    )}
                                </label>
                                <div
                                    className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                                        formData.next_task_suggestion_enabled
                                            ? 'bg-blue-500'
                                            : 'bg-gray-300 dark:bg-gray-600'
                                    }`}
                                    onClick={() => {
                                        setFormData((prev) => ({
                                            ...prev,
                                            next_task_suggestion_enabled:
                                                !prev.next_task_suggestion_enabled,
                                        }));
                                    }}
                                >
                                    <span
                                        className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                            formData.next_task_suggestion_enabled
                                                ? 'translate-x-6'
                                                : 'translate-x-0'
                                        }`}
                                    ></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Save Button */}
                <div className="flex justify-end dark:border-gray-700">
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
                    >
                        <CheckIcon className="w-5 h-5" />
                        <span>{t('profile.saveChanges', 'Save Changes')}</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProfileSettings;
