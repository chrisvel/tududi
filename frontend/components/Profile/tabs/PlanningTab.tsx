import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ArrowsUpDownIcon,
    Bars3Icon,
    ChevronDownIcon,
    ChevronUpIcon,
    ClockIcon,
    FunnelIcon,
    QueueListIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../../Shared/ToastContext';
import { useSortableSensors } from '../../Shared/sortableList';
import {
    DayHours,
    ProjectStatusKey,
    RankingBucket,
    RankingGroup,
    SuggestionSettings,
    SuggestionSettingsResponse,
    SuggestionTieBreak,
    fetchDayHours,
    fetchPlanRanking,
    fetchSuggestionSettings,
    saveDayHours,
    savePlanRanking,
    saveSuggestionSettings,
} from '../../../utils/dailyPlanService';
import { fetchProjects } from '../../../utils/projectsService';
import { Project } from '../../../entities/Project';
import { getUserTimezone } from '../../../utils/dateUtils';
import {
    DEFAULT_DAY_END,
    DEFAULT_DAY_START,
    formatMinute,
} from '../../DailyPlan/planUtils';
import { FORM } from '../../../constants/formClasses';

const HOURS_STEP = 30;
const HOUR_OPTIONS = Array.from(
    { length: (24 * 60) / HOURS_STEP + 1 },
    (_, index) => index * HOURS_STEP
);

interface PlanningTabProps {
    isActive: boolean;
}

interface PlanningCardProps {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    description?: string;
    action?: React.ReactNode;
    testId?: string;
    children: React.ReactNode;
}

// One subsection of the Planning tab, a soft card like the other Profile
// settings cards.
const PlanningCard: React.FC<PlanningCardProps> = ({
    icon: Icon,
    title,
    description,
    action,
    testId,
    children,
}) => (
    <section
        className="mb-6 rounded-xl bg-gray-50 p-5 dark:bg-gray-800/60"
        data-testid={testId}
    >
        <div className="mb-4 flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300">
                <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {title}
                    </h4>
                    {action}
                </div>
                {description && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {description}
                    </p>
                )}
            </div>
        </div>
        {children}
    </section>
);

interface BucketRowProps {
    bucket: RankingBucket;
    index: number;
    count: number;
    title: string;
    detail: string;
    onMove: (from: number, to: number) => void;
}

const BucketRow: React.FC<BucketRowProps> = ({
    bucket,
    index,
    count,
    title,
    detail,
    onMove,
}) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: bucket });

    const arrow =
        'flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-700';

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={`flex items-center gap-3 rounded-lg bg-white px-2 py-2 dark:bg-gray-900/60 ${
                isDragging ? 'relative z-10 shadow-lg' : ''
            }`}
            data-testid={`planning-bucket-${bucket}`}
        >
            <button
                type="button"
                className="flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 active:cursor-grabbing dark:text-gray-400 dark:hover:bg-gray-700"
                aria-label={t('profile.planning.dragRow', 'Drag {{name}}', {
                    name: title,
                })}
                {...listeners}
                {...attributes}
            >
                <Bars3Icon className="h-4 w-4" />
            </button>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {title}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">
                    {detail}
                </span>
            </span>
            <span className="flex shrink-0">
                <button
                    type="button"
                    onClick={() => onMove(index, index - 1)}
                    disabled={index === 0}
                    aria-label={t(
                        'profile.planning.moveUp',
                        'Move {{name}} up',
                        {
                            name: title,
                        }
                    )}
                    className={arrow}
                >
                    <ChevronUpIcon className="h-4 w-4" />
                </button>
                <button
                    type="button"
                    onClick={() => onMove(index, index + 1)}
                    disabled={index === count - 1}
                    aria-label={t(
                        'profile.planning.moveDown',
                        'Move {{name}} down',
                        { name: title }
                    )}
                    className={arrow}
                >
                    <ChevronDownIcon className="h-4 w-4" />
                </button>
            </span>
        </li>
    );
};

