import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import {
    DailyPlanItem,
    InboxCandidate,
    PlanCandidates,
} from '../../utils/dailyPlanService';
import DurationChips from './DurationChips';
import { DEFAULT_DURATION, formatDuration } from './planUtils';

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

// Few choices at a time: a short list, then "Show more" on request.
const PAGE_SIZE = 5;
// Order of importance when everything is shown together.
const GROUP_ORDER: TaskGroupKey[] = [
    'overdue',
    'due_today',
    'in_progress',
    'suggested',
];

const daysBetween = (from: string, to: string) =>
    Math.round(
        (new Date(`${to}T12:00:00`).getTime() -
            new Date(`${from}T12:00:00`).getTime()) /
            (24 * 60 * 60 * 1000)
    );

interface CandidateCardProps {
    task: Task;
    group: TaskGroupKey;
    duration: number;
    suggested?: number | null;
    today: string;
    onDurationChange: (minutes: number) => void;
    onAdd: () => void;
    onReschedule: (when: 'tomorrow' | 'next_week') => void;
    onDrop: () => void;
}

// Calm by default: the name and one grey line. Lengths and the overdue
// actions open after a short hover or on keyboard focus (always on touch
// screens). The delay keeps rows still while the mouse passes over them.
const CandidateCard: React.FC<CandidateCardProps> = ({
    task,
    group,
    duration,
    suggested = null,
    today,
    onDurationChange,
    onAdd,
    onReschedule,
    onDrop,
}) => {
    const { t } = useTranslation();
    const location = useLocation();
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `candidate:${task.uid}`,
        data: { type: 'candidate', task, duration },
    });

    const labels: Record<TaskGroupKey, string> = {
        overdue: t('dailyPlan.overdue', 'Overdue'),
        due_today: t('dailyPlan.dueToday', 'Due today'),
        in_progress: t('dailyPlan.inProgress', 'In progress'),
        suggested: t('dailyPlan.suggested', 'Suggested'),
    };
    let status = labels[group];
    if (group === 'overdue' && task.due_date) {
        const days = Math.max(
            1,
            daysBetween(task.due_date.slice(0, 10), today)
        );
        status = t('dailyPlan.overdueDays', 'Overdue {{count}}d', {
            count: days,
        });
    }
    const meta = [status, task.Project?.name, formatDuration(duration)]
        .filter(Boolean)
        .join(' · ');

    const quietAction =
        'text-xs text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200';

    return (
        <div
            ref={setNodeRef}
            className={`group flex flex-col rounded-lg px-3 py-2.5 transition-colors hover:bg-gray-50 focus-within:bg-gray-50 dark:hover:bg-gray-800/60 dark:focus-within:bg-gray-800/60 ${
                isDragging ? 'opacity-40' : ''
            }`}
            data-testid={`candidate-${task.uid}`}
        >
            <div className="flex items-center gap-2.5">
                <div
                    className="flex min-w-0 flex-1 cursor-grab flex-col active:cursor-grabbing"
                    {...listeners}
                    {...attributes}
                    aria-label={t(
                        'dailyPlan.dragToTimeline',
                        'Drag {{name}} onto the timeline',
                        { name: task.name }
                    )}
                >
                    <Link
                        to={`/task/${task.uid}`}
                        state={{ from: location.pathname }}
                        draggable={false}
                        className="self-start max-w-full truncate text-sm text-gray-900 hover:underline underline-offset-2 dark:text-gray-100"
                        data-testid={`candidate-open-${task.uid}`}
                    >
                        {task.name}
                    </Link>
                    <span className="flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        {group === 'overdue' && (
                            <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400/80"
                                aria-hidden="true"
                            />
                        )}
                        <span className="truncate">{meta}</span>
                    </span>
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-blue-600 hover:text-white focus-visible:bg-blue-600 focus-visible:text-white dark:text-gray-400"
                    data-testid={`add-${task.uid}`}
                >
                    <PlusIcon className="h-4 w-4" />
                </button>
            </div>
            <div className="grid grid-rows-[0fr] transition-[grid-template-rows] delay-100 duration-200 ease-out group-focus-within:grid-rows-[1fr] group-focus-within:delay-0 group-hover:grid-rows-[1fr] group-hover:delay-300 [@media(hover:none)]:grid-rows-[1fr]">
                <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        <DurationChips
                            value={duration}
                            onChange={onDurationChange}
                            suggested={suggested}
                        />
                        {group === 'overdue' && (
                            <div className="ml-auto flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => onReschedule('tomorrow')}
                                    className={quietAction}
                                >
                                    {t('dailyPlan.tomorrow', 'Tomorrow')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onReschedule('next_week')}
                                    className={quietAction}
                                >
                                    {t('dailyPlan.nextWeek', 'Next week')}
                                </button>
                                <button
                                    type="button"
                                    onClick={onDrop}
                                    className={quietAction}
                                >
                                    {t('dailyPlan.drop', 'Drop')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
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
    onReschedule,
    onDrop,
    onAddInbox,
    today,
}) => {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(PAGE_SIZE);
    const [showFilters, setShowFilters] = useState(false);
    // Dropping a planned block back here takes it off the plan.
    const { setNodeRef, isOver } = useDroppable({ id: 'candidates' });

    // One ordered list, in the user's ranking when the server sends it;
    // planned tasks are on the timeline, not here.
    const byUid = new Map<string, { task: Task; group: TaskGroupKey }>();
    for (const group of GROUP_ORDER) {
        for (const task of candidates[group]) {
            if (task.uid && !byUid.has(task.uid)) {
                byUid.set(task.uid, { task, group });
            }
        }
    }
    const ranked = candidates.ranked ?? [];
    const order = [
        ...ranked,
        ...[...byUid.keys()].filter((uid) => !ranked.includes(uid)),
    ];
    const entries = order
        .map((uid) => byUid.get(uid))
        .filter(
            (entry): entry is { task: Task; group: TaskGroupKey } =>
                !!entry &&
                (filter === 'all' || filter === entry.group) &&
                !planned.has(entry.task.uid as string)
        );
    const shown = entries.slice(0, visible);

    const counts: { key: CandidateFilter; label: string; count: number }[] = [
        { key: 'all', label: t('dailyPlan.all', 'All'), count: entries.length },
        ...GROUP_ORDER.map((key) => ({
            key: key as CandidateFilter,
            label: {
                overdue: t('dailyPlan.overdue', 'Overdue'),
                due_today: t('dailyPlan.dueToday', 'Due today'),
                in_progress: t('dailyPlan.inProgress', 'In progress'),
                suggested: t('dailyPlan.suggested', 'Suggested'),
            }[key],
            count: candidates[key].length,
        })).filter((pill) => pill.count > 0),
        {
            key: 'inbox',
            label: t('dailyPlan.inbox', 'Inbox'),
            count: candidates.inbox_count,
        },
    ];

    const changeFilter = (next: CandidateFilter) => {
        onFilterChange(next);
        setVisible(PAGE_SIZE);
    };

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col gap-3 ${isOver ? 'rounded-xl ring-2 ring-blue-300' : ''}`}
        >
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {filter === 'all'
                        ? t('dailyPlan.whatNext', 'What could you do today?')
                        : counts.find((c) => c.key === filter)?.label}
                </h3>
                <button
                    type="button"
                    onClick={() => setShowFilters((open) => !open)}
                    aria-expanded={showFilters}
                    className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    {t('dailyPlan.browse', 'Browse')}
                    <ChevronDownIcon
                        className={`h-3.5 w-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`}
                    />
                </button>
            </div>

            {showFilters && (
                <div className="flex flex-wrap gap-1.5" role="tablist">
                    {counts.map((pill) => {
                        const active = filter === pill.key;
                        return (
                            <button
                                key={pill.key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => changeFilter(pill.key)}
                                className={`min-h-[30px] rounded-full px-3 text-xs ${
                                    active
                                        ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                                }`}
                            >
                                {pill.label} {pill.count}
                            </button>
                        );
                    })}
                </div>
            )}

            {filter !== 'inbox' && (
                <>
                    {shown.length === 0 && (
                        <p className="px-3 text-sm text-gray-600 dark:text-gray-400">
                            {t('dailyPlan.noCandidates', 'Nothing here. Nice.')}
                        </p>
                    )}
                    <div className="-mx-1 flex flex-col">
                        {shown.map(({ task, group }) => (
                            <CandidateCard
                                key={task.uid}
                                task={task}
                                group={group}
                                duration={
                                    durations[task.uid as string] ??
                                    task.estimated_minutes ??
                                    aiEstimates[task.uid as string] ??
                                    DEFAULT_DURATION
                                }
                                suggested={
                                    task.estimated_minutes
                                        ? null
                                        : (aiEstimates[task.uid as string] ??
                                          null)
                                }
                                today={today}
                                onDurationChange={(minutes) =>
                                    onDurationChange(
                                        task.uid as string,
                                        minutes
                                    )
                                }
                                onAdd={() => onAdd(task)}
                                onReschedule={(when) =>
                                    onReschedule(task, when)
                                }
                                onDrop={() => onDrop(task)}
                            />
                        ))}
                    </div>
                    {entries.length > visible && (
                        <button
                            type="button"
                            onClick={() => setVisible((n) => n + PAGE_SIZE)}
                            className="self-start px-3 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            {t('dailyPlan.showMore', 'Show {{count}} more', {
                                count: Math.min(
                                    PAGE_SIZE,
                                    entries.length - visible
                                ),
                            })}
                        </button>
                    )}
                </>
            )}

            {filter === 'inbox' && (
                <div className="flex flex-col">
                    {candidates.inbox.length === 0 && (
                        <p className="px-3 text-sm text-gray-600 dark:text-gray-400">
                            {t('dailyPlan.noCandidates', 'Nothing here. Nice.')}
                        </p>
                    )}
                    {candidates.inbox.map((item) => (
                        <div
                            key={item.uid}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                        >
                            <span className="min-w-0 flex-1 truncate text-sm text-gray-900 dark:text-gray-100">
                                {item.title || item.content}
                            </span>
                            <button
                                type="button"
                                onClick={() => onAddInbox(item)}
                                aria-label={t(
                                    'dailyPlan.addAsTask',
                                    'Add as task'
                                )}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-blue-600 hover:text-white dark:text-gray-400"
                            >
                                <PlusIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                    {candidates.inbox_count > candidates.inbox.length && (
                        <a
                            href="/inbox"
                            className="px-3 pt-1 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400"
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
