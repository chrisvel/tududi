import React, {
    useState,
    useEffect,
    useRef,
    forwardRef,
    useImperativeHandle,
} from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    SparklesIcon,
    ArrowPathIcon,
    ExclamationCircleIcon,
    LightBulbIcon,
    ArrowRightIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
    ListBulletIcon,
    ArrowTopRightOnSquareIcon,
    LinkIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    fetchTaskInsights,
    fetchCachedTaskInsights,
    updateTaskInsightsDismissed,
    TaskInsights,
    TaskInsightLink,
    TaskInsightsRequest,
} from '../../utils/aiAssistantService';

export interface TaskAIInsightsHandle {
    activate: () => void;
}

interface TaskAIInsightsProps {
    task: Task;
    project?: Project | null;
    onActiveChange?: (active: boolean) => void;
}

function safeHref(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '#';
    } catch {
        return '#';
    }
}


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

const LinksCard: React.FC<{
    links: TaskInsightLink[];
    delay: number;
    t: TFunction;
}> = ({ links, delay, t }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(id);
    }, [delay]);

    return (
        <div
            className={`flex items-start gap-3 px-3 py-3 rounded-lg border transition-all duration-500 bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-700/50 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
        >
            <LinkIcon className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500" />
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-gray-400">
                    {t('aiAssistant.suggestedLinks', 'Suggested links')}
                </p>
                <div className="flex flex-wrap gap-2">
                    {links.map((link, i) => (
                        <a
                            key={i}
                            href={safeHref(link.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-indigo-300 dark:hover:border-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                        >
                            {link.label}
                            <ArrowTopRightOnSquareIcon className="h-3 w-3 flex-shrink-0" />
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
};

const BreakdownCard: React.FC<{
    steps: string[];
    delay: number;
    t: TFunction;
}> = ({ steps, delay, t }) => {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const id = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(id);
    }, [delay]);

    return (
        <div
            className={`flex items-start gap-3 px-3 py-3 rounded-lg border transition-all duration-500 bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/30 text-green-600 dark:text-green-400 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
        >
            <ListBulletIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2">
                    {t('aiAssistant.taskBreakdown', 'How to approach it')}
                </p>
                <ol className="space-y-1.5">
                    {steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-[10px] font-bold flex items-center justify-center leading-none mt-0.5">
                                {i + 1}
                            </span>
                            <span className="text-sm text-green-900 dark:text-green-100 leading-snug">{step}</span>
                        </li>
                    ))}
                </ol>
            </div>
        </div>
    );
};

