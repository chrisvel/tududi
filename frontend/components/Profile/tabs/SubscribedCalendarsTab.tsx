import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import {
    SubscribedCalendar,
    createSubscribedCalendar,
    deleteSubscribedCalendar,
    fetchSubscribedCalendars,
} from '../../../utils/subscribedCalendarService';

interface SubscribedCalendarsTabProps {
    isActive: boolean;
}

const COLORS = [
    '#6b7280',
    '#ef4444',
    '#f59e0b',
    '#22c55e',
    '#3b82f6',
    '#8b5cf6',
];

const SubscribedCalendarsTab: React.FC<SubscribedCalendarsTabProps> = ({
    isActive,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [calendars, setCalendars] = useState<SubscribedCalendar[]>([]);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [color, setColor] = useState(COLORS[0]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (isActive) {
            loadCalendars();
        }
    }, [isActive]);

    const loadCalendars = async () => {
        try {
            setCalendars(await fetchSubscribedCalendars());
        } catch {
            showErrorToast(
                t(
                    'subscribedCalendars.loadError',
                    'Failed to load subscribed calendars'
                )
            );
        }
    };

    const handleAdd = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSaving(true);
        try {
            await createSubscribedCalendar({ name, url, color });
            setName('');
            setUrl('');
            setColor(COLORS[0]);
            await loadCalendars();
            showSuccessToast(
                t('subscribedCalendars.added', 'Calendar subscribed')
            );
        } catch (error: any) {
            showErrorToast(
                error?.message ||
                    t('subscribedCalendars.addError', 'Failed to subscribe')
            );
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (calendar: SubscribedCalendar) => {
        try {
            await deleteSubscribedCalendar(calendar.uid);
            await loadCalendars();
            showSuccessToast(
                t('subscribedCalendars.removed', 'Subscription removed')
            );
        } catch {
            showErrorToast(
                t(
                    'subscribedCalendars.deleteError',
                    'Failed to remove calendar'
                )
            );
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center">
                    <CalendarDaysIcon className="w-5 h-5 mr-2" />
                    {t('subscribedCalendars.title', 'Subscribed Calendars')}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'subscribedCalendars.description',
                        'Show events from an external calendar in your tududi calendar. Paste the iCalendar (.ics) address of any calendar that supports it, such as Google Calendar, Apple iCloud or Nextcloud. Events are read-only.'
                    )}
                </p>
            </div>

            <form onSubmit={handleAdd} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('subscribedCalendars.name', 'Name')}
                    </label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                        placeholder={t(
                            'subscribedCalendars.namePlaceholder',
                            'Work calendar'
                        )}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('subscribedCalendars.url', 'iCalendar URL')}
                    </label>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100"
                        placeholder="https://example.com/calendar.ics"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('subscribedCalendars.color', 'Color')}
                    </label>
                    <div className="mt-2 flex gap-2">
                        {COLORS.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => setColor(option)}
                                aria-label={option}
                                className={`w-7 h-7 rounded-full border-2 ${
                                    color === option
                                        ? 'border-gray-900 dark:border-gray-100'
                                        : 'border-transparent'
                                }`}
                                style={{ backgroundColor: option }}
                            />
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                    {t('subscribedCalendars.add', 'Add calendar')}
                </button>
            </form>

            <div className="space-y-3">
                {calendars.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'subscribedCalendars.empty',
                            'No subscribed calendars yet.'
                        )}
                    </p>
                )}

                {calendars.map((calendar) => (
                    <div
                        key={calendar.uid}
                        className="flex items-center justify-between rounded-md border border-gray-200 dark:border-gray-700 p-3"
                    >
                        <div className="min-w-0">
                            <div className="flex items-center">
                                <span
                                    className="w-3 h-3 rounded-full mr-2 shrink-0"
                                    style={{ backgroundColor: calendar.color }}
                                />
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {calendar.name}
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {calendar.url}
                            </p>
                            {calendar.last_error && (
                                <p className="text-xs text-red-600 dark:text-red-400">
                                    {calendar.last_error}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => handleDelete(calendar)}
                                aria-label={t(
                                    'subscribedCalendars.remove',
                                    'Remove'
                                )}
                                className="text-gray-400 hover:text-red-600"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SubscribedCalendarsTab;
