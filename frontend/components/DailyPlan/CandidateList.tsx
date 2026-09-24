import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
    DailyPlanItem,
    InboxCandidate,
    PlanCandidates,
} from '../../utils/dailyPlanService';
import DurationChips from './DurationChips';
import { DEFAULT_DURATION, formatDuration, formatMinute } from './planUtils';

export type CandidateFilter =
    'all' | 'in_progress' | 'overdue' | 'due_today' | 'suggested' | 'inbox';

type TaskGroupKey = Exclude<CandidateFilter, 'all' | 'inbox'>;

interface CandidateListProps {
    candidates: PlanCandidates;
    planned: Map<string, DailyPlanItem>;
    filter: CandidateFilter;
    onFilterChange: (filter: CandidateFilter) => void;
    durations: Record<string, number>;
    aiEstimates?: Record<string, number>;
    onDurationChange: (taskUid: string, minutes: number) => void;
    onAdd: (task: Task) => void;
    onRemove: (taskUid: string) => void;
    onReschedule: (task: Task, when: 'tomorrow' | 'next_week') => void;
    onDrop: (task: Task) => void;
    onAddInbox: (item: InboxCandidate) => void;
    today: string;
}

const daysBetween = (from: string, to: string) =>
    Math.round(
        (new Date(`${to}T12:00:00`).getTime() -
            new Date(`${from}T12:00:00`).getTime()) /
            (24 * 60 * 60 * 1000)
    );

interface CandidateCardProps {
    task: Task;
    group: TaskGroupKey;
    planned?: DailyPlanItem;
    duration: number;
    suggested?: number | null;
    today: string;
    onDurationChange: (minutes: number) => void;
    onAdd: () => void;
    onRemove: () => void;
    onReschedule: (when: 'tomorrow' | 'next_week') => void;
    onDrop: () => void;
}