const TaskAIInsights = forwardRef<TaskAIInsightsHandle, TaskAIInsightsProps>(
    ({ task, project, onActiveChange }, ref) => {
        const { t } = useTranslation();
        const [insights, setInsights] = useState<TaskInsights | null>(null);
        const [dismissed, setDismissed] = useState(false);
        const [isInitializing, setIsInitializing] = useState(true);
        const [noCache, setNoCache] = useState(false);
        const [isLoading, setIsLoading] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const [lowContext, setLowContext] = useState(false);

        const buildPayload = (): TaskInsightsRequest => ({
            taskUid: task.uid,
            taskName: task.name,
            taskNote: task.note || undefined,
            taskStatus: task.status,
            taskPriority: task.priority,
            taskDueDate: task.due_date || undefined,
            taskTags: task.tags?.map((tag) => tag.name) || [],
            subtaskCount: task.subtasks?.length || 0,
            projectName: project?.name || undefined,
            projectDescription: project?.description || undefined,
            projectStatus: project?.status || undefined,
            projectGoal: (project?.goal as any)?.title || undefined,
            projectArea: (project?.area as any)?.name || undefined,
        });

        const dismiss = () => {
            setDismissed(true);
            if (task.uid) updateTaskInsightsDismissed(task.uid, true).catch(() => {});
        };

        const show = () => {
            setDismissed(false);
            if (task.uid) updateTaskInsightsDismissed(task.uid, false).catch(() => {});
        };

        const generate = async () => {
            setDismissed(false);
            setNoCache(false);
            setIsLoading(true);
            setError(null);
            setInsights(null);
            setLowContext(false);
            try {
                const result = await fetchTaskInsights(buildPayload());
                setInsights(result);
            } catch (err: any) {
                setError(err?.message || t('aiAssistant.errorDefault'));
            } finally {
                setIsLoading(false);
            }
        };

        // Expose activate() to parent via ref for the header ✨ button
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

        // Notify parent when the panel's active (expanded) state changes
        const prevActiveRef = useRef<boolean | null>(null);
        useEffect(() => {
            if (isInitializing) return;
            const isActive = !dismissed && (!!insights || isLoading || !!error || lowContext);
            if (prevActiveRef.current !== isActive) {
                prevActiveRef.current = isActive;
                onActiveChange?.(isActive);
            }
        }, [dismissed, insights, isLoading, error, lowContext, isInitializing]);

        useEffect(() => {
            let cancelled = false;

            setInsights(null);
            setDismissed(false);
            setNoCache(false);
            setError(null);
            setLowContext(false);
            setIsLoading(false);
            setIsInitializing(true);

            const init = async () => {
                if (task.uid) {
                    try {
                        const cached = await fetchCachedTaskInsights(task.uid);
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
        }, [task.uid]);

        // ── Initializing: slim spinner header ──────────────────────────────
        if (isInitializing) {
            return (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2">
                        <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('aiAssistant.taskInsightsTitle', 'AI Insights')}
                        </span>
                        <ArrowPathIcon className="h-3 w-3 text-gray-300 dark:text-gray-600 animate-spin ml-1" />
                    </div>
                </div>
            );
        }

        // ── No cache: slim invite (first time, never generated) ────────────
        if (noCache && !isLoading) {
            return (
                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2">
                        <div className="flex items-center gap-2">
                            <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                            <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                {t('aiAssistant.taskInsightsTitle', 'AI Insights')}
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
                </div>
            );
        }

        // ── Dismissed: invisible — header ✨ button is the way back ──────────
        if (dismissed && !isLoading) {
            return null;
        }

        // ── Expanded ───────────────────────────────────────────────────────
        return (
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                        <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            {t('aiAssistant.taskInsightsTitle', 'AI Insights')}
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

                {/* Body */}
                <div className="p-4 space-y-3">
                    {error && (
                        <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                            <ExclamationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {lowContext && !isLoading && !insights && (
                        <div className="flex items-start gap-3 px-3 py-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
                            <InformationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5 text-yellow-600 dark:text-yellow-400" />
                            <div>
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    {t('aiAssistant.lowContextTitle', 'Not enough context for a great suggestion')}
                                </p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                                    {t('aiAssistant.lowContextHint', 'Add a description, notes, tags, or assign a project to get better insights. You can still generate below.')}
                                </p>
                                <button
                                    onClick={generate}
                                    className="mt-2 text-xs font-medium text-yellow-700 dark:text-yellow-300 underline underline-offset-2 hover:text-yellow-900 dark:hover:text-yellow-100"
                                >
                                    {t('aiAssistant.generateAnyway', 'Generate anyway')}
                                </button>
                            </div>
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
                                    label={t('aiAssistant.taskInsight', 'About this task')}
                                    text={insights.insight}
                                    colorClass="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/40 text-indigo-500 dark:text-indigo-400 [&_p:last-child]:text-indigo-900 [&_p:last-child]:dark:text-indigo-100"
                                    delay={0}
                                />
                            )}
                            {insights.next_step && (
                                <InsightCard
                                    icon={ArrowRightIcon}
                                    label={t('aiAssistant.taskNextStep', 'Next step')}
                                    text={insights.next_step}
                                    colorClass="bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/40 text-blue-500 dark:text-blue-400 [&_p:last-child]:text-blue-900 [&_p:last-child]:dark:text-blue-100"
                                    delay={100}
                                />
                            )}
                            {insights.breakdown && insights.breakdown.length > 0 && (
                                <BreakdownCard steps={insights.breakdown} delay={200} t={t} />
                            )}
                            {insights.links && insights.links.length > 0 && (
                                <LinksCard links={insights.links} delay={300} t={t} />
                            )}
                            {insights.watch_out && (
                                <InsightCard
                                    icon={ExclamationTriangleIcon}
                                    label={t('aiAssistant.watchOut')}
                                    text={insights.watch_out}
                                    colorClass="bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30 text-amber-500 dark:text-amber-400 [&_p:last-child]:text-amber-900 [&_p:last-child]:dark:text-amber-200"
                                    delay={400}
                                />
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }
);

TaskAIInsights.displayName = 'TaskAIInsights';

export default TaskAIInsights;
