import React from 'react';
import { Task } from '../../entities/Task';
import { TFunction } from 'i18next';

interface DueBuckets {
    overdue: Task[];
    week: Task[];
    month: Task[];
    unscheduled: Task[];
    totalDue: number;
}

interface TaskStats {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    overdue: number;
    dueSoon: number;
    completionRate: number;
}

interface ProjectInsightsPanelProps {
    taskStats: TaskStats;
    completionGradient: string;
    dueBuckets: DueBuckets;
    dueHighlights: Task[];
    nextBestAction: Task | null;
    getDueDescriptor: (task: Task) => string;
    onStartNextAction: () => Promise<void> | void;
    t: TFunction;
    completionTrend: { label: string; count: number }[];
    upcomingDueTrend: { label: string; count: number }[];
    createdTrend: { label: string; count: number }[];
    weeklyPace: { lastWeek: number; prevWeek: number; delta: number };
    monthlyCompleted: number;
    upcomingInsights?: {
        peakLabel: string;
        peakCount: number;
        nextThreeDays: number;
        nextWeek: number;
    };
    eisenhower: {
        urgentImportant: number;
        urgentNotImportant: number;
        notUrgentImportant: number;
        notUrgentNotImportant: number;
    };
}

const ProjectInsightsPanel: React.FC<ProjectInsightsPanelProps> = ({
    taskStats,
    completionGradient,
    nextBestAction,
    getDueDescriptor,
    onStartNextAction,
    t,
    upcomingDueTrend,
    weeklyPace,
    monthlyCompleted,
    upcomingInsights,
    eisenhower,
}) => {
    const maxUpcoming = Math.max(...upcomingDueTrend.map((d) => d.count), 1);

    return (
        <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('projects.progress', 'Progress')}
                        </p>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {t('projects.taskMomentum', 'Task momentum')}
                        </h3>
                    </div>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                        {taskStats.total} {t('tasks.tasks', 'tasks')}
                    </span>
                </div>

                <div className="mt-4 flex items-center gap-4">
                    <div className="relative w-28 h-28">
                        <div
                            className="w-full h-full rounded-full shadow-inner"
                            style={{
                                background: completionGradient,
                            }}
                        ></div>
                        <div className="absolute inset-3 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center text-center">
                            <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                {taskStats.completionRate}%
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t('common.done', 'done')}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
                            <span>
                                {t('projects.activeTasks', 'Active tasks')}
                            </span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {Math.max(
                                    taskStats.total - taskStats.completed,
                                    0
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span>
                                {taskStats.overdue}{' '}
                                {t('tasks.overdue', 'overdue')},{' '}
                                {taskStats.dueSoon}{' '}
                                {t('tasks.dueSoon', 'due soon')}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                <span>{t('tasks.progress', 'Progress')}</span>
                                <span className="font-semibold text-gray-700 dark:text-gray-200">
                                    {taskStats.completionRate}%
                                </span>
                            </div>
                            <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300 ease-in-out"
                                    style={{
                                        width: `${taskStats.total > 0 ? taskStats.completionRate : 0}%`,
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {t('projects.dueSchedule', 'Due schedule')}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('projects.next14Days', 'Next 14 days')}
                    </span>
                </div>
                {upcomingDueTrend.some((d) => d.count > 0) ? (
                    <>
                        <div className="mt-3 flex flex-wrap gap-1">
                            {upcomingDueTrend.map((d, idx) => {
                                const intensity =
                                    maxUpcoming > 0
                                        ? Math.max(
                                              (d.count / maxUpcoming) * 0.8,
                                              0.12
                                          )
                                        : 0;
                                return (
                                    <div
                                        key={idx}
                                        className="flex flex-col items-center"
                                        style={{
                                            width: 'calc(100% / 7 - 4px)',
                                        }}
                                    >
                                        <div
                                            className="w-full h-10 rounded-md border border-amber-200 dark:border-amber-800 transition-all duration-300"
                                            style={{
                                                backgroundColor: `rgba(251, 191, 36, ${intensity})`,
                                            }}
                                        ></div>
                                        <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                                            {d.label}
                                        </span>
                                        <span className="text-[10px] text-gray-600 dark:text-gray-300">
                                            {d.count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        {upcomingInsights && (
                            <div className="mt-4 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                                <span className="px-2 py-1 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-200">
                                    {t('projects.peakDay', 'Peak')}:{' '}
                                    {upcomingInsights.peakCount > 0
                                        ? `${upcomingInsights.peakLabel} · ${upcomingInsights.peakCount}`
                                        : t('projects.none', 'None')}
                                </span>
                                <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200">
                                    {t('projects.next3days', 'Next 3 days')}:{' '}
                                    {upcomingInsights.nextThreeDays}
                                </span>
                                <span className="px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-200">
                                    {t('projects.nextWeek', 'Next 7 days')}:{' '}
                                    {upcomingInsights.nextWeek}
                                </span>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'projects.noUpcomingDue',
                            'No due dates in the next 14 days.'
                        )}
                    </p>
                )}
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {t('projects.recentCompletion', 'Recent completion')}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('projects.last7And30', 'Last 7 & 30 days')}
                    </span>
                </div>

                <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t('projects.weeklyPace', 'Weekly pace')}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {weeklyPace.lastWeek}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t(
                                    'projects.prevWeekCompleted',
                                    '{{count}} prior week',
                                    {
                                        count: weeklyPace.prevWeek,
                                    }
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <div
                                className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                                    weeklyPace.delta >= 0
                                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200'
                                }`}
                            >
                                {weeklyPace.delta >= 0 ? '+' : ''}
                                {weeklyPace.delta}{' '}
                                {t('projects.vsPrevWeek', 'vs prev week')}
                            </div>
                            <div className="w-32 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                                    style={{
                                        width: `${Math.min(
                                            (weeklyPace.lastWeek /
                                                Math.max(
                                                    Math.max(
                                                        weeklyPace.lastWeek,
                                                        weeklyPace.prevWeek
                                                    ),
                                                    1
                                                )) *
                                                100,
                                            100
                                        )}%`,
                                    }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t(
                                    'projects.monthlyCompletion',
                                    '30-day completions'
                                )}
                            </p>
                            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {monthlyCompleted}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {t('projects.last30Days', 'Last 30 days')}
                            </p>
                        </div>
                        <div className="w-32 h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-300"
                                style={{
                                    width: `${Math.min(monthlyCompleted * 3, 100)}%`,
                                }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {t('projects.eisenhower', 'Eisenhower matrix')}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('projects.priorityVsUrgency', 'Priority vs urgency')}
                    </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
                    {[
                        {
                            label: t('projects.urgentImportant', 'Do now'),
                            value: eisenhower.urgentImportant,
                            accent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
                        },
                        {
                            label: t('projects.urgentNotImportant', 'Delegate'),
                            value: eisenhower.urgentNotImportant,
                            accent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200',
                        },
                        {
                            label: t('projects.notUrgentImportant', 'Schedule'),
                            value: eisenhower.notUrgentImportant,
                            accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200',
                        },
                        {
                            label: t(
                                'projects.notUrgentNotImportant',
                                'Drop/avoid'
                            ),
                            value: eisenhower.notUrgentNotImportant,
                            accent: 'bg-gray-100 text-gray-700 dark:bg-gray-800/60 dark:text-gray-200',
                        },
                    ].map((item, idx) => (
                        <div
                            key={idx}
                            className={`rounded-lg p-3 border border-gray-200 dark:border-gray-800 ${item.accent}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-semibold">
                                    {item.value}
                                </span>
                                <span className="text-[11px] uppercase tracking-wide">
                                    {item.label}
                                </span>
                            </div>
                            <div className="mt-2 h-1.5 rounded-full bg-white/30 dark:bg-gray-700 overflow-hidden">
                                <div
                                    className="h-full bg-white/80 dark:bg-white"
                                    style={{
                                        width: `${Math.min(item.value * 15, 100)}%`,
                                    }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {t('projects.nextUp', 'Next best action')}
                        </p>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                            {t('projects.focusTask', 'Most impactful task')}
                        </h3>
                    </div>
                    {nextBestAction && (
                        <span className="px-2 py-1 text-[11px] rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                            {getDueDescriptor(nextBestAction)}
                        </span>
                    )}
                </div>

                {nextBestAction ? (
                    <div className="mt-4 space-y-3">
                        <div className="flex items-start gap-3">
                            <div className="mt-1 w-2 h-2 rounded-full bg-blue-500" />
                            <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {nextBestAction.name}
                                </p>
                                {nextBestAction.note && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                        {nextBestAction.note}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                            {nextBestAction.priority && (
                                <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                                    {t('tasks.priority', 'Priority')}:{' '}
                                    {String(nextBestAction.priority)}
                                </span>
                            )}
                            {nextBestAction.today && (
                                <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200">
                                    {t('tasks.todayPlan', 'Today plan')}
                                </span>
                            )}
                            {(nextBestAction.status === 'in_progress' ||
                                nextBestAction.status === 1) && (
                                <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">
                                    {t('task.status.inProgress', 'In progress')}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={onStartNextAction}
                                disabled={
                                    (nextBestAction.status === 'in_progress' ||
                                        nextBestAction.status === 1) &&
                                    nextBestAction.today
                                }
                                className={`inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-white rounded-md transition-colors ${
                                    (nextBestAction.status === 'in_progress' ||
                                        nextBestAction.status === 1) &&
                                    nextBestAction.today
                                        ? 'bg-gray-400 dark:bg-gray-700 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {(nextBestAction.status === 'in_progress' ||
                                    nextBestAction.status === 1) &&
                                nextBestAction.today
                                    ? t('tasks.inProgress', 'In progress')
                                    : t('tasks.startNow', 'Start now')}
                            </button>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t(
                                    'projects.focusHint',
                                    'Shifts this task to in progress and today'
                                )}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {t(
                            'projects.noNextAction',
                            'All clear—no outstanding tasks.'
                        )}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ProjectInsightsPanel;
