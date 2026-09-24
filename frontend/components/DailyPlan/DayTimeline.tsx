import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import { CalendarEvent } from '../../utils/calendarFeedsService';
import {
    SLOT_MINUTES,
    formatDuration,
    formatMinute,
    freeGaps,
} from './planUtils';

export const PX_PER_HOUR = 64;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;

interface DayTimelineProps {
    items: DailyPlanItem[];
    events: CalendarEvent[];
    range: { start: number; end: number };
    now: number | null;
    onResize: (taskUid: string, duration: number) => void;
    onRemove: (taskUid: string) => void;
    aiReasons?: Record<string, string>;
}

interface BlockProps {
    item: DailyPlanItem;
    range: { start: number; end: number };
    maxDuration: number;
    onResize: (duration: number) => void;
    onRemove: () => void;
    aiReason?: string;
}

const TimelineBlock: React.FC<BlockProps> = ({
    item,
    range,
    maxDuration,
    onResize,
    onRemove,
    aiReason,
}) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, transform, isDragging } =
        useDraggable({
            id: `item:${item.task_uid}`,
            data: { type: 'item', item },
        });
    const [previewDuration, setPreviewDuration] = React.useState<number | null>(
        null
    );
    const duration = previewDuration ?? item.duration_minutes;
    const top = ((item.start_minute as number) - range.start) * PX_PER_MINUTE;
    const height = Math.max(18, duration * PX_PER_MINUTE - 2);
    const compact = height < 44;

    // Resizing is plain pointer tracking on the bottom edge, snapped to the
    // 15-minute grid and stopped short of the next planned block.
    const startResize = (event: React.PointerEvent) => {
        event.stopPropagation();
        event.preventDefault();
        const startY = event.clientY;
        const startDuration = item.duration_minutes;
        let latest = startDuration;
        const move = (e: PointerEvent) => {
            const delta = (e.clientY - startY) / PX_PER_MINUTE;
            latest = Math.min(
                maxDuration,
                Math.max(
                    SLOT_MINUTES,
                    Math.round((startDuration + delta) / SLOT_MINUTES) *
                        SLOT_MINUTES
                )
            );
            setPreviewDuration(latest);
        };
        const up = () => {
            window.removeEventListener('pointermove', move);
            window.removeEventListener('pointerup', up);
            setPreviewDuration(null);
            if (latest !== startDuration) onResize(latest);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
    };

    return (
        <div
            ref={setNodeRef}
            className={`group absolute left-1 right-1 rounded-md border border-blue-500 bg-blue-100 text-blue-950 dark:border-blue-400 dark:bg-blue-900/60 dark:text-blue-50 ${
                isDragging ? 'z-20 opacity-80 shadow-lg' : 'z-10'
            }`}
            style={{
                top: top + 1,
                height,
                transform: transform
                    ? `translate3d(0, ${transform.y}px, 0)`
                    : undefined,
            }}
            data-testid={`block-${item.task_uid}`}
            title={aiReason || undefined}
        >
            <div
                className={`flex h-full cursor-grab items-start gap-2 overflow-hidden px-2.5 active:cursor-grabbing ${
                    compact ? 'items-center py-0' : 'py-1.5'
                }`}
                {...listeners}
                {...attributes}
                aria-label={t('dailyPlan.moveBlock', 'Move {{name}}', {
                    name: item.task.name,
                })}
            >
                <div
                    className={`flex min-w-0 flex-1 ${compact ? 'items-center gap-2' : 'flex-col gap-0.5'}`}
                >
                    <span className="flex min-w-0 items-center gap-1 truncate text-[13px] font-medium">
                        {aiReason !== undefined && (
                            <SparklesIcon
                                className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-300"
                                aria-label={t(
                                    'dailyPlan.ai.suggested',
                                    'Suggested by AI'
                                )}
                            />
                        )}
                        <span className="truncate">{item.task.name}</span>
                    </span>
                    <span className="shrink-0 text-xs text-blue-900 dark:text-blue-200">
                        {formatMinute(item.start_minute as number)} ·{' '}
                        {formatDuration(duration)}
                        {!compact && item.task.Project?.name
                            ? ` · ${item.task.Project.name}`
                            : ''}
                    </span>
                </div>
            </div>
            <button
                type="button"
                onClick={onRemove}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={t('dailyPlan.removeFromPlan', 'Remove from plan')}
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded text-blue-900 hover:bg-blue-200 group-hover:flex focus:flex dark:text-blue-100 dark:hover:bg-blue-800"
            >
                <XMarkIcon className="h-4 w-4" />
            </button>
            <div
                onPointerDown={startResize}
                className="absolute bottom-0 left-0 right-0 flex h-2 cursor-ns-resize justify-center"
                aria-hidden="true"
            >
                <span className="mt-0.5 h-1 w-8 rounded-full bg-blue-400 opacity-0 group-hover:opacity-100" />
            </div>
        </div>
    );
};

