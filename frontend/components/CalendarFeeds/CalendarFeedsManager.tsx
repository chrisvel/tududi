import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ConfirmDialog from '../Shared/ConfirmDialog';
import ColorPicker from '../Shared/ColorPicker';
import {
    CalendarFeed,
    createCalendarFeed,
    deleteCalendarFeed,
    updateCalendarFeed,
} from '../../utils/calendarFeedsService';

interface CalendarFeedsManagerProps {
    feeds: CalendarFeed[];
    loading: boolean;
    onFeedsChange: (update: (feeds: CalendarFeed[]) => CalendarFeed[]) => void;
}

// Rendered inside the profile page's own <form> as well as on the Calendar
// page, so it must not nest a form or use submit buttons: that would submit
// (and reload) the whole profile page.
const CalendarFeedsManager: React.FC<CalendarFeedsManagerProps> = ({
    feeds,
    loading,
    onFeedsChange,
}) => {
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [color, setColor] = useState('');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [toDelete, setToDelete] = useState<CalendarFeed | null>(null);

    const handleAdd = async () => {
        if (saving) return;
        if (!name.trim() || !url.trim()) {
            setFormError(
                t(
                    'profile.calendars.missingFields',
                    'Add a name and the calendar address'
                )
            );
            return;
        }
        setFormError(null);
        setSaving(true);
        try {
            const feed = await createCalendarFeed({
                name,
                url,
                color: color || null,
            });
            onFeedsChange((current) => [...current, feed]);
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
            onFeedsChange((current) =>
                current.filter((f) => f.uid !== feed.uid)
            );
        } catch {
            showErrorToast(
                t(
                    'profile.calendars.deleteError',
                    'Could not remove that calendar'
                )
            );
        }
    };

    const handleToggle = async (feed: CalendarFeed) => {
        const next = !feed.show_on_calendar;
        const apply = (value: boolean) =>
            onFeedsChange((current) =>
                current.map((f) =>
                    f.uid === feed.uid ? { ...f, show_on_calendar: value } : f
                )
            );
        apply(next);
        try {
            await updateCalendarFeed(feed.uid, { show_on_calendar: next });
        } catch {
            apply(!next);
            showErrorToast(
                t(
                    'profile.calendars.toggleError',
                    'Could not update that calendar'
                )
            );
        }
    };

    return (
        <>
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
                            role="switch"
                            aria-checked={feed.show_on_calendar}
                            aria-label={t(
                                'profile.calendars.showOnCalendar',
                                'Show {{name}} on the Calendar page',
                                { name: feed.name }
                            )}
                            title={t(
                                'profile.calendars.showOnCalendarShort',
                                'Show on Calendar page'
                            )}
                            onClick={() => void handleToggle(feed)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                feed.show_on_calendar
                                    ? 'bg-blue-600 dark:bg-blue-500'
                                    : 'bg-gray-200 dark:bg-gray-600'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                    feed.show_on_calendar
                                        ? 'translate-x-[18px]'
                                        : 'translate-x-0.5'
                                }`}
                            />
                        </button>
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

            <section
                className="space-y-4 rounded-lg border border-gray-200 p-5 dark:border-gray-700"
                onKeyDown={(event) => {
                    if (
                        event.key === 'Enter' &&
                        event.target instanceof HTMLInputElement
                    ) {
                        event.preventDefault();
                        void handleAdd();
                    }
                }}
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
                <div>
                    <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        {t('profile.calendars.color', 'Color')}
                    </span>
                    <ColorPicker value={color} onChange={setColor} />
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
                    type="button"
                    onClick={() => void handleAdd()}
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
            </section>

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
        </>
    );
};

export default CalendarFeedsManager;
