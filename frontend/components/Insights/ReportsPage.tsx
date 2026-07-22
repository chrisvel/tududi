import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';
import {
    ArchiveBoxIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    NoSymbolIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface StalledProject {
    id: number;
    name: string;
    area: string | null;
    last_activity: string;
    days_stale: number;
}

interface WaitingForProject {
    id: number;
    name: string;
    area: string | null;
    waiting_since: string;
    days_waiting: number;
}

interface ActionDebtProject {
    id: number;
    name: string;
    status: string;
    area: string | null;
}

interface WeekData {
    week: string;
    label: string;
    count: number;
}

interface AreaBalance {
    id: number;
    name: string;
    completed: number;
    open: number;
}

interface GtdReport {
    weekly_review: {
        inbox_count: number;
        stalled_projects: StalledProject[];
        waiting_for: WaitingForProject[];
    };
    project_health: {
        action_debt: ActionDebtProject[];
        total_projects: number;
    };
    completion_trends: {
        weeks: WeekData[];
    };
    area_balance: AreaBalance[];
}

const CHART_MARGINS = { top: 16, right: 8, bottom: 32, left: 32 };

function staleBadgeColor(days: number) {
    if (days >= 30) return 'text-red-500 bg-red-50 dark:bg-red-900/20';
    if (days >= 21) return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
    return 'text-amber-500 bg-amber-50 dark:bg-amber-900/20';
}

function waitBadgeColor(days: number) {
    if (days >= 14) return 'text-red-500 bg-red-50 dark:bg-red-900/20';
    if (days >= 7) return 'text-orange-500 bg-orange-50 dark:bg-orange-900/20';
    return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
}

function BarChart({ weeks }: { weeks: WeekData[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(400);
    const HEIGHT = 160;

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const w = entries[0].contentRect.width;
            if (w > 0) setWidth(w);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const plotW = width - CHART_MARGINS.left - CHART_MARGINS.right;
    const plotH = HEIGHT - CHART_MARGINS.top - CHART_MARGINS.bottom;
    const maxCount = useMemo(() => Math.max(...weeks.map((w) => w.count), 1), [weeks]);
    const barWidth = plotW / weeks.length;
    const BAR_GAP = 4;

    const yTicks = useMemo(() => {
        const top = maxCount;
        const mid = Math.round(maxCount / 2);
        return [0, mid, top].filter((v, i, arr) => arr.indexOf(v) === i);
    }, [maxCount]);

    return (
        <div ref={containerRef} className="w-full" style={{ height: HEIGHT }}>
            <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
                {yTicks.map((tick) => {
                    const y = CHART_MARGINS.top + plotH - (tick / maxCount) * plotH;
                    return (
                        <g key={tick}>
                            <line
                                x1={CHART_MARGINS.left}
                                y1={y}
                                x2={CHART_MARGINS.left + plotW}
                                y2={y}
                                stroke="currentColor"
                                className="text-gray-100 dark:text-gray-800"
                                strokeWidth={1}
                            />
                            <text
                                x={CHART_MARGINS.left - 4}
                                y={y + 3}
                                textAnchor="end"
                                fontSize={9}
                                fill="currentColor"
                                className="text-gray-400 dark:text-gray-500"
                            >
                                {tick}
                            </text>
                        </g>
                    );
                })}

                {weeks.map((w, i) => {
                    const barH = maxCount === 0 ? 0 : (w.count / maxCount) * plotH;
                    const x = CHART_MARGINS.left + i * barWidth + BAR_GAP / 2;
                    const y = CHART_MARGINS.top + plotH - barH;
                    const bw = barWidth - BAR_GAP;
                    const isRecent = i >= weeks.length - 2;
                    return (
                        <g key={w.week}>
                            <rect
                                x={x}
                                y={barH === 0 ? y - 1 : y}
                                width={bw}
                                height={barH === 0 ? 2 : barH}
                                rx={2}
                                className={
                                    isRecent
                                        ? 'fill-indigo-500 dark:fill-indigo-400'
                                        : 'fill-gray-200 dark:fill-gray-700'
                                }
                                opacity={barH === 0 ? 0.3 : 1}
                            />
                            {w.count > 0 && (
                                <text
                                    x={x + bw / 2}
                                    y={y - 4}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fontWeight={isRecent ? '600' : '400'}
                                    fill="currentColor"
                                    className={
                                        isRecent
                                            ? 'text-indigo-600 dark:text-indigo-300'
                                            : 'text-gray-400 dark:text-gray-500'
                                    }
                                >
                                    {w.count}
                                </text>
                            )}
                            <text
                                x={x + bw / 2}
                                y={CHART_MARGINS.top + plotH + 14}
                                textAnchor="middle"
                                fontSize={8}
                                fill="currentColor"
                                className="text-gray-400 dark:text-gray-500"
                            >
                                {w.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function AreaBalanceChart({ areas }: { areas: AreaBalance[] }) {
    const maxTotal = useMemo(
        () => Math.max(...areas.map((a) => a.completed + a.open), 1),
        [areas]
    );

    const sorted = useMemo(
        () => [...areas].sort((a, b) => {
            const rateA = a.completed / Math.max(a.completed + a.open, 1);
            const rateB = b.completed / Math.max(b.completed + b.open, 1);
            return rateB - rateA;
        }),
        [areas]
    );

    return (
        <div className="space-y-4">
            {sorted.map((area, idx) => {
                const total = area.completed + area.open;
                const completedPct = (area.completed / maxTotal) * 100;
                const openPct = (area.open / maxTotal) * 100;
                const rate = total > 0 ? Math.round((area.completed / total) * 100) : 0;
                const isTop = idx === 0 && area.completed > 0;
                const isBottom = idx === sorted.length - 1 && sorted.length > 1;
                return (
                    <div key={area.id}>
                        <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                    {area.name}
                                </span>
                                {isTop && (
                                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium whitespace-nowrap">
                                        most active
                                    </span>
                                )}
                                {isBottom && rate < 20 && (
                                    <span className="text-[10px] text-orange-400 font-medium whitespace-nowrap">
                                        needs attention
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                    {area.completed} done &middot; {area.open} open
                                </span>
                                <span
                                    className={`text-xs font-medium whitespace-nowrap ${
                                        rate >= 50
                                            ? 'text-emerald-500'
                                            : rate >= 25
                                              ? 'text-amber-500'
                                              : 'text-red-400'
                                    }`}
                                >
                                    {rate}%
                                </span>
                            </div>
                        </div>
                        <div className="flex h-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <div
                                className="bg-emerald-400 dark:bg-emerald-500 transition-all"
                                style={{ width: `${completedPct}%` }}
                            />
                            <div
                                className="bg-indigo-200 dark:bg-indigo-800 transition-all"
                                style={{ width: `${openPct}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

type Tab = 'weekly' | 'trends';

const ReportsPage: React.FC = () => {
    const { t } = useTranslation();
    const [report, setReport] = useState<GtdReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<Tab>('weekly');

    useEffect(() => {
        fetch(getApiPath('reports/gtd'), {
            credentials: 'include',
            headers: getDefaultHeaders(),
        })
            .then((r) => r.json())
            .then(setReport)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
        );
    }

    if (!report || !report.weekly_review) {
        return (
            <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
                <p className="text-sm text-gray-500">{t('common.error', 'Failed to load reports.')}</p>
            </div>
        );
    }

    const { weekly_review, project_health, completion_trends, area_balance } = report;
    const { action_debt, total_projects } = project_health;

    const totalCompleted = completion_trends.weeks.reduce((s, w) => s + w.count, 0);
    const avgPerWeek = Math.round(totalCompleted / completion_trends.weeks.length);
    const bestWeek = completion_trends.weeks.reduce(
        (best, w) => (w.count > best.count ? w : best),
        completion_trends.weeks[0]
    );

    const tabs: { id: Tab; label: string }[] = [
        { id: 'weekly', label: t('reports.weeklyReview', 'Weekly Review') },
        { id: 'trends', label: t('reports.trends', 'Trends') },
    ];

    const oldestWait =
        weekly_review.waiting_for.length > 0 ? weekly_review.waiting_for[0] : null;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            <div className="flex items-center gap-3 mb-6">
                <h2 className="text-2xl font-light">{t('sidebar.reports', 'Reports')}</h2>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 dark:text-indigo-400">
                    beta
                </span>
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                            activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'weekly' && (
                <div className="space-y-6">
                    {/* Stat cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-start gap-3">
                            <ArchiveBoxIcon className={`h-8 w-8 flex-shrink-0 mt-0.5 ${weekly_review.inbox_count === 0 ? 'text-emerald-400' : 'text-amber-400'}`} />
                            <div>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {weekly_review.inbox_count}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('reports.inboxItems', 'Inbox items')}
                                </p>
                                <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                                    {weekly_review.inbox_count === 0
                                        ? 'Inbox zero'
                                        : weekly_review.inbox_count === 1
                                          ? '1 item to process'
                                          : `${weekly_review.inbox_count} items to process`}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-start gap-3">
                            <ExclamationTriangleIcon className={`h-8 w-8 flex-shrink-0 mt-0.5 ${weekly_review.stalled_projects.length === 0 ? 'text-emerald-400' : 'text-red-400'}`} />
                            <div>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {weekly_review.stalled_projects.length}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('reports.stalledProjects', 'Stalled projects')}
                                </p>
                                <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                                    {weekly_review.stalled_projects.length === 0
                                        ? 'All projects moving'
                                        : `No activity in 14+ days`}
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-start gap-3">
                            <ClockIcon className={`h-8 w-8 flex-shrink-0 mt-0.5 ${weekly_review.waiting_for.length === 0 ? 'text-emerald-400' : 'text-blue-400'}`} />
                            <div>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {weekly_review.waiting_for.length}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {t('reports.waitingFor', 'Waiting for')}
                                </p>
                                <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                                    {oldestWait
                                        ? `Oldest: ${oldestWait.name} (${oldestWait.days_waiting}d)`
                                        : 'Nothing pending'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Stalled + Waiting detail cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {weekly_review.stalled_projects.length > 0 && (
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                    {t('reports.stalledProjects', 'Stalled Projects')}
                                </h4>
                                <ul className="space-y-2.5">
                                    {weekly_review.stalled_projects.map((p) => (
                                        <li key={p.id} className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                                    {p.name}
                                                </p>
                                                {p.area && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                        {p.area}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${staleBadgeColor(p.days_stale)}`}>
                                                {p.days_stale}d stale
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {weekly_review.waiting_for.length > 0 && (
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                    {t('reports.waitingFor', 'Waiting For')}
                                </h4>
                                <ul className="space-y-2.5">
                                    {weekly_review.waiting_for.map((p) => (
                                        <li key={p.id} className="flex justify-between items-start gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                                    {p.name}
                                                </p>
                                                {p.area && (
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                        {p.area}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${waitBadgeColor(p.days_waiting)}`}>
                                                {p.days_waiting}d waiting
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {weekly_review.stalled_projects.length === 0 &&
                            weekly_review.waiting_for.length === 0 && (
                                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-center gap-2">
                                    <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                                    <p className="text-sm text-emerald-500 dark:text-emerald-400">
                                        {t('reports.allClear', 'All clear — no stalled projects or waiting-for items.')}
                                    </p>
                                </div>
                            )}
                    </div>

                    {/* Project Health */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                            {t('reports.projectHealth', 'Project Health')}
                        </h3>
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            {action_debt.length === 0 ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                                    <p className="text-sm text-emerald-500 dark:text-emerald-400">
                                        {total_projects > 0
                                            ? `All ${total_projects} active projects have a next action.`
                                            : t('reports.allProjectsHaveActions', 'All active projects have at least one next action.')}
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <NoSymbolIcon className="h-4 w-4 text-orange-400 flex-shrink-0" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {action_debt.length} of {total_projects} projects have no next action
                                            </p>
                                        </div>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden mb-4">
                                        <div
                                            className="h-full bg-emerald-400 dark:bg-emerald-500 rounded"
                                            style={{ width: `${((total_projects - action_debt.length) / total_projects) * 100}%` }}
                                        />
                                    </div>
                                    <ul className="space-y-2">
                                        {action_debt.map((p) => (
                                            <li key={p.id} className="flex items-center justify-between text-sm gap-2">
                                                <span className="text-gray-800 dark:text-gray-200 truncate">
                                                    {p.name}
                                                </span>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {p.area && (
                                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                                            {p.area}
                                                        </span>
                                                    )}
                                                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                                        {p.status.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'trends' && (
                <div className="space-y-6">
                    {/* Completion Trends */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                            {t('reports.completionTrends', 'Completion Trends')} &mdash; 8 weeks
                        </h3>
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            {totalCompleted === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    {t('reports.noCompletions', 'No completed tasks in the past 8 weeks.')}
                                </p>
                            ) : (
                                <>
                                    <div className="flex items-center gap-6 mb-4">
                                        <div>
                                            <p className="text-xl font-semibold text-gray-900 dark:text-white">
                                                {totalCompleted}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">total completed</p>
                                        </div>
                                        <div>
                                            <p className="text-xl font-semibold text-gray-900 dark:text-white">
                                                {avgPerWeek}
                                            </p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">avg / week</p>
                                        </div>
                                        {bestWeek.count > 0 && (
                                            <div>
                                                <p className="text-xl font-semibold text-indigo-500 dark:text-indigo-400">
                                                    {bestWeek.count}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    best ({bestWeek.label})
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    <BarChart weeks={completion_trends.weeks} />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Area Balance */}
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                            {t('reports.areaBalance', 'Area Balance')} &mdash; last 30 days
                        </h3>
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            {area_balance.length === 0 ? (
                                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                                    {t('reports.noAreaData', 'No area data available. Assign tasks to areas to see balance.')}
                                </p>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 mb-4 text-xs text-gray-400 dark:text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-2 rounded bg-emerald-400 dark:bg-emerald-500" />
                                            {t('reports.completed', 'Completed (30d)')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="inline-block w-3 h-2 rounded bg-indigo-200 dark:bg-indigo-800" />
                                            {t('reports.open', 'Open')}
                                        </span>
                                        <span className="flex items-center gap-1 ml-auto">
                                            % = completion rate
                                        </span>
                                    </div>
                                    <AreaBalanceChart areas={area_balance} />
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportsPage;
