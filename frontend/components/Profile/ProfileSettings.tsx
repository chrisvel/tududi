import React, {
    useState,
    useEffect,
    ChangeEvent,
    FormEvent,
    useCallback,
} from 'react';
import { useTranslation } from 'react-i18next';
import { getLocalesPath, getApiPath } from '../../config/paths';
import {
    UserIcon,
    ClockIcon,
    ShieldCheckIcon,
    LightBulbIcon,
    KeyIcon,
    CheckIcon,
    BellIcon,
} from '@heroicons/react/24/outline';
import TelegramIcon from '../Icons/TelegramIcon';
import { useToast } from '../Shared/ToastContext';
import { dispatchTelegramStatusChange } from '../../contexts/TelegramStatusContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { getLocaleFirstDayOfWeek } from '../../utils/profileService';
import {
    getTimezonesByRegion,
    getRegionDisplayName,
} from '../../utils/timezoneUtils';
import type { ApiKeySummary } from '../../utils/apiKeysService';
import {
    fetchApiKeys,
    createApiKey,
    revokeApiKey,
    deleteApiKey,
} from '../../utils/apiKeysService';
import TabsNav, { type TabConfig } from './tabs/TabsNav';
import GeneralTab from './tabs/GeneralTab';
import SecurityTab from './tabs/SecurityTab';
import ApiKeysTab from './tabs/ApiKeysTab';
import ProductivityTab from './tabs/ProductivityTab';
import TelegramTab from './tabs/TelegramTab';
import AiTab from './tabs/AiTab';
import NotificationsTab from './tabs/NotificationsTab';
import type {
    ProfileSettingsProps,
    Profile,
    TelegramBotInfo,
    ProfileFormData,
} from './types';

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
    const timezonesByRegion = React.useMemo(() => {
        return getTimezonesByRegion();
    }, []);

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [profile, setProfile] = useState<Profile | null>(null);
    const [formData, setFormData] = useState<ProfileFormData>({
        name: '',
        surname: '',
        appearance: isDarkMode ? 'dark' : 'light',
        language: 'en',
        timezone: 'UTC',
        first_day_of_week: 1,
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
        notification_preferences: null,
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
    const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
    const [apiKeysLoading, setApiKeysLoading] = useState(false);
    const [apiKeysLoaded, setApiKeysLoaded] = useState(false);
    const [newApiKeyName, setNewApiKeyName] = useState('');
    const [newApiKeyExpiration, setNewApiKeyExpiration] = useState('');
    const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
    const [generatedApiToken, setGeneratedApiToken] = useState<string | null>(
        null
    );
    const [revokeInFlightId, setRevokeInFlightId] = useState<number | null>(
        null
    );
    const [deleteInFlightId, setDeleteInFlightId] = useState<number | null>(
        null
    );
    const [apiKeyToDelete, setApiKeyToDelete] = useState<ApiKeySummary | null>(
        null
    );
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [removeAvatar, setRemoveAvatar] = useState(false);

    const forceUpdate = useCallback(() => {
        setUpdateKey((prevKey) => prevKey + 1);
    }, []);

    const loadApiKeys = useCallback(async () => {
        setApiKeysLoading(true);
        try {
            const keys = await fetchApiKeys();
            setApiKeys(keys);
        } catch (error) {
            showErrorToast((error as Error).message);
        } finally {
            setApiKeysLoading(false);
            setApiKeysLoaded(true);
        }
    }, [showErrorToast]);

    useEffect(() => {
        if (activeTab === 'apiKeys' && !apiKeysLoaded) {
            loadApiKeys();
        }
    }, [activeTab, apiKeysLoaded, loadApiKeys]);

    const validatePasswordForm = (): {
        valid: boolean;
        errors: { [key: string]: string };
    } => {
        const errors: { [key: string]: string } = {};

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
                const loadPath = getLocalesPath(`${value}/translation.json`);
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
                } catch (error) {
                    console.error('Failed to load language resources', error);
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

    const handleCreateApiKey = async () => {
        if (!newApiKeyName.trim()) {
            showErrorToast(
                t('profile.apiKeys.nameRequired', 'API key name is required.')
            );
            return;
        }

        setIsCreatingApiKey(true);
        try {
            const payload: { name: string; expires_at?: string } = {
                name: newApiKeyName.trim(),
            };

            if (newApiKeyExpiration) {
                const parsed = new Date(`${newApiKeyExpiration}T23:59:59.999Z`);
                if (Number.isNaN(parsed.getTime())) {
                    throw new Error(
                        t(
                            'profile.apiKeys.invalidExpiration',
                            'Expiration date is invalid.'
                        )
                    );
                }
                payload.expires_at = parsed.toISOString();
            }

            const response = await createApiKey(payload);
            setGeneratedApiToken(response.token);
            setApiKeys((prev) => [response.apiKey, ...prev]);
            setNewApiKeyName('');
            setNewApiKeyExpiration('');
            showSuccessToast(
                t('profile.apiKeys.created', 'API key created successfully.')
            );
        } catch (error) {
            showErrorToast((error as Error).message);
        } finally {
            setIsCreatingApiKey(false);
        }
    };

    const handleRevokeApiKey = async (apiKeyId: number) => {
        setRevokeInFlightId(apiKeyId);
        try {
            const updatedKey = await revokeApiKey(apiKeyId);
            setApiKeys((prev) =>
                prev.map((key) => (key.id === apiKeyId ? updatedKey : key))
            );
            showSuccessToast(
                t('profile.apiKeys.revokedMessage', 'API key revoked.')
            );
        } catch (error) {
            showErrorToast((error as Error).message);
        } finally {
            setRevokeInFlightId(null);
        }
    };

    const confirmDeleteApiKey = async () => {
        if (!apiKeyToDelete) return;
        const apiKeyId = apiKeyToDelete.id;
        setDeleteInFlightId(apiKeyId);
        try {
            await deleteApiKey(apiKeyId);
            setApiKeys((prev) => prev.filter((key) => key.id !== apiKeyId));
            showSuccessToast(t('profile.apiKeys.deleted', 'API key deleted.'));
            setApiKeyToDelete(null);
        } catch (error) {
            showErrorToast((error as Error).message);
        } finally {
            setDeleteInFlightId(null);
        }
    };

    const handleCopyGeneratedToken = async () => {
        if (!generatedApiToken) return;

        try {
            await navigator.clipboard.writeText(generatedApiToken);
            showSuccessToast(
                t('profile.apiKeys.copied', 'API key copied to clipboard.')
            );
        } catch {
            showErrorToast(
                t(
                    'profile.apiKeys.copyFailed',
                    'Unable to copy API key to clipboard.'
                )
            );
        }
    };

    const closeDeleteDialog = () => {
        if (deleteInFlightId) return;
        setApiKeyToDelete(null);
    };

    const getApiKeyStatus = (apiKey: ApiKeySummary) => {
        if (apiKey.revoked_at) {
            return {
                label: t('profile.apiKeys.status.revoked', 'Revoked'),
                className: 'text-red-600 dark:text-red-400',
            };
        }

        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            return {
                label: t('profile.apiKeys.status.expired', 'Expired'),
                className: 'text-yellow-600 dark:text-yellow-400',
            };
        }

        return {
            label: t('profile.apiKeys.status.active', 'Active'),
            className: 'text-green-600 dark:text-green-400',
        };
    };

    const formatDateTime = (value: string | null) => {
        if (!value) {
            return t('profile.apiKeys.never', 'Never');
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return value;
        }
        return parsed.toLocaleString();
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                setLoading(true);
                const response = await fetch(getApiPath('profile'));

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
                    notification_preferences:
                        data.notification_preferences || null,
                });

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
                const response = await fetch(
                    getApiPath('telegram/polling-status')
                );

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

                if (data.telegram_bot_token && !data.status?.running) {
                    handleStartPolling();
                }
            } catch (error) {
                console.error('Error fetching polling status', error);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        const fetchTelegramInfo = async () => {
            if (profile?.telegram_bot_token) {
                try {
                    const setupResponse = await fetch(
                        getApiPath('telegram/setup'),
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                token: profile.telegram_bot_token,
                            }),
                        }
                    );

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

                    const pollingResponse = await fetch(
                        getApiPath('telegram/polling-status'),
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

                        if (!pollingData.status?.running) {
                            setTimeout(() => {
                                handleStartPolling();
                            }, 1000);
                        } else {
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

            const response = await fetch(getApiPath('telegram/setup'), {
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

                if (profile?.telegram_chat_id) {
                    try {
                        await fetch(getApiPath('telegram/send-welcome'), {
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

                dispatchTelegramStatusChange('healthy');
            }
        } catch (error) {
            setTelegramSetupStatus('error');
            showErrorToast((error as Error).message);
        }
    };

    const handleStartPolling = async () => {
        try {
            const response = await fetch(getApiPath('telegram/start-polling'), {
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
            const response = await fetch(getApiPath('telegram/stop-polling'), {
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

    const handleSendTestSummary = async () => {
        try {
            const response = await fetch(
                getApiPath('profile/task-summary/send-now'),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || t('profile.sendSummaryFailed'));
            }

            const data = await response.json();
            showSuccessToast(data.message);
        } catch (error) {
            showErrorToast((error as Error).message);
        }
    };

    const handleAvatarSelect = (file: File) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showErrorToast(
                t('profile.avatarUploadError', 'Please upload an image file')
            );
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showErrorToast(
                t('profile.avatarSizeError', 'Image must be smaller than 5MB')
            );
            return;
        }

        setAvatarFile(file);
        setRemoveAvatar(false);

        const reader = new FileReader();
        reader.onloadend = () => {
            setAvatarPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleAvatarRemove = async () => {
        try {
            await deleteAvatar();

            setAvatarFile(null);
            setAvatarPreview(null);
            setRemoveAvatar(false);
            setFormData((prev) => ({ ...prev, avatar_image: '' }));

            if (profile) {
                setProfile({ ...profile, avatar_image: null });
            }

            showSuccessToast('Avatar removed successfully');
        } catch (error) {
            showErrorToast(
                (error as Error).message || 'Failed to remove avatar'
            );
        }
    };

    const uploadAvatar = async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await fetch(getApiPath('profile/avatar'), {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload avatar');
        }

        const data = await response.json();
        return data.avatar_image;
    };

    const deleteAvatar = async (): Promise<void> => {
        const response = await fetch(getApiPath('profile/avatar'), {
            method: 'DELETE',
            credentials: 'include',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to remove avatar');
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const isPasswordChange =
            formData.currentPassword ||
            formData.newPassword ||
            formData.confirmPassword;

        if (isPasswordChange) {
            const passwordValidation = validatePasswordForm();
            if (!passwordValidation.valid) {
                showErrorToast(Object.values(passwordValidation.errors)[0]);
                return;
            }
        }

        try {
            const dataToSend = { ...formData };
            if (!isPasswordChange) {
                delete dataToSend.currentPassword;
                delete dataToSend.newPassword;
                delete dataToSend.confirmPassword;
            }

            const response = await fetch(getApiPath('profile'), {
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

            if (avatarFile) {
                const avatarUrl = await uploadAvatar(avatarFile);
                updatedProfile.avatar_image = avatarUrl;
                setAvatarFile(null);
                setAvatarPreview(null);
            }
            // Avatar removal is now handled immediately by handleAvatarRemove
            // No need to handle it here anymore

            setProfile(updatedProfile);

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

            if (
                updatedProfile.appearance !== (isDarkMode ? 'dark' : 'light') &&
                toggleDarkMode
            ) {
                toggleDarkMode();
            }

            if (updatedProfile.language !== i18n.language) {
                await handleLanguageChange(updatedProfile.language);
            }

            if (updatedProfile.pomodoro_enabled !== undefined) {
                window.dispatchEvent(
                    new CustomEvent('pomodoroSettingChanged', {
                        detail: { enabled: updatedProfile.pomodoro_enabled },
                    })
                );
            }

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

            if (avatarFile || removeAvatar) {
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
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

    const tabs: TabConfig[] = [
        {
            id: 'general',
            name: t('profile.tabs.general', 'General'),
            icon: <UserIcon className="w-5 h-5" />,
        },
        {
            id: 'security',
            name: t('profile.tabs.security', 'Security'),
            icon: <ShieldCheckIcon className="w-5 h-5" />,
        },
        {
            id: 'apiKeys',
            name: t('profile.tabs.apiKeys', 'API Keys'),
            icon: <KeyIcon className="w-5 h-5" />,
        },
        {
            id: 'productivity',
            name: t('profile.tabs.productivity', 'Productivity'),
            icon: <ClockIcon className="w-5 h-5" />,
        },
        {
            id: 'notifications',
            name: t('profile.tabs.notifications', 'Notifications'),
            icon: <BellIcon className="w-5 h-5" />,
        },
        {
            id: 'telegram',
            name: t('profile.tabs.telegram', 'Telegram'),
            icon: <TelegramIcon className="w-5 h-5" />,
        },
        {
            id: 'ai',
            name: t('profile.tabs.ai', 'AI Features'),
            icon: <LightBulbIcon className="w-5 h-5" />,
        },
    ];

    return (
        <>
            <div
                className="max-w-5xl mx-auto p-6"
                key={`profile-settings-${updateKey}`}
            >
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
                    {t('profile.title')}
                </h2>

                <TabsNav
                    tabs={tabs}
                    activeTab={activeTab}
                    onChange={(id) => setActiveTab(id)}
                />

                <form onSubmit={handleSubmit} className="space-y-8">
                    <GeneralTab
                        isActive={activeTab === 'general'}
                        formData={formData}
                        onChange={handleChange}
                        onAppearanceChange={(appearance) =>
                            setFormData((prev) => ({ ...prev, appearance }))
                        }
                        onLanguageChange={(languageCode) => {
                            const localeFirstDay =
                                getLocaleFirstDayOfWeek(languageCode);
                            setFormData((prev) => ({
                                ...prev,
                                language: languageCode,
                                first_day_of_week: localeFirstDay,
                            }));
                        }}
                        onTimezoneChange={(timezone) =>
                            setFormData((prev) => ({ ...prev, timezone }))
                        }
                        onFirstDayChange={(value) =>
                            setFormData((prev) => ({
                                ...prev,
                                first_day_of_week: value,
                            }))
                        }
                        avatarPreview={avatarPreview}
                        onAvatarSelect={handleAvatarSelect}
                        onAvatarRemove={handleAvatarRemove}
                        timezonesByRegion={timezonesByRegion}
                        getRegionDisplayName={getRegionDisplayName}
                    />

                    <SecurityTab
                        isActive={activeTab === 'security'}
                        formData={formData}
                        showCurrentPassword={showCurrentPassword}
                        showNewPassword={showNewPassword}
                        showConfirmPassword={showConfirmPassword}
                        onChange={handleChange}
                        onToggleCurrentPassword={() =>
                            setShowCurrentPassword((prev) => !prev)
                        }
                        onToggleNewPassword={() =>
                            setShowNewPassword((prev) => !prev)
                        }
                        onToggleConfirmPassword={() =>
                            setShowConfirmPassword((prev) => !prev)
                        }
                    />

                    <ApiKeysTab
                        isActive={activeTab === 'apiKeys'}
                        apiKeys={apiKeys}
                        apiKeysLoading={apiKeysLoading}
                        generatedApiToken={generatedApiToken}
                        newApiKeyName={newApiKeyName}
                        newApiKeyExpiration={newApiKeyExpiration}
                        revokeInFlightId={revokeInFlightId}
                        deleteInFlightId={deleteInFlightId}
                        pendingDeleteId={apiKeyToDelete?.id ?? null}
                        onCreateApiKey={handleCreateApiKey}
                        onCopyGeneratedToken={handleCopyGeneratedToken}
                        onRevokeApiKey={handleRevokeApiKey}
                        onRequestDelete={(apiKey) => setApiKeyToDelete(apiKey)}
                        onUpdateNewName={setNewApiKeyName}
                        onUpdateNewExpiration={setNewApiKeyExpiration}
                        getApiKeyStatus={getApiKeyStatus}
                        formatDateTime={formatDateTime}
                        isCreatingApiKey={isCreatingApiKey}
                    />

                    <ProductivityTab
                        isActive={activeTab === 'productivity'}
                        pomodoroEnabled={Boolean(formData.pomodoro_enabled)}
                        onTogglePomodoro={() =>
                            setFormData((prev) => ({
                                ...prev,
                                pomodoro_enabled: !prev.pomodoro_enabled,
                            }))
                        }
                    />

                    <NotificationsTab
                        isActive={activeTab === 'notifications'}
                        notificationPreferences={
                            formData.notification_preferences
                        }
                        onChange={(preferences) =>
                            setFormData((prev) => ({
                                ...prev,
                                notification_preferences: preferences,
                            }))
                        }
                    />

                    <TelegramTab
                        isActive={activeTab === 'telegram'}
                        formData={formData}
                        profile={profile}
                        telegramBotInfo={telegramBotInfo}
                        isPolling={isPolling}
                        telegramSetupStatus={telegramSetupStatus}
                        onChange={handleChange}
                        onSetup={handleSetupTelegram}
                        onStartPolling={handleStartPolling}
                        onStopPolling={handleStopPolling}
                        onToggleSummary={() =>
                            setFormData((prev) => ({
                                ...prev,
                                task_summary_enabled:
                                    !prev.task_summary_enabled,
                            }))
                        }
                        onSelectFrequency={(frequency) =>
                            setFormData((prev) => ({
                                ...prev,
                                task_summary_frequency: frequency,
                            }))
                        }
                        onSendTestSummary={handleSendTestSummary}
                        formatFrequency={formatFrequency}
                    />

                    <AiTab
                        isActive={activeTab === 'ai'}
                        formData={formData}
                        onToggle={(field) =>
                            setFormData((prev) => ({
                                ...prev,
                                [field]: !prev[field],
                            }))
                        }
                    />

                    <div className="flex justify-end dark:border-gray-700">
                        <button
                            type="submit"
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
                        >
                            <CheckIcon className="w-5 h-5" />
                            <span>
                                {t('profile.saveChanges', 'Save Changes')}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
            {apiKeyToDelete && (
                <ConfirmDialog
                    title={t('profile.apiKeys.deleteTitle', 'Delete API key')}
                    message={t(
                        'profile.apiKeys.deleteConfirm',
                        'Delete this API key? This action cannot be undone.'
                    )}
                    onConfirm={confirmDeleteApiKey}
                    onCancel={closeDeleteDialog}
                />
            )}
        </>
    );
};

export default ProfileSettings;
