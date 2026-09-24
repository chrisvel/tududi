import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    CheckCircleIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import {
    buildAgenda,
    formatDuration,
    formatMinute,
    isItemDone,
    pickCurrentItem,
} from './planUtils';

interface AgendaListProps {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    now: number;
    onToggleDone: (item: DailyPlanItem) => void;
}

const AgendaList: React.FC<AgendaListProps> = ({
    items,
    events,
    now,
    onToggleDone,
}) => {
    const { t } = useTranslation();
    const agenda = buildAgenda(items, events);
    const current = pickCurrentItem(items, now);
    const currentUid =
        current && current.state === 'now' ? current.item.task_uid : null;

    if (agenda.length === 0) return null;

    return (
        <section
            className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
            data-testid="agenda-list"
        >
            {agenda.map((entry, index) => {
                const divider =
                    index < agenda.length - 1
                        ? 'border-b border-gray-100 dark:border-gray-800'
                        : '';

                if (entry.kind === 'event') {
                    const { event } = entry;
                    return (
                        <div
                            key={`event-${event.feed_uid}-${event.uid}-${event.start}`}
                            className={`flex items-center gap-4 px-5 py-3 ${divider}`}
                        >
                            <span className="w-28 shrink-0 text-sm text-gray-500 dark:text-gray-400">
                                {formatMinute(event.start_minute ?? 0)}–
                                {formatMinute(event.end_minute ?? 0)}
                            </span>
                            <CalendarIcon
                                className="h-5 w-5 shrink-0 text-gray-500"
                                aria-label={t(
                                    'dailyPlan.calendarEvent',
                                    'Calendar event'
                                )}
                            />
                            <span className="truncate text-sm text-gray-600 dark:text-gray-400">
                                {event.title}
                            </span>
                        </div>
                    );
                }

                const { item } = entry;
                const done = isItemDone(item);
                const isCurrent = item.task_uid === currentUid;
                const when =
                    item.start_minute !== null
                        ? `${formatMinute(item.start_minute)} · ${formatDuration(item.duration_minutes)}`
                        : `${t('dailyPlan.anytime', 'Anytime')} · ${formatDuration(item.duration_minutes)}`;

                return (
                    <div
                        key={`task-${item.task_uid}`}
                        className={`flex items-center gap-4 px-5 py-3 ${divider} ${
                            isCurrent ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                    >
                        <span
                            className={`w-28 shrink-0 text-sm ${
                                isCurrent
                                    ? 'font-medium text-blue-700 dark:text-blue-400'
                                    : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {when}
                        </span>
                        <button
                            type="button"
                            onClick={() => onToggleDone(item)}
                            aria-label={
                                done
                                    ? t(
                                          'dailyPlan.markNotDone',
                                          'Mark as not done'
                                      )
                                    : t('dailyPlan.markDone', 'Mark done')
                            }
                            className="shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        >
                            {done ? (
                                <CheckCircleSolid className="h-5 w-5 text-green-600" />
                            ) : isCurrent ? (
                                <ClockIcon className="h-5 w-5 text-blue-600" />
                            ) : (
                                <CheckCircleIcon className="h-5 w-5 text-gray-400 hover:text-green-600" />
                            )}
                        </button>
                        <Link
                            to={`/task/${item.task_uid}`}
                            className={`min-w-0 flex-1 truncate text-sm hover:underline ${
                                done
                                    ? 'text-gray-500 line-through dark:text-gray-500'
                                    : isCurrent
                                      ? 'font-medium text-blue-900 dark:text-blue-200'
                                      : 'text-gray-900 dark:text-gray-100'
                            }`}
                        >
                            {item.task.name}
                        </Link>
                        {item.task.Project?.name && (
                            <span className="hidden truncate text-xs text-gray-500 sm:inline dark:text-gray-400">
                                {item.task.Project.name}
                            </span>
                        )}
                    </div>
                );
            })}
        </section>
    );
};

export default AgendaList;
