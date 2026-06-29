import React, {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
    SparklesIcon,
    ArrowPathIcon,
    ExclamationCircleIcon,
    LightBulbIcon,
    ArrowRightIcon,
    ExclamationTriangleIcon,
    HeartIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import {
    fetchProjectInsights,
    fetchCachedProjectInsights,
    updateProjectInsightsDismissed,
    ProjectInsights,
    ProjectInsightsRequest,
} from '../../utils/aiAssistantService';

export interface ProjectAIInsightsHandle {
    activate: () => void;
}

interface ProjectAIInsightsProps {
    project: Project;
    taskStats?: {
        total: number;
        completed: number;
        inProgress: number;
        notStarted: number;
        overdue: number;
    };
    onActiveChange?: (active: boolean) => void;
}

const ProjectAIInsights = forwardRef<
    ProjectAIInsightsHandle,
    ProjectAIInsightsProps
>(({ project, taskStats, onActiveChange }, ref) => {
    const { t } = useTranslation();
    const [insights, setInsights] = useState<ProjectInsights | null>(null);
    const [dismissed, setDismissed] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [noCache, setNoCache] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const buildPayload = (): ProjectInsightsRequest => ({
        projectUid: project.uid,
        projectName: project.name,
        projectDescription: project.description || undefined,
        projectStatus: project.status || undefined,
        projectPriority:
            typeof project.priority === 'number'
                ? project.priority
                : project.priority === 'low'
                  ? 0
                  : project.priority === 'medium'
                    ? 1
                    : project.priority === 'high'
                      ? 2
                      : null,
        projectDueDate: project.due_date_at || undefined,
        projectGoal: project.Goal?.title || project.goal?.title || undefined,
        projectArea: (project.area as any)?.name || undefined,
        totalTasks: taskStats?.total,
        openTasks: taskStats ? taskStats.total - taskStats.completed : undefined,
        completedTasks: taskStats?.completed,
        inProgressTasks: taskStats?.inProgress,
        overdueTaskCount: taskStats?.overdue,
    });

    const dismiss = () => {
        setDismissed(true);
        if (project.uid) updateProjectInsightsDismissed(project.uid, true).catch(() => {});
    };

    const show = () => {
        setDismissed(false);
        if (project.uid) updateProjectInsightsDismissed(project.uid, false).catch(() => {});
    };

    const generate = async () => {
        setDismissed(false);
        setNoCache(false);
        setIsLoading(true);
        setError(null);
        setInsights(null);
        try {
            const result = await fetchProjectInsights(buildPayload());
            setInsights(result);
        } catch (err: any) {
            setError(err?.message || t('aiAssistant.errorDefault'));
        } finally {
            setIsLoading(false);
        }
    };

    useImperativeHandle(ref, () => ({
        activate: () => {
            if (isInitializing) return;
            if (noCache) {
                generate();
            } else if (dismissed) {
                show();
            } else {
                dismiss();
            }
        },
    }));

    const prevActiveRef = useRef<boolean | null>(null);
    useEffect(() => {
        if (isInitializing) return;
        const isActive = !dismissed && (!!insights || isLoading || !!error);
        if (prevActiveRef.current !== isActive) {
            prevActiveRef.current = isActive;
            onActiveChange?.(isActive);
        }
    }, [dismissed, insights, isLoading, error, isInitializing]);

    useEffect(() => {
        let cancelled = false;

        setInsights(null);
        setDismissed(false);
        setNoCache(false);
        setError(null);
        setIsLoading(false);
        setIsInitializing(true);

        const init = async () => {
            if (project.uid) {
                try {
                    const cached = await fetchCachedProjectInsights(project.uid);
                    if (cancelled) return;
                    setIsInitializing(false);
                    if (cached) {
                        setInsights(cached);
                        setDismissed(cached.dismissed ?? false);
                    } else {
                        setNoCache(true);
                    }
                } catch {
                    if (cancelled) return;
                    setIsInitializing(false);
                    setNoCache(true);
                }
            } else {
                setIsInitializing(false);
                setNoCache(true);
            }
        };

        init();
        return () => {
            cancelled = true;
        };
    }, [project.uid]);

    if (isInitializing) {
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2">
                    <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        {t('aiAssistant.projectInsightsTitle', 'AI Insights')}
                    </span>
                    <ArrowPathIcon className="h-3 w-3 text-gray-300 dark:text-gray-600 animate-spin ml-1" />
                </div>
            </div>
        );
    }

    if (noCache && !isLoading) {
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2">
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('aiAssistant.projectInsightsTitle', 'AI Insights')}
                        </span>
                    </div>
                    <button
                        onClick={generate}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                        <SparklesIcon className="h-3 w-3" />
                        {t('aiAssistant.generate', 'Generate Brief')}
                    </button>
                </div>
                {taskStats && <TaskStatsBar taskStats={taskStats} t={t} />}
            </div>
        );
    }

    if (dismissed && !isLoading) {
        return null;
    }

    return (
        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        {t('aiAssistant.projectInsightsTitle', 'AI Insights')}
                    </span>
                    {insights && !isLoading && insights.generated_at && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(insights.generated_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={generate}
                        disabled={isLoading}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <>
                                <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                {t('aiAssistant.generating')}
                            </>
                        ) : (
                            <>
                                <ArrowPathIcon className="h-3 w-3" />
                                {t('aiAssistant.regenerate')}
                            </>
                        )}
                    </button>
                    <button
                        onClick={dismiss}
                        disabled={isLoading}
                        title={t('common.close', 'Close')}
                        className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <XMarkIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {taskStats && <TaskStatsBar taskStats={taskStats} t={t} />}

            <div className="p-4 space-y-3">
                {error && (
                    <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                        <ExclamationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {isLoading && (
                    <div className="space-y-3 animate-pulse">
                        {[...Array(3)].map((_, i) => (
                            <div
                                key={i}
                                className="flex items-start gap-3 px-3 py-3 rounded-lg border border-gray-100 dark:border-gray-700/50"
                            >
                                <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 mt-0.5" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-full" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-4/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {insights && !isLoading && (
                    <>
                        {insights.insight && (
                            <InsightCard
                                icon={LightBulbIcon}
                                label={t('aiAssistant.projectInsight', 'About this project')}
                                text={insights.insight}
                                colorClass="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40 text-indigo-500 dark:text-indigo-400 [&_p:last-child]:text-indigo-900 [&_p:last-child]:dark:text-indigo-100"
                                delay={0}
                            />
                        )}
                        {insights.next_action && (
                            <InsightCard
                                icon={ArrowRightIcon}
                                label={t('aiAssistant.projectNextAction', 'Next action')}
                                text={insights.next_action}
                                colorClass="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40 text-blue-500 dark:text-blue-400 [&_p:last-child]:text-blue-900 [&_p:last-child]:dark:text-blue-100"
                                delay={100}
                            />
                        )}
                        {insights.health && (
                            <InsightCard
                                icon={HeartIcon}
                                label={t('aiAssistant.projectHealth', 'Project health')}
                                text={insights.health}
                                colorClass="bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30 text-green-600 dark:text-green-400 [&_p:last-child]:text-green-900 [&_p:last-child]:dark:text-green-100"
                                delay={200}
                            />
                        )}
                        {insights.watch_out && (
                            <InsightCard
                                icon={ExclamationTriangleIcon}
                                label={t('aiAssistant.watchOut')}
                                text={insights.watch_out}
                                colorClass="bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30 text-amber-500 dark:text-amber-400 [&_p:last-child]:text-amber-900 [&_p:last-child]:dark:text-amber-200"
                                delay={300}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
});

ProjectAIInsights.displayName = 'ProjectAIInsights';

export default ProjectAIInsights;

const TaskStatsBar: React.FC<{
    taskStats: NonNullable<ProjectAIInsightsProps['taskStats']>;
    t: ReturnType<typeof import('react-i18next').useTranslation>['t'];
}> = ({ taskStats, t }) => (
    <div className="grid grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800 border-b border-gray-100 dark:border-gray-800">
        <div className="px-3 py-3 text-center">
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 tabular-nums">
                {taskStats.total}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">
                {t('aiAssistant.statTotal', 'Total')}
            </p>
        </div>
        <div className="px-3 py-3 text-center">
            <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                {taskStats.completed}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">
                {t('aiAssistant.statDone', 'Done')}
            </p>
        </div>
        <div className="px-3 py-3 text-center">
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {taskStats.inProgress}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">
                {t('aiAssistant.statActive', 'Active')}
            </p>
        </div>
        <div className="px-3 py-3 text-center">
            <p className={`text-2xl font-bold tabular-nums ${taskStats.overdue > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-600'}`}>
                {taskStats.overdue}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mt-0.5">
                {t('aiAssistant.statOverdue', 'Overdue')}
            </p>
        </div>
    </div>
);

const InsightCard: React.FC<{
    icon: React.ElementType;
    label: string;
    text: string;
    colorClass: string;
    delay: number;
}> = ({ icon: Icon, label, text, colorClass, delay }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(id);
    }, [delay]);

    return (
        <div
            className={`flex items-start gap-3 px-3 py-3 rounded-lg border transition-all duration-500 ${colorClass} ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
        >
            <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1">
                    {label}
                </p>
                <p className="text-sm leading-relaxed">{text}</p>
            </div>
        </div>
    );
};
