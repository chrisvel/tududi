import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { isTaskDone } from '../../constants/taskStatus';
import { createUidSlug } from '../../utils/slugUtils';
import { fetchTaskByUid } from '../../utils/tasksService';
import {
    RoadmapResponse,
    RoadmapTask,
    fetchRoadmap,
} from '../../utils/roadmapService';
import TaskModal from '../Task/TaskModal';
import {
    dateOf,
    fromDay,
    toDay,
    todayDay,
} from '../Project/Timeline/timelineLayout';
import {
    RoadmapRow,
    allKeys,
    areaKey,
    barPosition,
    buildRows,
    dayCenter,
    monthTicks,
    parseQuarter,
    placeGoals,
    quarterBounds,
    quarterKey,
    quarterOfDay,
    shiftQuarter,
    weekTicks,
} from './roadmapLayout';

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 48;
const GOAL_LANE_HEIGHT = 44;
const OPEN_KEY = 'roadmap_open_rows';
const INDENT = { area: 8, project: 24, task: 52 };

const readOpen = (storageKey: string): Set<string> | null => {
    try {
        const saved = localStorage.getItem(storageKey);
        return saved ? new Set(JSON.parse(saved) as string[]) : null;
    } catch {
        return null;
    }
};

const writeOpen = (storageKey: string, open: Set<string>) => {
    try {
        localStorage.setItem(storageKey, JSON.stringify([...open]));
    } catch {
        // Open rows are a convenience; the chart works without saving them
    }
};

const taskColor = (task: RoadmapTask, today: number): string => {
    if (isTaskDone(task.status as Task['status'])) {
        return 'bg-gray-300 dark:bg-gray-600';
    }
    const due = toDay(task.due_date);
    if (due !== null && due < today) return 'bg-orange-500';
    if (task.status === 1 || task.status === 'in_progress') {
        return 'bg-blue-600 dark:bg-blue-500';
    }
    return 'bg-blue-300 dark:bg-blue-700';
};

interface RoadmapChartProps {
    // Shows one area and its goals instead of everything
    areaUid?: string;
}