const DayTimeline: React.FC<DayTimelineProps> = ({
    items,
    events,
    range,
    now,
    onResize,
    onRemove,
    aiReasons,
}) => {
    const { t } = useTranslation();
    const { setNodeRef, isOver } = useDroppable({ id: 'timeline' });
    const height = (range.end - range.start) * PX_PER_MINUTE;
    const hours: number[] = [];
    for (let m = range.start; m <= range.end; m += 60) hours.push(m);

    const scheduled = items
        .filter((item) => item.start_minute !== null)
        .sort(
            (a, b) => (a.start_minute as number) - (b.start_minute as number)
        );
    const timedEvents = events.filter(
        (e) => !e.all_day && e.start_minute !== null
    );
    const allDay = events.filter((e) => e.all_day);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-4 text-[13px] text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm border border-blue-500 bg-blue-100 dark:bg-blue-900/60" />
                    {t('dailyPlan.legendTask', 'Task')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-sm border border-gray-300 bg-gray-100 dark:border-gray-600 dark:bg-gray-800" />
                    {t('dailyPlan.legendCalendar', 'Calendar')}
                </span>
                {allDay.length > 0 && (
                    <span>
                        {t('dailyPlan.allDay', 'All day')}:{' '}
                        {allDay.map((e) => e.title).join(', ')}
                    </span>
                )}
            </div>

            <div className="relative ml-14" style={{ height }}>
                <div
                    ref={setNodeRef}
                    className={`absolute inset-0 rounded-md ${isOver ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''}`}
                    data-testid="day-timeline"
                    data-range-start={range.start}
                >
                    {hours.map((minute) => {
                        const top = (minute - range.start) * PX_PER_MINUTE;
                        return (
                            <React.Fragment key={minute}>
                                <div
                                    className="absolute -left-14 text-xs text-gray-500 dark:text-gray-400"
                                    style={{ top: top - 8 }}
                                >
                                    {formatMinute(minute)}
                                </div>
                                <div
                                    className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-800"
                                    style={{ top }}
                                />
                            </React.Fragment>
                        );
                    })}

                    {timedEvents.map((event) => {
                        const start = Math.max(
                            range.start,
                            event.start_minute as number
                        );
                        const end = Math.min(
                            range.end,
                            event.end_minute ?? (event.start_minute as number)
                        );
                        const top = (start - range.start) * PX_PER_MINUTE;
                        const blockHeight = Math.max(
                            18,
                            (end - start) * PX_PER_MINUTE - 2
                        );
                        return (
                            <div
                                key={`${event.feed_uid}-${event.uid}-${event.start}`}
                                className={`absolute left-1 right-1 flex items-start gap-2 overflow-hidden rounded-md border px-2.5 text-[13px] ${
                                    event.busy
                                        ? 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300'
                                        : 'border-dashed border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-400'
                                } ${blockHeight < 40 ? 'items-center' : 'py-1.5'}`}
                                style={{ top: top + 1, height: blockHeight }}
                            >
                                <span className="shrink-0 text-gray-500 dark:text-gray-400">
                                    {formatMinute(event.start_minute as number)}
                                </span>
                                <span className="truncate">{event.title}</span>
                            </div>
                        );
                    })}

                    {scheduled.length > 0 &&
                        freeGaps(items, events, range).map((gap) => (
                            <div
                                key={`gap-${gap.start}`}
                                className="pointer-events-none absolute left-1 right-1 flex items-center justify-center rounded-md border border-dashed border-blue-200 text-xs text-blue-800 dark:border-blue-900 dark:text-blue-300"
                                style={{
                                    top:
                                        (gap.start - range.start) *
                                            PX_PER_MINUTE +
                                        2,
                                    height:
                                        (gap.end - gap.start) * PX_PER_MINUTE -
                                        4,
                                }}
                                aria-hidden="true"
                            >
                                {t('dailyPlan.freeGap', '{{duration}} free', {
                                    duration: formatDuration(
                                        gap.end - gap.start
                                    ),
                                })}
                            </div>
                        ))}

                    {now !== null && now >= range.start && now <= range.end && (
                        <div
                            className="pointer-events-none absolute left-0 right-0 z-30 border-t-2 border-red-500"
                            style={{ top: (now - range.start) * PX_PER_MINUTE }}
                            aria-hidden="true"
                        >
                            <span className="absolute -left-1.5 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                        </div>
                    )}

                    {scheduled.map((item, index) => {
                        const next = scheduled[index + 1];
                        const limit = next
                            ? (next.start_minute as number)
                            : range.end;
                        return (
                            <TimelineBlock
                                key={item.task_uid}
                                item={item}
                                range={range}
                                maxDuration={Math.max(
                                    SLOT_MINUTES,
                                    limit - (item.start_minute as number)
                                )}
                                onResize={(duration) =>
                                    onResize(item.task_uid, duration)
                                }
                                onRemove={() => onRemove(item.task_uid)}
                                aiReason={aiReasons?.[item.task_uid]}
                            />
                        );
                    })}

                    {scheduled.length === 0 && (
                        <div className="pointer-events-none absolute inset-x-6 top-1/3 rounded-lg border-2 border-dashed border-blue-300 px-4 py-6 text-center text-sm text-blue-800 dark:border-blue-800 dark:text-blue-300">
                            {t(
                                'dailyPlan.timelineEmpty',
                                'Drag tasks here, or press + to drop them into the next free slot'
                            )}
                        </div>
                    )}
                </div>
            </div>

            {items.some((item) => item.start_minute === null) && (
                <UnscheduledTray
                    items={items.filter((item) => item.start_minute === null)}
                    onRemove={onRemove}
                />
            )}
        </div>
    );
};

