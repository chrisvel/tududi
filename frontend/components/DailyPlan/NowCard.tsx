import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon } from '@heroicons/react/24/outline';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import { formatMinute, itemEnd, pickCurrentItem } from './planUtils';

interface NowCardProps {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    now: number;
    onDone: (item: DailyPlanItem) => void;
    onPushLater: (item: DailyPlanItem) => void;
    busyUid: string | null;
}

const NowCard: React.FC<NowCardProps> = ({
    items,
    events,
    now,
    onDone,
    onPushLater,
    busyUid,
}) => {
    const { t } = useTranslation();
    const current = pickCurrentItem(items, now);

    if (!current) {
        return (
            <section className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 px-6 py-5 dark:border-green-900/50 dark:bg-green-900/20">
                <CheckCircleIcon className="h-8 w-8 text-green-700 dark:text-green-400" />
                <div className="flex flex-col gap-1">
                    <span className="text-lg text-gray-900 dark:text-gray-100">
                        {t(
                            'dailyPlan.allDone',
                            'Everything you planned is done'
                        )}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {t(
                            'dailyPlan.allDoneHint',
                            'Pick something from "Not planned" below, or call it a day.'
                        )}
                    </span>
                </div>
            </section>
        );
    }

    const { item, state } = current;
    const hasSlot = item.start_minute !== null;
    const label =
        state === 'now'
            ? t('dailyPlan.now', 'Now')
            : state === 'next'
              ? t('dailyPlan.next', 'Next')
              : t('dailyPlan.upNext', 'Up next');
    const when = hasSlot
        ? `${formatMinute(item.start_minute as number)} – ${formatMinute(itemEnd(item))}`
        : null;

    const details: string[] = [];
    if (item.task.Project?.name) details.push(item.task.Project.name);
    if (state === 'now') {
        details.push(
            t('dailyPlan.minutesLeft', '{{count}} minutes left in this block', {
                count: itemEnd(item) - now,
            })
        );
    }
    const nextEvent = events.find(
        (e) => !e.all_day && e.start_minute !== null && e.start_minute >= now
    );
    if (nextEvent) {
        details.push(
            t('dailyPlan.eventAt', '{{title}} at {{time}}', {
                title: nextEvent.title,
                time: formatMinute(nextEvent.start_minute as number),
            })
        );
    }

    const isBusy = busyUid === item.task_uid;

    return (
        <section
            className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-blue-500 bg-white px-6 py-5 sm:flex-row sm:items-center dark:bg-gray-900"
            data-testid="now-card"
        >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    {label}
                    {when ? ` · ${when}` : ''}
                </span>
                <span className="truncate text-xl text-gray-900 dark:text-gray-100">
                    {item.task.name}
                </span>
                {details.length > 0 && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        {details.join(' · ')}
                    </span>
                )}
            </div>
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => onPushLater(item)}
                    disabled={isBusy}
                    className="min-h-[44px] rounded-lg border border-gray-300 bg-white px-4 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                    {t('dailyPlan.pushLater', 'Push to later')}
                </button>
                <button
                    type="button"
                    onClick={() => onDone(item)}
                    disabled={isBusy}
                    className="min-h-[44px] rounded-lg bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    data-testid="now-card-done"
                >
                    {t('dailyPlan.markDone', 'Mark done')}
                </button>
            </div>
        </section>
    );
};

export default NowCard;
