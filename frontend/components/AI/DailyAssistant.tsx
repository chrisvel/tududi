import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SparklesIcon,
    ArrowPathIcon,
    ExclamationCircleIcon,
    BoltIcon,
    FlagIcon,
    ExclamationTriangleIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';
import { fetchDailyBrief, fetchCachedBrief, DailyBrief } from '../../utils/aiAssistantService';

const DailyAssistant: React.FC = () => {
    const { t } = useTranslation();
    const [brief, setBrief] = useState<DailyBrief | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingCached, setIsLoadingCached] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            setBrief(await fetchDailyBrief());
        } catch (err: any) {
            setError(err?.message || t('aiAssistant.errorDefault'));
        } finally {
            setIsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchCachedBrief()
            .then((cached) => {
                if (cached) {
                    setBrief(cached);
                } else {
                    generate();
                }
            })
            .catch(() => {})
            .finally(() => setIsLoadingCached(false));
    }, [generate]);

    if (!brief && !isLoading && !isLoadingCached && !error) return null;

    return (
        <div className="mb-4 bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <SparklesIcon className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                        {t('aiAssistant.title')}
                    </span>
                    {brief && (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {t('aiAssistant.generatedAt', {
                                time: new Date(brief.generated_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                }),
                            })}
                        </span>
                    )}
                </div>
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
                            <SparklesIcon className="h-3 w-3" />
                            {brief ? t('aiAssistant.regenerate') : t('aiAssistant.generate')}
                        </>
                    )}
                </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
                {/* Error */}
                {error && (
                    <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                        <ExclamationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Skeleton */}
                {(isLoading || isLoadingCached) && (
                    <div className="space-y-3 animate-pulse">
                        <div className="h-10 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg" />
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded flex-1" />
                                    <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Report */}
                {brief && !isLoading && (
                    <>
                        {/* Focus */}
                        {brief.focus && (
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/40">
                                <BoltIcon className="h-4 w-4 flex-shrink-0 text-indigo-500 dark:text-indigo-400" />
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mb-0.5">
                                        {t('aiAssistant.focusForToday')}
                                    </p>
                                    <p className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                                        {brief.focus}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Priority Actions */}
                        {(brief.priority_actions ?? []).length > 0 && (
                            <div>
                                <div className="flex items-center gap-1.5 mb-2">
                                    <FlagIcon className="h-3.5 w-3.5 text-blue-500" />
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                                        {t('aiAssistant.priorityActions')}
                                    </span>
                                </div>
                                <ol className="space-y-2">
                                    {(brief.priority_actions ?? []).map((item, i) => (
                                        <li key={i} className="flex items-start gap-2.5">
                                            <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-bold flex items-center justify-center leading-none">
                                                {i + 1}
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
                                                    {item.action}
                                                </p>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    {item.project && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                                            <FolderIcon className="h-2.5 w-2.5" />
                                                            {item.project}
                                                        </span>
                                                    )}
                                                    {item.reason && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            {item.reason}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.suggestion && (
                                                    <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 italic leading-snug">
                                                        {item.suggestion}
                                                    </p>
                                                )}
                                            </div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Watch Out */}
                        {(brief.watch_out ?? []).length > 0 && (
                            <div className="flex items-start gap-2.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30">
                                <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 dark:text-amber-400 mb-0.5">
                                        {t('aiAssistant.watchOut')}
                                    </p>
                                    <ul className="space-y-0.5">
                                        {(brief.watch_out ?? []).map((item, i) => (
                                            <li key={i} className="text-sm text-amber-900 dark:text-amber-200">
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DailyAssistant;