const TrayItem: React.FC<{ item: DailyPlanItem; onRemove: () => void }> = ({
    item,
    onRemove,
}) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `item:${item.task_uid}`,
        data: { type: 'item', item },
    });
    return (
        <div
            ref={setNodeRef}
            className={`flex items-center gap-2 rounded-md border border-blue-300 bg-white px-2.5 py-1.5 text-[13px] dark:border-blue-800 dark:bg-gray-900 ${
                isDragging ? 'opacity-40' : ''
            }`}
        >
            <span
                className="min-w-0 flex-1 cursor-grab truncate text-gray-900 active:cursor-grabbing dark:text-gray-100"
                {...listeners}
                {...attributes}
            >
                {item.task.name}
            </span>
            <span className="text-xs text-gray-500">
                {formatDuration(item.duration_minutes)}
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={t('dailyPlan.removeFromPlan', 'Remove from plan')}
                className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
                <XMarkIcon className="h-4 w-4" />
            </button>
        </div>
    );
};

const UnscheduledTray: React.FC<{
    items: DailyPlanItem[];
    onRemove: (taskUid: string) => void;
}> = ({ items, onRemove }) => {
    const { t } = useTranslation();
    return (
        <div className="ml-14 flex flex-col gap-2 rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {t('dailyPlan.noTimeYet', 'Today, no time yet')}
            </p>
            {items.map((item) => (
                <TrayItem
                    key={item.task_uid}
                    item={item}
                    onRemove={() => onRemove(item.task_uid)}
                />
            ))}
        </div>
    );
};

export default DayTimeline;
