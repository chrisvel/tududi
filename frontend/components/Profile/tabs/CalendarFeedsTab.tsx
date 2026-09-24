import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDaysIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import ConfirmDialog from '../../Shared/ConfirmDialog';
import {
    CalendarFeed,
    createCalendarFeed,
    deleteCalendarFeed,
    fetchCalendarFeeds,
} from '../../../utils/calendarFeedsService';

interface CalendarFeedsTabProps {
    isActive: boolean;
}

const CalendarFeedsTab: React.FC<CalendarFeedsTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [color, setColor] = useState('#6b7280');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<CalendarFeed | null>(null);

    useEffect(() => {
        if (!isActive) return;
        setLoading(true);
        fetchCalendarFeeds()
            .then(setFeeds)
            .catch(() =>
                showErrorToast(
                    t('profile.calendars.loadError', 'Could not load calendars')
                )
            )
            .finally(() => setLoading(false));
    }, [isActive]);

    if (!isActive) return null;

    const handleAdd = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormError(null);
        setSaving(true);
        try {
            const feed = await createCalendarFeed({ name, url, color });
            setFeeds((current) => [...current, feed]);
            setName('');
            setUrl('');
            showSuccessToast(
                t('profile.calendars.added', 'Calendar connected')
            );
        } catch (err) {
            setFormError(
                err instanceof Error
                    ? err.message
                    : t(
                          'profile.calendars.addError',
                          'Could not add that calendar'
                      )
            );
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        const feed = toDelete;
        setToDelete(null);
        try {
            await deleteCalendarFeed(feed.uid);
            setFeeds((current) => current.filter((f) => f.uid !== feed.uid));
        } catch {
            showErrorToast(
                t(
                    'profile.calendars.deleteError',
                    'Could not remove that calendar'
                )
            );
        }
    };

    return (
        <div>
            <h3 className="mb-6 flex items-center text-xl font-semibold text-gray-900 dark:text-white">
                <CalendarDaysIcon className="mr-3 h-6 w-6 text-blue-500" />
                {t('profile.calendars.title', 'Calendars on Today')}
            </h3>

            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                {t(
                    'profile.calendars.description',
                    'Show your meetings next to your day plan. Tududi only reads these calendars; it never changes them.'
                )}
            </p>

            <div className="mb-8 space-y-3">
                {loading && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('common.loading', 'Loading...')}
                    </p>
                )}
                {!loading && feeds.length === 0 && (
                    <p className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {t(
                            'profile.calendars.empty',
                            'No calendars connected yet.'
                        )}
                    </p>
                )}
                {feeds.map((feed) => (
                    <div
                        key={feed.uid}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                    >
                        <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: feed.color || '#6b7280' }}
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {feed.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {feed.url_host}
                                {feed.last_error
                                    ? ` · ${feed.last_error}`
                                    : feed.last_fetched_at
                                      ? ` · ${t(
                                            'profile.calendars.lastSync',
                                            'updated {{time}}',
                                            {
                                                time: new Date(
                                                    feed.last_fetched_at
                                                ).toLocaleString(),
                                            }
                                        )}`
                                      : ''}
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setToDelete(feed)}
                            aria-label={t(
                                'profile.calendars.remove',
                                'Remove {{name}}',
                                {
                                    name: feed.name,
                                }
                            )}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-gray-700"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            <form
                onSubmit={handleAdd}
                className="space-y-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700"
            >
                <h4 className="text-base font-medium text-gray-900 dark:text-white">
                    {t('profile.calendars.addTitle', 'Connect a calendar')}
                </h4>
                <div>
                    <label
                        htmlFor="calendar-feed-name"
                        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {t('profile.calendars.name', 'Name')}
                    </label>
                    <input
                        id="calendar-feed-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t(
                            'profile.calendars.namePlaceholder',
                            'Work, Family…'
                        )}
                        required
                        maxLength={100}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    />
                </div>
                <div>
                    <label
                        htmlFor="calendar-feed-url"
                        className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {t('profile.calendars.url', 'Secret iCal address')}
                    </label>
                    <input
                        id="calendar-feed-url"
                        type="url"
                        inputMode="url"
                        autoComplete="off"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
                        required
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                        aria-describedby="calendar-feed-url-help"
                    />
                    <p
                        id="calendar-feed-url-help"
                        className="mt-1.5 text-xs text-gray-600 dark:text-gray-400"
                    >
                        {t(
                            'profile.calendars.googleHelp',
                            'In Google Calendar: Settings → your calendar → Integrate calendar → "Secret address in iCal format". Apple Calendar and Outlook have similar links. Anyone with this address can read the calendar, so tududi stores it encrypted.'
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <label
                        htmlFor="calendar-feed-color"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {t('profile.calendars.color', 'Color')}
                    </label>
                    <input
                        id="calendar-feed-color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="h-8 w-12 cursor-pointer rounded border border-gray-300 dark:border-gray-600"
                    />
                </div>
                {formError && (
                    <p
                        className="text-sm text-red-600 dark:text-red-400"
                        role="alert"
                    >
                        {formError}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex min-h-[40px] items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                    {saving
                        ? t(
                              'profile.calendars.checking',
                              'Checking the calendar…'
                          )
                        : t('profile.calendars.add', 'Connect')}
                </button>
            </form>

            {toDelete && (
                <ConfirmDialog
                    title={t(
                        'profile.calendars.removeTitle',
                        'Remove calendar'
                    )}
                    message={t(
                        'profile.calendars.removeMessage',
                        'Stop showing "{{name}}" on Today? The calendar itself is not touched.',
                        { name: toDelete.name }
                    )}
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                    confirmButtonText={t(
                        'profile.calendars.removeConfirm',
                        'Remove'
                    )}
                />
            )}
        </div>
    );
};

export default CalendarFeedsTab;