const CandidateCard: React.FC<CandidateCardProps> = ({
    task,
    group,
    planned,
    duration,
    suggested = null,
    today,
    onDurationChange,
    onAdd,
    onRemove,
    onReschedule,
    onDrop,
}) => {
    const { t } = useTranslation();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `candidate:${task.uid}`,
        data: { type: 'candidate', task, duration },
        disabled: !!planned,
    });

    const project = task.Project?.name;
    let meta = project || '';
    let metaTone = 'text-gray-500 dark:text-gray-400';
    if (group === 'overdue' && task.due_date) {
        const days = Math.max(
            1,
            daysBetween(task.due_date.slice(0, 10), today)
        );
        meta = [
            t('dailyPlan.daysOverdue', '{{count}} days overdue', {
                count: days,
            }),
            project,
        ]
            .filter(Boolean)
            .join(' · ');
        metaTone = 'text-red-700 dark:text-red-400';
    } else if (group === 'due_today') {
        meta = [t('dailyPlan.dueToday', 'Due today'), project]
            .filter(Boolean)
            .join(' · ');
    } else if (group === 'in_progress') {
        meta = [t('dailyPlan.inProgress', 'In progress'), project]
            .filter(Boolean)
            .join(' · ');
    }

    if (planned) {
        return (
            <div
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900/50"
                data-testid={`candidate-${task.uid}`}
            >
                <CheckIcon className="h-5 w-5 shrink-0 text-green-600" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm text-gray-600 dark:text-gray-400">
                        {task.name}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                        {planned.start_minute !== null
                            ? t(
                                  'dailyPlan.plannedAt',
                                  'Planned {{time}} · {{duration}}',
                                  {
                                      time: formatMinute(planned.start_minute),
                                      duration: formatDuration(
                                          planned.duration_minutes
                                      ),
                                  }
                              )
                            : t(
                                  'dailyPlan.plannedNoTime',
                                  'Planned · {{duration}}',
                                  {
                                      duration: formatDuration(
                                          planned.duration_minutes
                                      ),
                                  }
                              )}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={t(
                        'dailyPlan.removeFromPlan',
                        'Remove from plan'
                    )}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>
            </div>
        );
    }

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900 ${
                isDragging ? 'opacity-40' : ''
            }`}
            data-testid={`candidate-${task.uid}`}
        >
            <div className="flex items-start gap-2.5">
                <div
                    className="flex min-w-0 flex-1 cursor-grab flex-col gap-0.5 active:cursor-grabbing"
                    {...listeners}
                    {...attributes}
                    aria-label={t(
                        'dailyPlan.dragToTimeline',
                        'Drag {{name}} onto the timeline',
                        {
                            name: task.name,
                        }
                    )}
                >
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {task.name}
                    </span>
                    {meta && (
                        <span className={`text-xs ${metaTone}`}>{meta}</span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onAdd}
                    aria-label={t(
                        'dailyPlan.addNamed',
                        'Add {{name}} to the plan',
                        {
                            name: task.name,
                        }
                    )}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                    data-testid={`add-${task.uid}`}
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <DurationChips
                    value={duration}
                    onChange={onDurationChange}
                    suggested={suggested}
                />
                {group === 'overdue' && (
                    <div className="ml-auto flex gap-3 text-xs">
                        <button
                            type="button"
                            onClick={() => onReschedule('tomorrow')}
                            className="text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
                        >
                            {t('dailyPlan.tomorrow', 'Tomorrow')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onReschedule('next_week')}
                            className="text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
                        >
                            {t('dailyPlan.nextWeek', 'Next week')}
                        </button>
                        <button
                            type="button"
                            onClick={onDrop}
                            className="text-gray-600 underline-offset-2 hover:underline dark:text-gray-400"
                        >
                            {t('dailyPlan.drop', 'Drop')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const CandidateList: React.FC<CandidateListProps> = ({
    candidates,
    planned,
    filter,
    onFilterChange,
    durations,
    aiEstimates = {},
    onDurationChange,
    onAdd,
    onRemove,
    onReschedule,
    onDrop,
    onAddInbox,
    today,
}) => {
    const { t } = useTranslation();
    // Dropping a planned block back here takes it off the plan.
    const { setNodeRef, isOver } = useDroppable({ id: 'candidates' });

    const groups: { key: TaskGroupKey; label: string; tone: string }[] = [
        {
            key: 'overdue',
            label: t('dailyPlan.overdue', 'Overdue'),
            tone: 'text-red-700 dark:text-red-400',
        },
        {
            key: 'due_today',
            label: t('dailyPlan.dueToday', 'Due today'),
            tone: 'text-amber-800 dark:text-amber-400',
        },
        {
            key: 'in_progress',
            label: t('dailyPlan.inProgress', 'In progress'),
            tone: 'text-blue-800 dark:text-blue-300',
        },
        {
            key: 'suggested',
            label: t('dailyPlan.suggested', 'Suggested'),
            tone: 'text-blue-700 dark:text-blue-400',
        },
    ];

    const total =
        groups.reduce((sum, g) => sum + candidates[g.key].length, 0) +
        candidates.inbox.length;
    const pills: { key: CandidateFilter; label: string; count: number }[] = [
        { key: 'all', label: t('dailyPlan.all', 'All'), count: total },
        ...groups
            .filter((g) => candidates[g.key].length > 0)
            .map((g) => ({
                key: g.key as CandidateFilter,
                label: g.label,
                count: candidates[g.key].length,
            })),
        {
            key: 'inbox',
            label: t('dailyPlan.inbox', 'Inbox'),
            count: candidates.inbox_count,
        },
    ];

    const visibleGroups = groups.filter(
        (g) =>
            (filter === 'all' || filter === g.key) &&
            candidates[g.key].length > 0
    );
    const showInbox =
        (filter === 'all' || filter === 'inbox') && candidates.inbox.length > 0;

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col gap-4 ${isOver ? 'rounded-xl ring-2 ring-blue-300' : ''}`}
        >
            <div className="flex flex-wrap gap-1.5" role="tablist">
                {pills.map((pill) => {
                    const active = filter === pill.key;
                    return (
                        <button
                            key={pill.key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onFilterChange(pill.key)}
                            className={`min-h-[34px] rounded-full border px-3 text-[13px] ${
                                active
                                    ? 'border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900'
                                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                            }`}
                        >
                            {pill.label} {pill.count}
                        </button>
                    );
                })}
            </div>

            {visibleGroups.length === 0 && !showInbox && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('dailyPlan.noCandidates', 'Nothing here. Nice.')}
                </p>
            )}

            {visibleGroups.map((group) => (
                <div key={group.key} className="flex flex-col gap-2.5">
                    <p
                        className={`text-xs font-semibold uppercase tracking-wider ${group.tone}`}
                    >
                        {group.label}
                    </p>
                    {candidates[group.key].map((task) =>
                        task.uid ? (
                            <CandidateCard
                                key={task.uid}
                                task={task}
                                group={group.key}
                                planned={planned.get(task.uid)}
                                duration={
                                    durations[task.uid] ??
                                    task.estimated_minutes ??
                                    aiEstimates[task.uid] ??
                                    DEFAULT_DURATION
                                }
                                suggested={
                                    task.estimated_minutes
                                        ? null
                                        : (aiEstimates[task.uid] ?? null)
                                }
                                today={today}
                                onDurationChange={(minutes) =>
                                    onDurationChange(
                                        task.uid as string,
                                        minutes
                                    )
                                }
                                onAdd={() => onAdd(task)}
                                onRemove={() => onRemove(task.uid as string)}
                                onReschedule={(when) =>
                                    onReschedule(task, when)
                                }
                                onDrop={() => onDrop(task)}
                            />
                        ) : null
                    )}
                </div>
            ))}

            {showInbox && (
                <div className="flex flex-col gap-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                        {t('dailyPlan.inbox', 'Inbox')}
                    </p>
                    {candidates.inbox.map((item) => (
                        <div
                            key={item.uid}
                            className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3.5 py-3 dark:border-gray-800 dark:bg-gray-900"
                        >
                            <span className="min-w-0 flex-1 text-sm text-gray-900 dark:text-gray-100">
                                {item.title || item.content}
                            </span>
                            <button
                                type="button"
                                onClick={() => onAddInbox(item)}
                                className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300"
                            >
                                <PlusIcon className="h-4 w-4" />
                                {t('dailyPlan.addAsTask', 'Add as task')}
                            </button>
                        </div>
                    ))}
                    {candidates.inbox_count > candidates.inbox.length && (
                        <a
                            href="/inbox"
                            className="text-sm text-blue-700 underline-offset-2 hover:underline dark:text-blue-400"
                        >
                            {t(
                                'dailyPlan.moreInInbox',
                                '{{count}} more in the inbox',
                                {
                                    count:
                                        candidates.inbox_count -
                                        candidates.inbox.length,
                                }
                            )}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
};

export default CandidateList;