// Lets the user order the buckets used by backend/modules/daily-plan/
// ranking.js and choose which tasks count as suggested
// (planningSettings.js). Keep the texts here in step with those files.
const PlanningTab: React.FC<PlanningTabProps> = ({ isActive }) => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const sensors = useSortableSensors();
    const [order, setOrder] = useState<RankingBucket[]>([]);
    const [defaultOrder, setDefaultOrder] = useState<RankingBucket[]>([]);
    const [loading, setLoading] = useState(false);
    const [dayHours, setDayHours] = useState<DayHours | null>(null);
    const [suggestions, setSuggestions] = useState<SuggestionSettings | null>(
        null
    );
    const [suggestionOptions, setSuggestionOptions] = useState<
        SuggestionSettingsResponse['options'] | null
    >(null);
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        if (!isActive) return;
        fetchSuggestionSettings()
            .then((response) => {
                setSuggestions(response.settings);
                setSuggestionOptions(response.options);
            })
            .catch(() =>
                showErrorToast(
                    t(
                        'profile.planning.suggestionsLoadError',
                        'Could not load your suggestion settings'
                    )
                )
            );
        fetchProjects()
            .then((list) =>
                setProjects(
                    list
                        .filter((project) => typeof project.id === 'number')
                        .sort((a, b) => a.name.localeCompare(b.name))
                )
            )
            .catch(() => setProjects([]));
    }, [isActive]);

    useEffect(() => {
        if (!isActive) return;
        fetchDayHours()
            .then(setDayHours)
            .catch(() =>
                showErrorToast(
                    t(
                        'profile.planning.hoursLoadError',
                        'Could not load your day hours'
                    )
                )
            );
    }, [isActive]);

    useEffect(() => {
        if (!isActive) return;
        setLoading(true);
        fetchPlanRanking()
            .then((ranking) => {
                setOrder(ranking.order);
                setDefaultOrder(ranking.default_order);
            })
            .catch(() =>
                showErrorToast(
                    t(
                        'profile.planning.loadError',
                        'Could not load the planning order'
                    )
                )
            )
            .finally(() => setLoading(false));
    }, [isActive]);

    if (!isActive) return null;

    const statusLabel = (status: ProjectStatusKey) =>
        t(`projectStatus.${status}`, status);

    // "Everything else" in words, following the saved settings.
    function describeSuggested() {
        if (!suggestions) {
            return t(
                'profile.planning.suggestedLoading',
                'Open tasks you could pick up.'
            );
        }
        const labels = suggestions.projectStatuses.map(
            (status) => `“${statusLabel(status)}”`
        );
        const statuses =
            labels.length > 1
                ? t('profile.planning.listOr', '{{first}} or {{last}}', {
                      first: labels.slice(0, -1).join(', '),
                      last: labels[labels.length - 1],
                  })
                : (labels[0] ?? '');
        const hasStatuses = suggestions.projectStatuses.length > 0;
        const parts = [
            hasStatuses && suggestions.includeNoProject
                ? t(
                      'profile.planning.suggestedFromProjectsAndNone',
                      'Open tasks from projects marked {{statuses}}, and tasks with no project.',
                      { statuses }
                  )
                : hasStatuses
                  ? t(
                        'profile.planning.suggestedFromProjects',
                        'Open tasks from projects marked {{statuses}}.',
                        { statuses }
                    )
                  : suggestions.includeNoProject
                    ? t(
                          'profile.planning.suggestedFromNone',
                          'Open tasks with no project.'
                      )
                    : t(
                          'profile.planning.suggestedFromNothing',
                          'Nothing, because no project status and no tasks without a project are chosen below.'
                      ),
        ];
        if (suggestions.excludedProjectIds.length > 0) {
            parts.push(
                t(
                    'profile.planning.suggestedExcluded',
                    'Projects you chose to never suggest are left out.'
                )
            );
        }
        parts.push(
            suggestions.horizonDays === 1
                ? t(
                      'profile.planning.suggestedLeftOutDay',
                      'Deferred tasks, someday tasks and tasks due more than a day out are left out.'
                  )
                : t(
                      'profile.planning.suggestedLeftOutDays',
                      'Deferred tasks, someday tasks and tasks due more than {{count}} days out are left out.',
                      { count: suggestions.horizonDays }
                  )
        );
        if (suggestions.staleAfterDays) {
            parts.push(
                t(
                    'profile.planning.suggestedStale',
                    'So are tasks nobody changed in {{months}} months.',
                    { months: Math.round(suggestions.staleAfterDays / 30) }
                )
            );
        }
        parts.push(
            t('profile.planning.suggestedCap', 'Up to {{count}} are shown.', {
                count: suggestions.maxSuggestions,
            })
        );
        return parts.join(' ');
    }

    const groups: Record<RankingGroup, { title: string; detail: string }> = {
        overdue: {
            title: t('profile.planning.overdue', 'Overdue'),
            detail: t(
                'profile.planning.overdueDetail',
                'Past their due date, including tasks you already started.'
            ),
        },
        due_today: {
            title: t('profile.planning.dueToday', 'Due today'),
            detail: t(
                'profile.planning.dueTodayDetail',
                'Tasks due before the day ends.'
            ),
        },
        in_progress: {
            title: t('profile.planning.inProgress', 'In progress'),
            detail: t(
                'profile.planning.inProgressDetail',
                'Work you started and have not finished.'
            ),
        },
        suggested: {
            title: t('profile.planning.everythingElse', 'Everything else'),
            detail: describeSuggested(),
        },
    };
    const kinds = {
        project: t('profile.planning.inProject', 'in a project'),
        none: t('profile.planning.noProject', 'no project'),
    };
    const describe = (bucket: RankingBucket) => {
        const [group, kind] = bucket.split(':') as [
            RankingGroup,
            'project' | 'none',
        ];
        return {
            title: `${groups[group].title} · ${kinds[kind]}`,
            detail: groups[group].detail,
        };
    };

    const save = (next: RankingBucket[]) => {
        const previous = order;
        setOrder(next);
        savePlanRanking(next).catch(() => {
            setOrder(previous);
            showErrorToast(
                t(
                    'profile.planning.saveError',
                    'Could not save the planning order'
                )
            );
        });
    };

    const changeHours = (next: DayHours) => {
        if (next.start >= next.end) return;
        const previous = dayHours;
        setDayHours(next);
        saveDayHours(next).catch(() => {
            setDayHours(previous);
            showErrorToast(
                t(
                    'profile.planning.hoursSaveError',
                    'Could not save your day hours'
                )
            );
        });
    };

    const changeSuggestions = (patch: Partial<SuggestionSettings>) => {
        if (!suggestions) return;
        const previous = suggestions;
        setSuggestions({ ...suggestions, ...patch });
        saveSuggestionSettings(patch).catch(() => {
            setSuggestions(previous);
            showErrorToast(
                t(
                    'profile.planning.suggestionsSaveError',
                    'Could not save your suggestion settings'
                )
            );
        });
    };

    const toggleStatus = (status: ProjectStatusKey, on: boolean) => {
        if (!suggestions || !suggestionOptions) return;
        const chosen = new Set(suggestions.projectStatuses);
        if (on) chosen.add(status);
        else chosen.delete(status);
        changeSuggestions({
            projectStatuses: suggestionOptions.projectStatuses.filter((key) =>
                chosen.has(key)
            ),
        });
    };

    // Only ids of projects that still exist are sent, so a deleted project
    // left in the setting never blocks a save.
    const projectIds = new Set(projects.map((project) => project.id));
    const excludedProjects = projects.filter((project) =>
        suggestions?.excludedProjectIds.includes(project.id as number)
    );
    const setExcluded = (ids: number[]) =>
        changeSuggestions({
            excludedProjectIds: ids.filter((id) => projectIds.has(id)),
        });

    const move = (from: number, to: number) => {
        if (to < 0 || to >= order.length || from === to) return;
        save(arrayMove(order, from, to));
    };

    const onDragEnd = ({ active, over }: DragEndEvent) => {
        if (!over || active.id === over.id) return;
        move(
            order.indexOf(active.id as RankingBucket),
            order.indexOf(over.id as RankingBucket)
        );
    };

    const isDefault =
        order.length > 0 &&
        order.every((bucket, index) => bucket === defaultOrder[index]);

    const tieBreakers = [
        t('profile.planning.rulePriority', 'Higher priority first.'),
        t(
            'profile.planning.ruleRows',
            'Then the order of the rows above, so a task in a project never passes one with higher priority.'
        ),
        {
            recently_touched: t(
                'profile.planning.ruleDueRecent',
                'The earlier due date first, then the task changed most recently.'
            ),
            newest: t(
                'profile.planning.ruleDueNewest',
                'The earlier due date first, then the newest task.'
            ),
            oldest: t(
                'profile.planning.ruleDueOldest',
                'The earlier due date first, then the oldest task.'
            ),
        }[suggestions?.tieBreak ?? 'recently_touched'],
    ];

    const tieBreakLabels: Record<SuggestionTieBreak, string> = {
        recently_touched: t(
            'profile.planning.tieRecent',
            'Most recently changed first'
        ),
        newest: t('profile.planning.tieNewest', 'Newest first'),
        oldest: t('profile.planning.tieOldest', 'Oldest first'),
    };
    const staleLabel = (days: number | null) =>
        days === null
            ? t('profile.planning.staleOff', 'Off')
            : t('profile.planning.staleMonths', '{{count}} months', {
                  count: Math.round(days / 30),
              });
    const horizonLabel = (days: number) =>
        days === 1
            ? t('profile.planning.horizonDay', '1 day')
            : t('profile.planning.horizonDays', '{{count}} days', {
                  count: days,
              });
    const fieldLabel =
        'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300';
    const fieldHint = 'mt-1.5 text-xs text-gray-500 dark:text-gray-400';
    const pill =
        'flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 has-[:checked]:bg-blue-50 has-[:checked]:text-blue-800 dark:bg-gray-900/60 dark:text-gray-300 dark:hover:bg-gray-900 dark:has-[:checked]:bg-blue-900/30 dark:has-[:checked]:text-blue-200';
    const checkbox =
        'h-4 w-4 shrink-0 rounded text-blue-600 focus:ring-blue-500';
    const resetLink =
        'text-xs font-normal text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline dark:text-gray-400 dark:hover:text-gray-200';
    const loadingText = (
        <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('common.loading', 'Loading...')}
        </p>
    );

    return (
        <div>
            <h3 className="mb-2 flex items-center text-xl font-semibold text-gray-900 dark:text-white">
                <QueueListIcon className="mr-3 h-6 w-6 text-blue-500" />
                {t('profile.planning.title', 'Planning')}
            </h3>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                {t(
                    'profile.planning.intro',
                    'How Plan my day lays out your day and which tasks it offers you.'
                )}{' '}
                <Link
                    to="/today/plan"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                >
                    {t('profile.planning.open', 'Plan my day')}
                </Link>
            </p>

            <PlanningCard
                icon={ClockIcon}
                title={t('profile.planning.hoursTitle', 'Your day')}
                description={t(
                    'profile.planning.hoursDescription',
                    'The hours the timeline shows on Today and when you plan your day. New tasks and AI drafts get a time inside them. Times are in your timezone ({{timezone}}).',
                    { timezone: getUserTimezone() }
                )}
                action={
                    dayHours &&
                    (dayHours.start !== DEFAULT_DAY_START ||
                        dayHours.end !== DEFAULT_DAY_END) && (
                        <button
                            type="button"
                            onClick={() =>
                                changeHours({
                                    start: DEFAULT_DAY_START,
                                    end: DEFAULT_DAY_END,
                                })
                            }
                            className={resetLink}
                        >
                            {t('profile.planning.reset', 'Reset to default')}
                        </button>
                    )
                }
            >
                {dayHours ? (
                    <div
                        className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                        data-testid="planning-day-hours"
                    >
                        <label className="flex items-center gap-2">
                            {t('profile.planning.hoursFrom', 'From')}
                            <select
                                value={dayHours.start}
                                onChange={(e) =>
                                    changeHours({
                                        ...dayHours,
                                        start: Number(e.target.value),
                                    })
                                }
                                className={FORM.select}
                                data-testid="planning-day-start"
                            >
                                {HOUR_OPTIONS.filter(
                                    (minute) => minute < dayHours.end
                                ).map((minute) => (
                                    <option key={minute} value={minute}>
                                        {formatMinute(minute)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-2">
                            {t('profile.planning.hoursTo', 'to')}
                            <select
                                value={dayHours.end}
                                onChange={(e) =>
                                    changeHours({
                                        ...dayHours,
                                        end: Number(e.target.value),
                                    })
                                }
                                className={FORM.select}
                                data-testid="planning-day-end"
                            >
                                {HOUR_OPTIONS.filter(
                                    (minute) => minute > dayHours.start
                                ).map((minute) => (
                                    <option key={minute} value={minute}>
                                        {formatMinute(minute)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                ) : (
                    loadingText
                )}
            </PlanningCard>

            <PlanningCard
                icon={ArrowsUpDownIcon}
                title={t(
                    'profile.planning.orderTitle',
                    'Order (drag to change)'
                )}
                description={t(
                    'profile.planning.description',
                    'How "What could you do today?" orders your tasks when you plan your day. Drag the rows into the order you want; the same tasks always come out in the same order.'
                )}
                action={
                    !isDefault &&
                    order.length > 0 && (
                        <button
                            type="button"
                            onClick={() => save(defaultOrder)}
                            className={resetLink}
                        >
                            {t('profile.planning.reset', 'Reset to default')}
                        </button>
                    )
                }
            >
                {loading && order.length === 0 ? (
                    loadingText
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={onDragEnd}
                    >
                        <SortableContext
                            items={order}
                            strategy={verticalListSortingStrategy}
                        >
                            <ol className="flex flex-col gap-2">
                                {order.map((bucket, index) => (
                                    <BucketRow
                                        key={bucket}
                                        bucket={bucket}
                                        index={index}
                                        count={order.length}
                                        {...describe(bucket)}
                                        onMove={move}
                                    />
                                ))}
                            </ol>
                        </SortableContext>
                    </DndContext>
                )}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                        <h5 className={fieldLabel}>
                            {t(
                                'profile.planning.withinTitle',
                                'Inside each group'
                            )}
                        </h5>
                        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-gray-700 dark:text-gray-300">
                            {tieBreakers.map((rule) => (
                                <li key={rule}>{rule}</li>
                            ))}
                        </ol>
                    </div>
                    {suggestions && suggestionOptions && (
                        <div>
                            <label
                                htmlFor="planning-tie-break"
                                className={fieldLabel}
                            >
                                {t(
                                    'profile.planning.tieTitle',
                                    'When tasks tie'
                                )}
                            </label>
                            <select
                                id="planning-tie-break"
                                value={suggestions.tieBreak}
                                onChange={(e) =>
                                    changeSuggestions({
                                        tieBreak: e.target
                                            .value as SuggestionTieBreak,
                                    })
                                }
                                className={`${FORM.select} w-full`}
                                data-testid="planning-tie-break"
                            >
                                {suggestionOptions.tieBreak.map((value) => (
                                    <option key={value} value={value}>
                                        {tieBreakLabels[value]}
                                    </option>
                                ))}
                            </select>
                            <p className={fieldHint}>
                                {t(
                                    'profile.planning.tieDescription',
                                    'After priority and due date, which task comes first.'
                                )}
                            </p>
                        </div>
                    )}
                </div>
            </PlanningCard>

            <PlanningCard
                icon={FunnelIcon}
                title={t(
                    'profile.planning.suggestedTitle',
                    'What gets suggested'
                )}
                description={t(
                    'profile.planning.suggestedDescription',
                    'Which open tasks can show up under Everything else, and how many. Overdue, due today and in progress tasks always show.'
                )}
            >
                {suggestions && suggestionOptions ? (
                    <div
                        className="flex flex-col gap-6"
                        data-testid="planning-suggestions"
                    >
                        <div>
                            <h5 className={fieldLabel}>
                                {t(
                                    'profile.planning.projectsTitle',
                                    'Which projects count'
                                )}
                            </h5>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                {suggestionOptions.projectStatuses.map(
                                    (status) => (
                                        <label key={status} className={pill}>
                                            <input
                                                type="checkbox"
                                                checked={suggestions.projectStatuses.includes(
                                                    status
                                                )}
                                                onChange={(e) =>
                                                    toggleStatus(
                                                        status,
                                                        e.target.checked
                                                    )
                                                }
                                                className={checkbox}
                                                data-testid={`planning-status-${status}`}
                                            />
                                            {statusLabel(status)}
                                        </label>
                                    )
                                )}
                                <label className={pill}>
                                    <input
                                        type="checkbox"
                                        checked={suggestions.includeNoProject}
                                        onChange={(e) =>
                                            changeSuggestions({
                                                includeNoProject:
                                                    e.target.checked,
                                            })
                                        }
                                        className={checkbox}
                                        data-testid="planning-include-no-project"
                                    />
                                    {t(
                                        'profile.planning.includeNoProject',
                                        'Tasks with no project'
                                    )}
                                </label>
                            </div>
                        </div>

                        <div>
                            <label
                                className={fieldLabel}
                                htmlFor="planning-exclude-project"
                            >
                                {t(
                                    'profile.planning.excludedTitle',
                                    'Never suggest these projects'
                                )}
                            </label>
                            {excludedProjects.length > 0 && (
                                <ul
                                    className="mb-2 flex flex-wrap gap-1.5"
                                    data-testid="planning-excluded-projects"
                                >
                                    {excludedProjects.map((project) => (
                                        <li
                                            key={project.id}
                                            className="inline-flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1 text-xs font-medium text-gray-800 dark:bg-gray-900/60 dark:text-gray-200"
                                        >
                                            {project.name}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExcluded(
                                                        suggestions.excludedProjectIds.filter(
                                                            (id) =>
                                                                id !==
                                                                project.id
                                                        )
                                                    )
                                                }
                                                aria-label={t(
                                                    'profile.planning.excludedRemove',
                                                    'Suggest {{name}} again',
                                                    { name: project.name }
                                                )}
                                                className="flex h-5 w-5 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                                            >
                                                <XMarkIcon className="h-3.5 w-3.5" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <select
                                id="planning-exclude-project"
                                value=""
                                onChange={(e) => {
                                    const id = Number(e.target.value);
                                    if (!id) return;
                                    setExcluded([
                                        ...suggestions.excludedProjectIds,
                                        id,
                                    ]);
                                }}
                                className={`${FORM.select} w-full sm:w-72`}
                                data-testid="planning-exclude-project"
                            >
                                <option value="">
                                    {t(
                                        'profile.planning.excludedAdd',
                                        'Add a project…'
                                    )}
                                </option>
                                {projects
                                    .filter(
                                        (project) =>
                                            !suggestions.excludedProjectIds.includes(
                                                project.id as number
                                            )
                                    )
                                    .map((project) => (
                                        <option
                                            key={project.id}
                                            value={project.id}
                                        >
                                            {project.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label
                                    htmlFor="planning-horizon"
                                    className={fieldLabel}
                                >
                                    {t(
                                        'profile.planning.horizonTitle',
                                        'Look ahead'
                                    )}
                                </label>
                                <select
                                    id="planning-horizon"
                                    value={suggestions.horizonDays}
                                    onChange={(e) =>
                                        changeSuggestions({
                                            horizonDays: Number(e.target.value),
                                        })
                                    }
                                    className={`${FORM.select} w-full`}
                                    data-testid="planning-horizon"
                                >
                                    {suggestionOptions.horizonDays.map(
                                        (days) => (
                                            <option key={days} value={days}>
                                                {horizonLabel(days)}
                                            </option>
                                        )
                                    )}
                                </select>
                                <p className={fieldHint}>
                                    {t(
                                        'profile.planning.horizonDescription',
                                        'Suggest tasks due up to this far ahead.'
                                    )}
                                </p>
                            </div>
                            <div>
                                <label
                                    htmlFor="planning-stale"
                                    className={fieldLabel}
                                >
                                    {t(
                                        'profile.planning.staleTitle',
                                        'Leave out untouched tasks'
                                    )}
                                </label>
                                <select
                                    id="planning-stale"
                                    value={suggestions.staleAfterDays ?? ''}
                                    onChange={(e) =>
                                        changeSuggestions({
                                            staleAfterDays: e.target.value
                                                ? Number(e.target.value)
                                                : null,
                                        })
                                    }
                                    className={`${FORM.select} w-full`}
                                    data-testid="planning-stale"
                                >
                                    {suggestionOptions.staleAfterDays.map(
                                        (days) => (
                                            <option
                                                key={days ?? 'off'}
                                                value={days ?? ''}
                                            >
                                                {staleLabel(days)}
                                            </option>
                                        )
                                    )}
                                </select>
                                <p className={fieldHint}>
                                    {t(
                                        'profile.planning.staleDescription',
                                        'Skip suggestions nobody has changed for this long.'
                                    )}
                                </p>
                            </div>
                            <div>
                                <label
                                    htmlFor="planning-max"
                                    className={fieldLabel}
                                >
                                    {t(
                                        'profile.planning.maxTitle',
                                        'Show up to'
                                    )}
                                </label>
                                <select
                                    id="planning-max"
                                    value={suggestions.maxSuggestions}
                                    onChange={(e) =>
                                        changeSuggestions({
                                            maxSuggestions: Number(
                                                e.target.value
                                            ),
                                        })
                                    }
                                    className={`${FORM.select} w-full`}
                                    data-testid="planning-max"
                                >
                                    {suggestionOptions.maxSuggestions.map(
                                        (count) => (
                                            <option key={count} value={count}>
                                                {t(
                                                    'profile.planning.maxOption',
                                                    '{{count}} tasks',
                                                    { count }
                                                )}
                                            </option>
                                        )
                                    )}
                                </select>
                                <p className={fieldHint}>
                                    {t(
                                        'profile.planning.maxDescription',
                                        'The most tasks to suggest under Everything else.'
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    loadingText
                )}
            </PlanningCard>
        </div>
    );
};

export default PlanningTab;
