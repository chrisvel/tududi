import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    EyeIcon,
    EyeSlashIcon,
    ArrowPathIcon,
    ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../../config/paths';
import { useToast } from '../../Shared/ToastContext';
import type { CalendarSettings } from '../types';

interface CalendarTabProps {
    isActive: boolean;
    settings: CalendarSettings | null | undefined;
    onChange: (settings: CalendarSettings) => void;
}

const CalendarTab: React.FC<CalendarTabProps> = ({
    isActive,
    settings,
    onChange,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    if (!isActive) return null;

    const currentSettings: CalendarSettings = settings || {
        enabled: false,
        icsUrl: '',
        syncPreset: '6h',
        lastSyncedAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
    };

    const [urlInput, setUrlInput] = useState<string>(
        currentSettings.icsUrl || ''
    );
    const [isRevealed, setIsRevealed] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setUrlInput(newValue);
        setIsRevealed(true);
        onChange({
            ...currentSettings,
            icsUrl: newValue,
            enabled: !!newValue,
        });
    };

    const handleFrequencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        onChange({
            ...currentSettings,
            syncPreset: e.target.value as CalendarSettings['syncPreset'],
        });
    };

    const handleReveal = async () => {
        if (isRevealed) {
            setIsRevealed(false);
            return;
        }

        try {
            const response = await fetch(
                getApiPath('profile/calendar-settings/reveal'),
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (!response.ok) {
                throw new Error('Failed to reveal URL');
            }

            const data = await response.json();
            setUrlInput(data.url);
            setIsRevealed(true);
        } catch (error) {
            showErrorToast('Failed to reveal calendar URL');
        }
    };

    const handleCopy = async () => {
        if (!isRevealed) {
            try {
                const response = await fetch(
                    getApiPath('profile/calendar-settings/reveal'),
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    }
                );

                if (response.ok) {
                    const data = await response.json();
                    await navigator.clipboard.writeText(data.url);
                    showSuccessToast(t('common.copied', 'Copied to clipboard'));
                    return;
                }
            } catch (error) {}
        }

        if (!urlInput) return;

        try {
            await navigator.clipboard.writeText(urlInput);
            showSuccessToast(t('common.copied', 'Copied to clipboard'));
        } catch (err) {
            showErrorToast(t('common.copyFailed', 'Failed to copy'));
        }
    };

    const handleSyncNow = async () => {
        setIsSyncing(true);
        try {
            const response = await fetch(getApiPath('calendar/sync'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (response.status === 409) {
                showSuccessToast(
                    t(
                        'profile.calendar.syncInProgress',
                        'Sync already in progress'
                    )
                );
                return;
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Sync failed');
            }

            const data = await response.json();

            onChange({
                ...currentSettings,
                lastSyncedAt: data.syncedAt,
                lastSyncStatus: 'success',
                lastSyncError: null,
            });

            showSuccessToast(
                t(
                    'profile.calendar.syncSuccess',
                    'Calendar synced successfully'
                )
            );
        } catch (error) {
            const errorMessage = (error as Error).message;
            onChange({
                ...currentSettings,
                lastSyncStatus: 'error',
                lastSyncError: errorMessage,
            });
            showErrorToast(errorMessage);
        } finally {
            setIsSyncing(false);
        }
    };

    const getMaskedUrl = (url: string | null) => {
        if (!url) return '';
        if (url.length <= 12) return url;
        if (url.includes('***')) return url;
        return `${url.substring(0, 8)}***${url.substring(url.length - 4)}`;
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                <CalendarIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.tabs.calendar', 'Calendar Settings')}
            </h3>

            <div className="grid grid-cols-1 gap-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.calendar.icsUrl', 'ICS Calendar URL')}
                    </label>
                    <div className="flex rounded-md shadow-sm">
                        <input
                            type="text"
                            value={
                                isRevealed ? urlInput : getMaskedUrl(urlInput)
                            }
                            onChange={handleUrlChange}
                            className="block w-full rounded-none rounded-l-md border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white px-3 py-2"
                            placeholder="https://..."
                        />
                        <button
                            type="button"
                            onClick={handleReveal}
                            className="relative -ml-px inline-flex items-center space-x-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {isRevealed ? (
                                <>
                                    <EyeSlashIcon
                                        className="h-5 w-5 text-gray-400"
                                        aria-hidden="true"
                                    />
                                    <span>{t('common.hide', 'Hide')}</span>
                                </>
                            ) : (
                                <>
                                    <EyeIcon
                                        className="h-5 w-5 text-gray-400"
                                        aria-hidden="true"
                                    />
                                    <span>{t('common.reveal', 'Reveal')}</span>
                                </>
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="relative -ml-px inline-flex items-center space-x-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            title={t('common.copy', 'Copy')}
                        >
                            <ClipboardDocumentIcon
                                className="h-5 w-5 text-gray-400"
                                aria-hidden="true"
                            />
                        </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'profile.calendar.icsUrlHelp',
                            'Paste your external calendar ICS URL here to sync events.'
                        )}
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('profile.calendar.syncFrequency', 'Sync Frequency')}
                    </label>
                    <select
                        value={currentSettings.syncPreset}
                        onChange={handleFrequencyChange}
                        className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white px-3 py-2"
                    >
                        <option value="15m">
                            15 {t('common.minutes', 'minutes')}
                        </option>
                        <option value="1h">1 {t('common.hour', 'hour')}</option>
                        <option value="6h">
                            6 {t('common.hours', 'hours')}
                        </option>
                        <option value="24h">
                            24 {t('common.hours', 'hours')}
                        </option>
                    </select>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                        {currentSettings.lastSyncedAt ? (
                            <p>
                                {t('profile.calendar.lastSync', 'Last synced')}:{' '}
                                {new Date(
                                    currentSettings.lastSyncedAt
                                ).toLocaleString()}
                                {currentSettings.lastSyncStatus === 'error' && (
                                    <span className="text-red-500 ml-2">
                                        ({t('common.error', 'Error')}:{' '}
                                        {currentSettings.lastSyncError})
                                    </span>
                                )}
                            </p>
                        ) : (
                            <p>
                                {t(
                                    'profile.calendar.neverSynced',
                                    'Never synced'
                                )}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={isSyncing}
                        className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                            isSyncing ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        <ArrowPathIcon
                            className={`h-4 w-4 mr-2 ${
                                isSyncing ? 'animate-spin' : ''
                            }`}
                        />
                        {isSyncing
                            ? t('common.syncing', 'Syncing...')
                            : t('profile.calendar.syncNow', 'Sync Now')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CalendarTab;
