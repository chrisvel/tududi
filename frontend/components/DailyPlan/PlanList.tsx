import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Bars3Icon,
    SparklesIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { DailyPlanItem } from '../../utils/dailyPlanService';
import DurationChips from './DurationChips';
import { formatMinute } from './planUtils';

interface PlanListProps {
    items: DailyPlanItem[];
    onDurationChange: (taskUid: string, duration: number) => void;
    onTimeChange: (taskUid: string, startMinute: number | null) => void;
    onRemove: (taskUid: string) => void;
    aiReasons?: Record<string, string>;
}

const parseTime = (value: string): number | null => {
    if (!value) return null;
    const [hours, minutes] = value.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const PlanRow: React.FC<{
    item: DailyPlanItem;
    index: number;
    onDurationChange: (duration: number) => void;
    onTimeChange: (startMinute: number | null) => void;
    onRemove: () => void;
    aiReason?: string;
}> = ({ item, index, onDurationChange, onTimeChange, onRemove, aiReason }) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: `item:${item.task_uid}`,
        data: { type: 'item', item },
    });

    return (
        <li
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={`flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center dark:border-gray-800 dark:bg-gray-900 ${
                isDragging ? 'z-10 opacity-70 shadow-lg' : ''
            }`}
            data-testid={`plan-row-${item.task_uid}`}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2">
                <button
                    type="button"
                    className="flex h-9 w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 active:cursor-grabbing dark:hover:bg-gray-800"
                    aria-label={t('dailyPlan.reorder', 'Reorder {{name}}', {
                        name: item.task.name,
                    })}
                    {...listeners}
                    {...attributes}
                >
                    <Bars3Icon className="h-4 w-4" />
                </button>
                <span className="w-5 shrink-0 text-right text-xs text-gray-500">
                    {index + 1}
                </span>
                <span
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-gray-900 dark:text-gray-100"
                    title={aiReason || undefined}
                >
                    {aiReason !== undefined && (
                        <SparklesIcon
                            className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300"
                            aria-label={t(
                                'dailyPlan.ai.suggested',
                                'Suggested by AI'
                            )}
                        />
                    )}
                    <span className="truncate">{item.task.name}</span>
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-11 sm:pl-0">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                    <span className="sr-only">
                        {t('dailyPlan.startTime', 'Start time')}
                    </span>
                    <input
                        type="time"
                        step={900}
                        value={
                            item.start_minute !== null
                                ? formatMinute(item.start_minute)
                                : ''
                        }
                        onChange={(e) =>
                            onTimeChange(parseTime(e.target.value))
                        }
                        className="h-8 rounded-md border border-gray-300 bg-white px-1.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    />
                </label>
                <DurationChips
                    value={item.duration_minutes}
                    onChange={onDurationChange}
                />
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t(
                        'dailyPlan.removeFromPlan',
                        'Remove from plan'
                    )}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        </li>
    );
};

const PlanList: React.FC<PlanListProps> = ({
    items,
    onDurationChange,
    onTimeChange,
    onRemove,
    aiReasons,
}) => {
    const { t } = useTranslation();
    const { setNodeRef, isOver } = useDroppable({ id: 'plan-list' });

    return (
        <div
            ref={setNodeRef}
            className={`flex min-h-[200px] flex-col gap-2 rounded-xl p-1 ${
                isOver ? 'bg-blue-50/60 dark:bg-blue-900/10' : ''
            }`}
        >
            {items.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-blue-300 px-4 py-8 text-center text-sm text-blue-800 dark:border-blue-800 dark:text-blue-300">
                    {t(
                        'dailyPlan.listEmpty',
                        'Add tasks with + or drag them here. Order them the way you want to do them.'
                    )}
                </div>
            ) : (
                <SortableContext
                    items={items.map((item) => `item:${item.task_uid}`)}
                    strategy={verticalListSortingStrategy}
                >
                    <ol className="flex flex-col gap-2">
                        {items.map((item, index) => (
                            <PlanRow
                                key={item.task_uid}
                                item={item}
                                index={index}
                                onDurationChange={(duration) =>
                                    onDurationChange(item.task_uid, duration)
                                }
                                onTimeChange={(start) =>
                                    onTimeChange(item.task_uid, start)
                                }
                                onRemove={() => onRemove(item.task_uid)}
                                aiReason={aiReasons?.[item.task_uid]}
                            />
                        ))}
                    </ol>
                </SortableContext>
            )}
        </div>
    );
};

export default PlanList;
