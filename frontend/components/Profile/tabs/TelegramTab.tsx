import React, { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
    InformationCircleIcon,
    CogIcon,
    ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import TelegramIcon from '../../Icons/TelegramIcon';
import type { Profile, ProfileFormData, TelegramBotInfo } from '../types';

interface TelegramTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    profile: Profile | null;
    telegramBotInfo: TelegramBotInfo | null;
    isPolling: boolean;
    telegramSetupStatus: 'idle' | 'loading' | 'success' | 'error';
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onSetup: () => void;
    onStartPolling: () => void;
    onStopPolling: () => void;
    onToggleSummary: () => void;
    onSelectFrequency: (frequency: string) => void;
    onSendTestSummary: () => void;
    formatFrequency: (frequency: string) => string;
}

const TelegramTab: React.FC<TelegramTabProps> = ({
    isActive,
    formData,
    profile,
    telegramBotInfo,
    isPolling,
    telegramSetupStatus,
    onChange,
    onSetup,
    onStartPolling,
    onStopPolling,
    onToggleSummary,
    onSelectFrequency,
    onSendTestSummary,
    formatFrequency,
}) => {
    const { t } = useTranslation();

    if (!isActive) return null;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-blue-300 dark:border-blue-700 mb-8">
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-6 flex items-center">
                <TelegramIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.telegramIntegration', 'Telegram Integration')}
            </h3>

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
                            value={formData.telegram_bot_token || ''}
                            onChange={onChange}
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
                            {t('profile.telegramAllowedUsers', 'Allowed Users')}
                        </label>
                        <input
                            type="text"
                            name="telegram_allowed_users"
                            value={formData.telegram_allowed_users || ''}
                            onChange={onChange}
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
                                    {t('profile.examples', 'Examples:')}
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

                    {(telegramBotInfo || profile?.telegram_bot_token) && (
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
                                                ? t('profile.pollingActive')
                                                : t('profile.pollingInactive')}
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
                                                onClick={onStopPolling}
                                                className="px-3 py-1 bg-red-600 text-white dark:bg-red-700 rounded text-sm hover:bg-red-700 dark:hover:bg-red-800"
                                            >
                                                {t(
                                                    'profile.stopPolling',
                                                    'Stop Polling'
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={onStartPolling}
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
                                                href={telegramBotInfo.chat_url}
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
                        onClick={onSetup}
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
                            ? t('profile.settingUp', 'Setting up...')
                            : t('profile.setupTelegram', 'Setup Telegram')}
                    </button>

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
                                {t(
                                    'profile.botConfigured',
                                    'Bot configured successfully!'
                                )}
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
                                {t(
                                    'profile.telegramSetupFailed',
                                    'Setup failed. Please check your token.'
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </div>

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
                        onClick={onToggleSummary}
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
                        {t('profile.summaryFrequency', 'Summary Frequency')}
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {['1h', '2h', '4h', '8h', '12h', 'daily', 'weekly'].map(
                            (frequency) => (
                                <button
                                    key={frequency}
                                    type="button"
                                    className={`px-3 py-1.5 text-sm rounded-full ${
                                        formData.task_summary_frequency ===
                                        frequency
                                            ? 'bg-blue-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                    }`}
                                    onClick={() => onSelectFrequency(frequency)}
                                >
                                    {t(
                                        `profile.frequency.${frequency}`,
                                        formatFrequency(frequency)
                                    )}
                                </button>
                            )
                        )}
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
                        onClick={onSendTestSummary}
                    >
                        {t('profile.sendTestSummary', 'Send Test Summary')}
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
    );
};

export default TelegramTab;
