import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import { PlanCandidates } from '../../utils/dailyPlanService';
import { formatDuration, formatMinute } from './planUtils';
import CalendarBadge from './CalendarBadge';

interface TodayUnplannedProps {
    candidates: PlanCandidates | null;
    events: CalendarEvent[];
    freeMinutes: number;
    hasFeeds: boolean;
    showsFeeds: boolean;
    calendarEnabled: boolean;
    hasDraft: boolean;
}

// A quiet figure: colour only marks something that needs a look.
const Stat: React.FC<{
    value: string | number;
    label: string;
    alert?: boolean;
}> = ({ value, label, alert = false }) => (
    <div className="flex flex-col gap-0.5">
        <span
            className={`text-2xl font-semibold tabular-nums tracking-tight ${
                alert
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'
            }`}
        >
            {value}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
            {label}
        </span>
    </div>
);

const TodayUnplanned: React.FC<TodayUnplannedProps> = ({
    candidates,
    events,
    freeMinutes,
    hasFeeds,
    showsFeeds,
    calendarEnabled,
    hasDraft,
}) => {
    const { t } = useTranslation();
    const timedEvents = events.filter((e) => !e.all_day);
    const allDay = events.filter((e) => e.all_day);

    return (
        <section
            className="mx-auto mt-6 sm:mt-12 w-full max-w-2xl rounded-3xl bg-white p-6 sm:p-12 flex flex-col gap-8 dark:bg-gray-900"
            data-testid="today-unplanned"
        >
            <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    {hasDraft
                        ? t('dailyPlan.draftKicker', 'Almost there')
                        : t('dailyPlan.morningKicker', 'Good morning')}
                </p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                    {hasDraft
                        ? t(
                              'dailyPlan.draftTitle',
                              "Your plan for today isn't started yet"
                          )
                        : t(
                              'dailyPlan.unplannedTitle',
                              "You haven't planned today yet"
                          )}
                </h2>
                <p className="max-w-xl text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {t(
                        'dailyPlan.unplannedBody',
                        "Pick what you'll actually do, give each a rough length, and fit it around your meetings. Everything else stays out of sight until you need it."
                    )}
                </p>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 rounded-2xl bg-gray-50 px-5 py-4 sm:grid-cols-4 dark:bg-gray-800/60">
                <Stat
                    value={candidates?.overdue.length ?? '·'}
                    label={t('dailyPlan.overdue', 'Overdue')}
                    alert={(candidates?.overdue.length ?? 0) > 0}
                />
                <Stat
                    value={candidates?.due_today.length ?? '·'}
                    label={t('dailyPlan.dueToday', 'Due today')}
                />
                <Stat
                    value={candidates?.inbox_count ?? '·'}
                    label={t('dailyPlan.inInbox', 'In inbox')}
                />
                <Stat
                    value={formatDuration(freeMinutes)}
                    label={t('dailyPlan.freeToday', 'Free today')}
                />
            </div>

            {calendarEnabled && showsFeeds && (
                <div className="flex flex-col gap-2">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('dailyPlan.fromCalendar', 'From your calendar')}
                    </p>
                    {allDay.map((event) => (
                        <div
                            key={`${event.feed_uid}-${event.uid}-${event.start}`}
                            className="text-sm text-gray-700 dark:text-gray-300"
                        >
                            {t('dailyPlan.allDay', 'All day')} · {event.title}
                        </div>
                    ))}
                    {timedEvents.length === 0 && allDay.length === 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {t('dailyPlan.noMeetings', 'No meetings today.')}
                        </p>
                    )}
                    {timedEvents.map((event) => (
                        <div
                            key={`${event.feed_uid}-${event.uid}-${event.start}`}
                            className="flex items-center gap-3 text-sm"
                        >
                            <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
                                {formatMinute(event.start_minute ?? 0)}–
                                {formatMinute(event.end_minute ?? 0)}
                            </span>
                            <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                                {event.title}
                            </span>
                            <CalendarBadge
                                name={event.feed_name}
                                color={event.color}
                            />
                        </div>
                    ))}
                </div>
            )}
            {calendarEnabled && !hasFeeds && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t(
                        'dailyPlan.connectCalendarHint',
                        'Want your meetings here too?'
                    )}{' '}
                    <Link
                        to="/profile?section=calendars"
                        className="text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                    >
                        {t('dailyPlan.connectCalendar', 'Connect a calendar')}
                    </Link>
                </p>
            )}

            <div className="flex flex-wrap items-center gap-5">
                <Link
                    to="/today/plan"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-gray-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-blue-400"
                    data-testid="plan-your-day"
                >
                    <ClockIcon className="h-4 w-4" />
                    {hasDraft
                        ? t('dailyPlan.continuePlanning', 'Continue planning')
                        : t('dailyPlan.planYourDay', 'Plan your day')}
                </Link>
            </div>
        </section>
    );
};

export default TodayUnplanned;
