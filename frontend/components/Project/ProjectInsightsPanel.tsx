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
}

const ProjectInsightsPanel: React.FC<ProjectInsightsPanelProps> = ({
    taskStats,
    completionGradient,
    dueBuckets,
    dueHighlights,
    nextBestAction,
    getDueDescriptor,
    onStartNextAction,
    t,
}) => {
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
                            <span>{t('projects.activeTasks', 'Active tasks')}</span>
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                                {Math.max(taskStats.total - taskStats.completed, 0)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span>
                                {taskStats.overdue} {t('tasks.overdue', 'overdue')},{' '}
                                {taskStats.dueSoon} {t('tasks.dueSoon', 'due soon')}
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
                        {t('tasks.statusBreakdown', 'Status breakdown')}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {t('common.now', 'Now')}
                    </span>
                </div>
                <div className="mt-3 space-y-3">
                    {[
                        {
                            label: t('common.completed', 'Completed'),
                            value: taskStats.completed,
                            color: '#22c55e',
                        },
                        {
                            label: t('task.status.inProgress', 'In progress'),
                            value: taskStats.inProgress,
                            color: '#3b82f6',
                        },
                        {
                            label: t('task.status.notStarted', 'Not started'),
                            value: taskStats.notStarted,
                            color: '#9ca3af',
                        },
                    ].map((item) => (
                        <div
                            key={item.label}
                            className="flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                        backgroundColor: item.color,
                                    }}
                                ></span>
                                <span className="text-sm text-gray-700 dark:text-gray-200">
                                    {item.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 w-32">
                                <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                                    <div
                                        className="h-full"
                                        style={{
                                            width: `${
                                                taskStats.total > 0
                                                    ? (item.value / taskStats.total) * 100
                                                    : 0
                                            }%`,
                                            backgroundColor: item.color,
                                        }}
                                    ></div>
                                </div>
                                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 w-6 text-right">
                                    {item.value}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {t('projects.dueHealth', 'Due health')}: <span className="font-medium text-gray-800 dark:text-gray-200">{taskStats.overdue}</span>{' '}
                    {t('tasks.overdue', 'overdue')} •{' '}
                    <span className="font-medium text-gray-800 dark:text-gray-200">{taskStats.dueSoon}</span>{' '}
                    {t('tasks.dueSoon', 'due soon')}
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
                                    {t('tasks.priority', 'Priority')}: {String(nextBestAction.priority)}
                                </span>
                            )}
                            {nextBestAction.today && (
                                <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200">
                                    {t('tasks.todayPlan', 'Today plan')}
                                </span>
                            )}
                            {(nextBestAction.status === 'in_progress' || nextBestAction.status === 1) && (
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
                                {t('projects.focusHint', 'Shifts this task to in progress and today')}
                            </span>
                        </div>
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {t('projects.noNextAction', 'All clear—no outstanding tasks.')}
                    </p>
                )}
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {t('projects.dueRadar', 'Due radar')}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                        {dueBuckets.totalDue} {t('tasks.tasks', 'tasks')}
                    </span>
                </div>

                {dueBuckets.totalDue > 0 ? (
                    <>
                        <div className="mt-3 flex items-center gap-2">
                            <div className="flex-1 h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex">
                                <div
                                    className="h-full bg-red-500"
                                    style={{
                                        flex: dueBuckets.overdue.length,
                                    }}
                                ></div>
                                <div
                                    className="h-full bg-amber-400"
                                    style={{
                                        flex: dueBuckets.week.length,
                                    }}
                                ></div>
                                <div
                                    className="h-full bg-blue-400"
                                    style={{
                                        flex: dueBuckets.month.length,
                                    }}
                                ></div>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                {t('projects.next30Days', 'Next 30 days')}
                            </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-300">
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="font-semibold">
                                    {dueBuckets.overdue.length}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {t('tasks.overdue', 'Overdue')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                <span className="font-semibold">
                                    {dueBuckets.week.length}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {t('tasks.dueSoon', 'Due soon')}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                <span className="font-semibold">
                                    {dueBuckets.month.length}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                    {t('projects.dueThisMonth', 'This month')}
                                </span>
                            </div>
                        </div>

                        {dueHighlights.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {dueHighlights.map((task) => (
                                    <div
                                        key={task.id}
                                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/80"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                            <span className="text-sm text-gray-800 dark:text-gray-200">
                                                {task.name}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            {getDueDescriptor(task)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {t('projects.noDueData', 'No due dates on upcoming tasks.')}
                    </p>
                )}
            </div>
        </div>
    );
};

export default ProjectInsightsPanel;
