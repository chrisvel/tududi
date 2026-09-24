import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClockIcon } from '@heroicons/react/24/outline';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import { PlanCandidates } from '../../utils/dailyPlanService';
import { formatDuration, formatMinute } from './planUtils';

interface TodayUnplannedProps {
    candidates: PlanCandidates | null;
    events: CalendarEvent[];
    freeMinutes: number;
    hasFeeds: boolean;
    hasDraft: boolean;
}

const Stat: React.FC<{
    value: string | number;
    label: string;
    tone: 'red' | 'amber' | 'gray' | 'blue';
}> = ({ value, label, tone }) => {
    const tones = {
        red: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300',
        amber: 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300',
        gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        blue: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
    };
    return (
        <div className={`rounded-lg p-3.5 flex flex-col gap-1 ${tones[tone]}`}>
            <span className="text-2xl font-medium">{value}</span>
            <span className="text-sm opacity-90">{label}</span>
        </div>
    );
};

const TodayUnplanned: React.FC<TodayUnplannedProps> = ({
    candidates,
    events,
    freeMinutes,
    hasFeeds,
    hasDraft,
}) => {
    const { t } = useTranslation();
    const timedEvents = events.filter((e) => !e.all_day);
    const allDay = events.filter((e) => e.all_day);

    return (
        <section
            className="mx-auto mt-6 sm:mt-10 w-full max-w-2xl rounded-2xl bg-white p-6 sm:p-10 flex flex-col gap-7 dark:bg-gray-900"
            data-testid="today-unplanned"
        >
            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {hasDraft
                        ? t('dailyPlan.draftKicker', 'Almost there')
                        : t('dailyPlan.morningKicker', 'Good morning')}
                </p>
                <h2 className="text-2xl font-normal text-gray-900 dark:text-gray-100">
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
                <p className="text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {t(
                        'dailyPlan.unplannedBody',
                        "Pick what you'll actually do, give each a rough length, and fit it around your meetings. Everything else stays out of sight until you need it."
                    )}
                </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat
                    value={candidates?.overdue.length ?? '·'}
                    label={t('dailyPlan.overdue', 'Overdue')}
                    tone="red"
                />
                <Stat
                    value={candidates?.due_today.length ?? '·'}
                    label={t('dailyPlan.dueToday', 'Due today')}
                    tone="amber"
                />
                <Stat
                    value={candidates?.inbox_count ?? '·'}
                    label={t('dailyPlan.inInbox', 'In inbox')}
                    tone="gray"
                />
                <Stat
                    value={formatDuration(freeMinutes)}
                    label={t('dailyPlan.freeToday', 'Free today')}
                    tone="blue"
                />
            </div>

            {hasFeeds ? (
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
                            className="flex gap-3 text-sm"
                        >
                            <span className="w-28 shrink-0 text-gray-500 dark:text-gray-400">
                                {formatMinute(event.start_minute ?? 0)}–
                                {formatMinute(event.end_minute ?? 0)}
                            </span>
                            <span className="text-gray-800 dark:text-gray-200">
                                {event.title}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
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
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-blue-600 px-5 text-[15px] font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    data-testid="plan-your-day"
                >
                    <ClockIcon className="h-5 w-5" />
                    {hasDraft
                        ? t('dailyPlan.continuePlanning', 'Continue planning')
                        : t('dailyPlan.planYourDay', 'Plan your day')}
                </Link>
                <Link
                    to="/today_legacy"
                    className="text-sm text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
                >
                    {t(
                        'dailyPlan.skipShowEverything',
                        'Skip and show everything'
                    )}
                </Link>
            </div>
        </section>
    );
};

export default TodayUnplanned;
