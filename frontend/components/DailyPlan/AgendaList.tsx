import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import TaskRow from '../Task/TaskRow';
import {
    buildAgenda,
    formatDuration,
    formatMinute,
    isItemDone,
    itemEnd,
    pickCurrentItem,
} from './planUtils';

interface AgendaListProps {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    now: number;
    projects: Project[];
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskDelete: (taskUid: string) => Promise<void>;
}

// A timed block whose end has passed while the task is still open.
export const isItemLate = (item: DailyPlanItem, now: number): boolean =>
    item.start_minute !== null && itemEnd(item) <= now && !isItemDone(item);

const AgendaList: React.FC<AgendaListProps> = ({
    items,
    events,
    now,
    projects,
    onTaskUpdate,
    onTaskDelete,
}) => {
    const { t } = useTranslation();
    const agenda = buildAgenda(items, events);
    const current = pickCurrentItem(items, now);
    const currentUid =
        current && current.state === 'now' ? current.item.task_uid : null;

    if (agenda.length === 0) return null;

    return (
        <section className="flex flex-col gap-2" data-testid="agenda-list">
            {agenda.map((entry) => {
                if (entry.kind === 'event') {
                    const { event } = entry;
                    return (
                        <div
                            key={`event-${event.feed_uid}-${event.uid}-${event.start}`}
                            className="flex items-center gap-3"
                        >
                            <span className="w-32 shrink-0 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                {formatMinute(event.start_minute ?? 0)}–
                                {formatMinute(event.end_minute ?? 0)}
                            </span>
                            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-dashed border-gray-200 px-3 py-2 dark:border-gray-800">
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
                        </div>
                    );
                }

                const { item } = entry;
                const isCurrent = item.task_uid === currentUid;
                const late = isItemLate(item, now);
                const when =
                    item.start_minute !== null
                        ? `${formatMinute(item.start_minute)} · ${formatDuration(item.duration_minutes)}`
                        : `${t('dailyPlan.anytime', 'Anytime')} · ${formatDuration(item.duration_minutes)}`;

                return (
                    <div
                        key={`task-${item.task_uid}`}
                        className="flex items-start gap-3"
                        data-testid={`agenda-task-${item.task_uid}`}
                    >
                        <span
                            className={`flex w-32 shrink-0 items-center gap-1.5 whitespace-nowrap pt-3 text-sm ${
                                late
                                    ? 'font-medium text-amber-700 dark:text-amber-400'
                                    : isCurrent
                                      ? 'font-medium text-blue-700 dark:text-blue-400'
                                      : 'text-gray-600 dark:text-gray-400'
                            }`}
                        >
                            {when}
                            {late && (
                                <ExclamationTriangleIcon
                                    className="h-4 w-4 shrink-0"
                                    aria-label={t(
                                        'dailyPlan.lateWarning',
                                        'Time passed and not done yet'
                                    )}
                                    data-testid={`late-${item.task_uid}`}
                                />
                            )}
                        </span>
                        <div
                            className={`min-w-0 flex-1 rounded-lg ${
                                isCurrent
                                    ? 'ring-2 ring-blue-500/60'
                                    : late
                                      ? 'ring-1 ring-amber-500/50'
                                      : ''
                            }`}
                        >
                            <TaskRow
                                task={item.task}
                                projects={projects}
                                onTaskUpdate={onTaskUpdate}
                                onTaskCompletionToggle={(task) => {
                                    void onTaskUpdate(task);
                                }}
                                onTaskDelete={onTaskDelete}
                                compact
                            />
                        </div>
                    </div>
                );
            })}
        </section>
    );
};

export default AgendaList;