const RoadmapChart: React.FC<RoadmapChartProps> = ({ areaUid }) => {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const today = todayDay();
    const quarter = parseQuarter(searchParams.get('q')) ?? quarterOfDay(today);
    const { first, last } = quarterBounds(quarter);

    const [data, setData] = useState<RoadmapResponse | null>(null);
    const [failed, setFailed] = useState(false);
    // Each area's tab keeps its own rows, apart from the Roadmap page
    const storageKey = areaUid ? `${OPEN_KEY}_${areaUid}` : OPEN_KEY;
    const [saved, setSaved] = useState<Set<string> | null>(() =>
        readOpen(storageKey)
    );
    const [panelTask, setPanelTask] = useState<Task | null>(null);
    const [reloadCount, setReloadCount] = useState(0);

    useEffect(() => {
        let stale = false;
        setFailed(false);
        fetchRoadmap(fromDay(first), last - first + 1, areaUid)
            .then((next) => {
                if (!stale) setData(next);
            })
            .catch(() => {
                if (!stale) setFailed(true);
            });
        return () => {
            stale = true;
        };
    }, [first, last, areaUid, reloadCount]);

    const areas = useMemo(() => data?.areas ?? [], [data]);
    // Until someone opens or closes a row, areas start open and projects closed
    const open = useMemo(
        () => saved ?? new Set(areas.map(areaKey)),
        [saved, areas]
    );
    const rows = useMemo(() => buildRows(areas, open), [areas, open]);
    const { placed: goals, lanes } = useMemo(
        () => placeGoals(data?.goals ?? [], first, last),
        [data, first, last]
    );
    const months = useMemo(() => monthTicks(first, last), [first, last]);
    const weeks = useMemo(() => weekTicks(first, last), [first, last]);

    const changeOpen = (next: Set<string>) => {
        setSaved(next);
        writeOpen(storageKey, next);
    };

    const toggle = (rowKey: string) => {
        const next = new Set(open);
        if (next.has(rowKey)) next.delete(rowKey);
        else next.add(rowKey);
        changeOpen(next);
    };

    const goToQuarter = (next: ReturnType<typeof parseQuarter>) => {
        if (!next) return;
        setSearchParams(
            (params) => {
                params.set('q', quarterKey(next));
                return params;
            },
            { replace: true }
        );
    };

    const openTask = useCallback(async (uid: string) => {
        try {
            setPanelTask(await fetchTaskByUid(uid));
        } catch {
            setFailed(true);
        }
    }, []);

    const formatDay = (day: number) => format(dateOf(day), 'MMM d');

    const formatRange = (
        start: string | null,
        end: string | null
    ): string | null => {
        const from = toDay(start);
        const to = toDay(end);
        if (from === null || to === null) return null;
        if (from === to) return formatDay(from);
        return t('roadmap.range', '{{start}} to {{end}}', {
            start: formatDay(from),
            end: formatDay(to),
        });
    };

    const describeTask = (task: RoadmapTask): string => {
        if (task.kind === 'range') {
            return formatRange(task.start_date, task.due_date) ?? '';
        }
        if (task.kind === 'due') {
            return t('projectTimeline.dueOn', 'Due {{date}}', {
                date: formatDay(toDay(task.due_date) as number),
            });
        }
        return t('projectTimeline.startsOn', 'Starts {{date}}', {
            date: formatDay(toDay(task.start_date) as number),
        });
    };

    const summaryRange = (row: RoadmapRow): string => {
        if (row.kind === 'task') return describeTask(row.task);
        const dated = row.kind === 'area' ? row.area : row.project;
        const range = formatRange(dated.start, dated.end);
        if (!range) return t('roadmap.noDates', 'No dates yet');
        if (row.kind === 'project' && !row.project.dated_from_tasks) {
            return t('roadmap.projectDates', '{{range}} (project dates)', {
                range,
            });
        }
        return range;
    };

    const renderName = (row: RoadmapRow) => {
        const meta = (
            <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                {summaryRange(row)}
            </span>
        );
        if (row.kind === 'task') {
            return (
                <button
                    type="button"
                    onClick={() => openTask(row.task.uid)}
                    className="flex h-full w-full min-w-0 flex-col justify-center pr-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    style={{ paddingLeft: INDENT.task }}
                >
                    <span className="truncate text-sm text-gray-800 dark:text-gray-200">
                        {row.task.name}
                    </span>
                    {meta}
                </button>
            );
        }

        const isArea = row.kind === 'area';
        const name = isArea
            ? (row.area.name ?? t('roadmap.noArea', 'No area'))
            : row.project.name;
        const uid = isArea ? row.area.uid : row.project.uid;
        const to = !uid
            ? null
            : `/${isArea ? 'area' : 'project'}/${createUidSlug(uid, name)}`;
        const nameClass = `truncate text-sm text-gray-900 dark:text-gray-100 ${
            isArea ? 'font-semibold' : 'font-medium'
        }`;
        return (
            <div
                className="flex h-full min-w-0 items-center pr-3"
                style={{ paddingLeft: isArea ? INDENT.area : INDENT.project }}
            >
                <button
                    type="button"
                    onClick={() => toggle(row.key)}
                    aria-expanded={row.open}
                    aria-label={t('roadmap.toggle', 'Show or hide {{name}}', {
                        name,
                    })}
                    data-testid={`roadmap-toggle-${row.key}`}
                    className="flex h-11 w-7 flex-shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                    <ChevronRightIcon
                        className={`h-4 w-4 transition-transform ${
                            row.open ? 'rotate-90' : ''
                        }`}
                    />
                </button>
                <div className="flex min-w-0 flex-col">
                    {to ? (
                        <Link
                            to={to}
                            className={`${nameClass} hover:underline`}
                        >
                            {name}
                        </Link>
                    ) : (
                        <span className={nameClass}>{name}</span>
                    )}
                    {meta}
                </div>
            </div>
        );
    };

    const renderSummary = (
        start: string | null,
        end: string | null,
        label: string,
        barClass: string,
        barHeight: number,
        faded: boolean
    ) => {
        const from = toDay(start);
        const to = toDay(end);
        if (from === null || to === null) return null;
        const position = barPosition(from, to, first, last);
        if (!position) return null;
        return (
            <div
                title={label}
                data-testid="roadmap-summary-bar"
                className={`absolute top-1/2 -translate-y-1/2 rounded-sm ${barClass} ${
                    faded ? 'opacity-50' : ''
                }`}
                style={{
                    left: `${position.left}%`,
                    width: `${position.width}%`,
                    minWidth: 4,
                    height: barHeight,
                }}
            />
        );
    };

    const renderBar = (row: RoadmapRow) => {
        if (row.kind === 'area') {
            return renderSummary(
                row.area.start,
                row.area.end,
                `${row.area.name ?? ''} ${summaryRange(row)}`,
                'bg-gray-500 dark:bg-gray-300',
                8,
                false
            );
        }
        if (row.kind === 'project') {
            return renderSummary(
                row.project.start,
                row.project.end,
                `${row.project.name} ${summaryRange(row)}`,
                'bg-gray-400 dark:bg-gray-400',
                6,
                !row.project.dated_from_tasks
            );
        }

        const { task } = row;
        const color = taskColor(task, today);
        const label = `${task.name} ${describeTask(task)}`;
        if (task.kind === 'due') {
            const center = dayCenter(
                toDay(task.due_date) as number,
                first,
                last
            );
            if (center === null) return null;
            return (
                <button
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => openTask(task.uid)}
                    className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm ${color}`}
                    style={{ left: `${center}%` }}
                />
            );
        }
        const from = toDay(task.start_date) as number;
        const to =
            task.kind === 'range' ? (toDay(task.due_date) as number) : from;
        const position = barPosition(
            Math.min(from, to),
            Math.max(from, to),
            first,
            last
        );
        if (!position) return null;
        return (
            <button
                type="button"
                title={label}
                aria-label={label}
                onClick={() => openTask(task.uid)}
                className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-md ${color} ${
                    task.kind === 'start' ? 'opacity-60' : ''
                }`}
                style={{
                    left: `${position.left}%`,
                    width: `${position.width}%`,
                    minWidth: 6,
                }}
            />
        );
    };

    const rowTint = (row: RoadmapRow) =>
        row.kind === 'area' ? 'bg-gray-500/[0.06] dark:bg-white/[0.05]' : '';

    const buttonClass =
        'rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700';
    const hasGoalRow = goals.length > 0 || (data?.goals_outside ?? 0) > 0;
    const goalRowHeight = lanes * GOAL_LANE_HEIGHT;
    const todayLeft = dayCenter(today, first, last);

    return (
        <div className="space-y-4" data-testid="roadmap-chart">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => goToQuarter(shiftQuarter(quarter, -1))}
                        aria-label={t(
                            'roadmap.previousQuarter',
                            'Previous quarter'
                        )}
                        data-testid="roadmap-previous"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <span
                        data-testid="roadmap-quarter"
                        className="min-w-[6rem] text-center text-sm font-semibold text-gray-900 dark:text-gray-100"
                    >
                        Q{quarter.quarter} {quarter.year}
                    </span>
                    <button
                        type="button"
                        onClick={() => goToQuarter(shiftQuarter(quarter, 1))}
                        aria-label={t('roadmap.nextQuarter', 'Next quarter')}
                        data-testid="roadmap-next"
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        <ChevronRightIcon className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => goToQuarter(quarterOfDay(today))}
                        className={`${buttonClass} ml-1`}
                    >
                        {t('roadmap.thisQuarter', 'This quarter')}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => changeOpen(new Set(allKeys(areas)))}
                        className={buttonClass}
                    >
                        {t('roadmap.expandAll', 'Expand all')}
                    </button>
                    <button
                        type="button"
                        onClick={() => changeOpen(new Set())}
                        className={buttonClass}
                    >
                        {t('roadmap.collapseAll', 'Collapse all')}
                    </button>
                </div>
            </div>

            {failed && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {t('roadmap.loadError', 'Could not load the roadmap.')}
                </p>
            )}

            {data && areas.length === 0 && !hasGoalRow ? (
                <p className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-400">
                    {t(
                        'roadmap.empty',
                        'Nothing to show yet. Bars come from the start and due dates of tasks in your projects.'
                    )}
                </p>
            ) : (
                <div className="flex overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-900">
                    <div className="w-44 flex-shrink-0 shadow-[1px_0_0_rgba(0,0,0,0.06)] sm:w-80 dark:shadow-[1px_0_0_rgba(255,255,255,0.06)]">
                        <div
                            className="flex items-end px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            {t('roadmap.items', 'Area / Project / Task')}
                        </div>
                        {hasGoalRow && (
                            <div
                                className="flex flex-col justify-center bg-violet-500/[0.07] px-3 dark:bg-violet-400/[0.1]"
                                style={{ height: goalRowHeight }}
                            >
                                <span className="truncate text-sm font-semibold text-violet-900 dark:text-violet-200">
                                    {t('goals.title', 'Goals')}
                                </span>
                                {(data?.goals_outside ?? 0) > 0 && (
                                    <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                                        {t(
                                            'roadmap.goalsOutside',
                                            'Outside this quarter: {{count}}',
                                            { count: data?.goals_outside }
                                        )}
                                    </span>
                                )}
                            </div>
                        )}
                        {rows.map((row) => (
                            <div
                                key={row.key}
                                className={rowTint(row)}
                                style={{ height: ROW_HEIGHT }}
                            >
                                {renderName(row)}
                            </div>
                        ))}
                    </div>

                    <div className="min-w-0 flex-1 overflow-x-auto">
                        <div className="relative min-w-[640px]">
                            <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0"
                            >
                                {months.map((month) => (
                                    <div
                                        key={month.day}
                                        className="absolute inset-y-0 w-px bg-gray-500/10 dark:bg-white/10"
                                        style={{ left: `${month.left}%` }}
                                    />
                                ))}
                                {goals.map(({ goal, left }) => (
                                    <div
                                        key={goal.uid}
                                        className="absolute bottom-0 border-l border-dashed border-violet-400/70 dark:border-violet-300/50"
                                        style={{
                                            left: `${left}%`,
                                            top: HEADER_HEIGHT,
                                        }}
                                    />
                                ))}
                                {todayLeft !== null && (
                                    <div
                                        data-testid="roadmap-today"
                                        className="absolute inset-y-0 w-0.5 bg-blue-600 dark:bg-blue-400"
                                        style={{ left: `${todayLeft}%` }}
                                    />
                                )}
                            </div>

                            <div
                                className="relative"
                                style={{ height: HEADER_HEIGHT }}
                            >
                                {months.map((month) => (
                                    <span
                                        key={month.day}
                                        className="absolute top-1 whitespace-nowrap pl-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300"
                                        style={{ left: `${month.left}%` }}
                                    >
                                        {format(dateOf(month.day), 'MMM')}
                                    </span>
                                ))}
                                {weeks.map((week) => (
                                    <span
                                        key={week.day}
                                        className="absolute bottom-2 whitespace-nowrap pl-1 text-[11px] text-gray-500 dark:text-gray-400"
                                        style={{ left: `${week.left}%` }}
                                    >
                                        {format(dateOf(week.day), 'd')}
                                    </span>
                                ))}
                            </div>

                            {hasGoalRow && (
                                <div
                                    className="relative bg-violet-500/[0.07] dark:bg-violet-400/[0.1]"
                                    style={{ height: goalRowHeight }}
                                >
                                    {goals.map(
                                        ({ goal, day, left, lane, flip }) => (
                                            <Link
                                                key={goal.uid}
                                                to={`/goal/${createUidSlug(goal.uid, goal.title)}`}
                                                title={`${goal.title}, ${formatDay(day)}`}
                                                data-testid="roadmap-goal"
                                                className={`absolute flex items-center gap-2.5 hover:underline ${
                                                    flip
                                                        ? '-translate-x-full flex-row-reverse'
                                                        : ''
                                                }`}
                                                style={{
                                                    left: `${left}%`,
                                                    top:
                                                        lane * GOAL_LANE_HEIGHT,
                                                    height: GOAL_LANE_HEIGHT,
                                                    marginLeft: flip ? 8 : -8,
                                                }}
                                            >
                                                <span
                                                    className={`h-4 w-4 flex-shrink-0 rotate-45 rounded-sm ${
                                                        goal.status ===
                                                        'achieved'
                                                            ? 'bg-violet-300 dark:bg-violet-700'
                                                            : 'bg-violet-500 dark:bg-violet-300'
                                                    }`}
                                                />
                                                <span
                                                    className={`flex max-w-[9rem] flex-col ${
                                                        flip ? 'text-right' : ''
                                                    }`}
                                                >
                                                    <span className="truncate text-xs font-semibold text-violet-900 dark:text-violet-100">
                                                        {goal.title}
                                                    </span>
                                                    <span className="text-[11px] text-violet-700 dark:text-violet-300">
                                                        {formatDay(day)}
                                                    </span>
                                                </span>
                                            </Link>
                                        )
                                    )}
                                </div>
                            )}

                            {rows.map((row) => (
                                <div
                                    key={row.key}
                                    className={`relative ${rowTint(row)}`}
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    {renderBar(row)}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rotate-45 rounded-sm bg-violet-500 dark:bg-violet-300" />
                    {t('roadmap.legendGoal', 'Goal target date')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2 w-6 rounded-sm bg-gray-500 dark:bg-gray-300" />
                    {t('roadmap.legendArea', 'Area summary')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-6 rounded-sm bg-gray-400" />
                    {t('roadmap.legendProject', 'Project summary')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-6 rounded bg-blue-300 dark:bg-blue-700" />
                    {t('projectTimeline.legendRange', 'Start → Due')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rotate-45 rounded-sm bg-blue-300 dark:bg-blue-700" />
                    {t('projectTimeline.legendDue', 'Due date only')}
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-6 rounded bg-orange-500" />
                    {t('projectTimeline.legendOverdue', 'Overdue')}
                </span>
            </div>

            {panelTask && (
                <TaskModal
                    isOpen
                    onClose={() => {
                        setPanelTask(null);
                        setReloadCount((count) => count + 1);
                    }}
                    task={panelTask}
                />
            )}
        </div>
    );
};

export default RoadmapChart;
