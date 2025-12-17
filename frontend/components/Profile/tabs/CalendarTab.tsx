import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    InformationCircleIcon,
    CalendarIcon,
    LinkIcon,
    ClipboardDocumentIcon,
    ArrowPathIcon,
    ExclamationTriangleIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import type { ProfileFormData } from '../types';

interface CalendarTabProps {
    isActive: boolean;
    formData: ProfileFormData;
    calendarFeedUrl: string | null;
    onToggleCalendarEnabled: () => void;
    onToggleIcalFeedEnabled: () => void;
    onRegenerateToken: () => Promise<void>;
    isRegenerating: boolean;
}

const CalendarTab: React.FC<CalendarTabProps> = ({
    isActive,
    formData,
    calendarFeedUrl,
    onToggleCalendarEnabled,
    onToggleIcalFeedEnabled,
    onRegenerateToken,
    isRegenerating,
}) => {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

    if (!isActive) return null;

    const handleCopyUrl = async () => {
        if (!calendarFeedUrl) return;
        
        try {
            await navigator.clipboard.writeText(calendarFeedUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    };

    const handleRegenerateClick = () => {
        setShowRegenerateConfirm(true);
    };

    const handleConfirmRegenerate = async () => {
        setShowRegenerateConfirm(false);
        await onRegenerateToken();
    };

    return (
        <div className="mb-8">
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-6 flex items-center">
                <CalendarIcon className="w-6 h-6 mr-3 text-blue-500" />
                {t('profile.calendarSettings', 'Calendar')}
            </h3>

            {/* Calendar View Section */}
            <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <CalendarIcon className="w-5 h-5 mr-2 text-blue-500" />
                    {t('profile.calendarView', 'Calendar View')}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.calendarViewDescription',
                            'Show the Calendar section in the main navigation to see your tasks in a calendar view.'
                        )}
                    </p>
                </div>

                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('profile.enableCalendar', 'Enable Calendar')}
                    </label>
                    <div
                        className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                            formData.calendar_enabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        onClick={onToggleCalendarEnabled}
                    >
                        <span
                            className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                formData.calendar_enabled
                                    ? 'translate-x-6'
                                    : 'translate-x-0'
                            }`}
                        ></span>
                    </div>
                </div>
            </div>

            {/* iCal Feed Section */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                    <LinkIcon className="w-5 h-5 mr-2 text-green-500" />
                    {t('profile.icalFeed', 'iCalendar Feed')}
                </h4>

                <div className="mb-4 text-sm text-gray-600 dark:text-gray-300 flex items-start">
                    <InformationCircleIcon className="h-5 w-5 mr-2 flex-shrink-0 text-blue-500" />
                    <p>
                        {t(
                            'profile.icalFeedDescription',
                            'Subscribe to your tasks in Apple Calendar, Google Calendar, Outlook, or any app that supports iCal feeds.'
                        )}
                    </p>
                </div>

                <div className="mb-4 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('profile.enableIcalFeed', 'Enable iCal Feed')}
                    </label>
                    <div
                        className={`relative inline-block w-12 h-6 transition-colors duration-200 ease-in-out rounded-full cursor-pointer ${
                            formData.ical_feed_enabled
                                ? 'bg-blue-500'
                                : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                        onClick={onToggleIcalFeedEnabled}
                    >
                        <span
                            className={`absolute left-0 top-0 bottom-0 m-1 w-4 h-4 transition-transform duration-200 ease-in-out transform bg-white rounded-full ${
                                formData.ical_feed_enabled
                                    ? 'translate-x-6'
                                    : 'translate-x-0'
                            }`}
                        ></span>
                    </div>
                </div>

                {/* Feed URL and options - only shown when enabled */}
                {formData.ical_feed_enabled && calendarFeedUrl && (
                    <div className="space-y-4">
                        {/* Feed URL */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                {t('profile.feedUrl', 'Feed URL')}
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    readOnly
                                    value={calendarFeedUrl}
                                    className="flex-1 block w-full border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono"
                                />
                                <button
                                    type="button"
                                    onClick={handleCopyUrl}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 flex items-center gap-1 text-sm"
                                >
                                    {copied ? (
                                        <>
                                            <CheckIcon className="w-4 h-4" />
                                            {t('common.copied', 'Copied!')}
                                        </>
                                    ) : (
                                        <>
                                            <ClipboardDocumentIcon className="w-4 h-4" />
                                            {t('common.copy', 'Copy')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Security Warning */}
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-md">
                            <div className="flex items-start">
                                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mr-2 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                    {t(
                                        'profile.feedUrlWarning',
                                        'Keep this URL private. Anyone with this link can view your tasks.'
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Regenerate Token */}
                        <div>
                            {!showRegenerateConfirm ? (
                                <button
                                    type="button"
                                    onClick={handleRegenerateClick}
                                    disabled={isRegenerating}
                                    className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2"
                                >
                                    <ArrowPathIcon className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                                    {t('profile.regenerateUrl', 'Regenerate URL')}
                                </button>
                            ) : (
                                <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
                                    <p className="text-sm text-red-800 dark:text-red-200 mb-3">
                                        {t(
                                            'profile.regenerateWarning',
                                            'Regenerating will create a new URL and break any existing calendar subscriptions. You will need to re-add the calendar in your apps.'
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={handleConfirmRegenerate}
                                            disabled={isRegenerating}
                                            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center gap-1"
                                        >
                                            <ArrowPathIcon className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                                            {isRegenerating
                                                ? t('common.regenerating', 'Regenerating...')
                                                : t('common.confirm', 'Confirm')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowRegenerateConfirm(false)}
                                            disabled={isRegenerating}
                                            className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* How to Subscribe Instructions */}
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
                            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                                {t('profile.howToSubscribe', 'How to subscribe')}
                            </h5>
                            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                                <li>
                                    <span className="font-medium">Apple Calendar:</span>{' '}
                                    {t('profile.appleCalendarInstructions', 'File → New Calendar Subscription → paste URL')}
                                </li>
                                <li>
                                    <span className="font-medium">Google Calendar:</span>{' '}
                                    {t('profile.googleCalendarInstructions', 'Other calendars (+) → From URL → paste URL')}
                                </li>
                                <li>
                                    <span className="font-medium">Outlook:</span>{' '}
                                    {t('profile.outlookInstructions', 'Add calendar → Subscribe from web → paste URL')}
                                </li>
                            </ul>
                        </div>

                        {/* What's Included */}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                            <p className="font-medium mb-1">
                                {t('profile.feedIncludes', 'Your feed includes:')}
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 ml-2">
                                <li>{t('profile.feedIncludesTasks', 'All tasks with due dates')}</li>
                                <li>{t('profile.feedIncludesRecurrence', 'Recurring task patterns')}</li>
                                <li>{t('profile.feedIncludesProjects', 'Project information')}</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalendarTab;
