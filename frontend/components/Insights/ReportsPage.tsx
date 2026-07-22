import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';
import {
    ArchiveBoxIcon,
    ExclamationTriangleIcon,
    ClockIcon,
    NoSymbolIcon,
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
        total_active: number;
    };
    completion_trends: {
        weeks: WeekData[];
    };
    area_balance: AreaBalance[];
}

const CHART_MARGINS = { top: 8, right: 8, bottom: 32, left: 32 };

function BarChart({ weeks }: { weeks: WeekData[] }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(400);
    const HEIGHT = 140;

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

    return (
        <div ref={containerRef} className="w-full" style={{ height: HEIGHT }}>
            <svg width={width} height={HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
                {[0, Math.round(maxCount / 2), maxCount].map((tick) => {
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
                                y={y}
                                width={bw}
                                height={barH}
                                rx={2}
                                className={
                                    isRecent
                                        ? 'fill-indigo-500 dark:fill-indigo-400'
                                        : 'fill-gray-200 dark:fill-gray-700'
                                }
                            />
                            {w.count > 0 && (
                                <text
                                    x={x + bw / 2}
                                    y={y - 3}
                                    textAnchor="middle"
                                    fontSize={9}
                                    fill="currentColor"
                                    className="text-gray-500 dark:text-gray-400"
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
                                {w.label === 'This week' || w.label === 'Last week'
                                    ? w.label
                                    : w.label}
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

    return (
        <div className="space-y-3">
            {areas.map((area) => {
                const total = area.completed + area.open;
                const completedPct = (area.completed / maxTotal) * 100;
                const openPct = (area.open / maxTotal) * 100;
                return (
                    <div key={area.id}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60%]">
                                {area.name}
                            </span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                {area.completed} done &middot; {area.open} open
                            </span>
                        </div>
                        <div className="flex h-2 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
                            <div
                                className="bg-emerald-400 dark:bg-emerald-500"
                                style={{ width: `${completedPct}%` }}
                            />
                            <div
                                className="bg-indigo-200 dark:bg-indigo-800"
                                style={{ width: `${openPct}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                            {total > 0
                                ? `${Math.round((area.completed / total) * 100)}% completion rate`
                                : 'No tasks'}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

const ReportsPage: React.FC = () => {
    const { t } = useTranslation();
    const [report, setReport] = useState<GtdReport | null>(null);
    const [loading, setLoading] = useState(true);

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

    if (!report) {
        return (
            <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
                <p className="text-sm text-gray-500">{t('common.error', 'Failed to load reports.')}</p>
            </div>
        );
    }

    const { weekly_review, project_health, completion_trends, area_balance } = report;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8 space-y-6">
            <h2 className="text-2xl font-light">{t('sidebar.reports', 'Reports')}</h2>

            {/* Weekly Review */}
            <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    {t('reports.weeklyReview', 'Weekly Review')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-center gap-3">
                        <ArchiveBoxIcon className="h-8 w-8 text-amber-400 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {weekly_review.inbox_count}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('reports.inboxItems', 'Inbox items')}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-center gap-3">
                        <ExclamationTriangleIcon className="h-8 w-8 text-red-400 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {weekly_review.stalled_projects.length}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('reports.stalledProjects', 'Stalled projects')}
                            </p>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex items-center gap-3">
                        <ClockIcon className="h-8 w-8 text-blue-400 flex-shrink-0" />
                        <div>
                            <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                {weekly_review.waiting_for.length}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                {t('reports.waitingFor', 'Waiting for')}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {weekly_review.stalled_projects.length > 0 && (
                        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                                {t('reports.stalledProjects', 'Stalled Projects')}
                            </h4>
                            <ul className="space-y-2">
                                {weekly_review.stalled_projects.map((p) => (
                                    <li key={p.id} className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-800 dark:text-gray-200">
                                                {p.name}
                                            </p>
                                            {p.area && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    {p.area}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs text-red-400 ml-2 whitespace-nowrap">
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
                            <ul className="space-y-2">
                                {weekly_review.waiting_for.map((p) => (
                                    <li key={p.id} className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm text-gray-800 dark:text-gray-200">
                                                {p.name}
                                            </p>
                                            {p.area && (
                                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                                    {p.area}
                                                </p>
                                            )}
                                        </div>
                                        <span className="text-xs text-blue-400 ml-2 whitespace-nowrap">
                                            {p.days_waiting}d
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {weekly_review.stalled_projects.length === 0 &&
                        weekly_review.waiting_for.length === 0 && (
                            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                                <p className="text-sm text-emerald-500 dark:text-emerald-400">
                                    {t('reports.allClear', 'All clear — no stalled projects or waiting-for items.')}
                                </p>
                            </div>
                        )}
                </div>
            </section>

            {/* Project Health */}
            <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    {t('reports.projectHealth', 'Project Health')}
                </h3>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                    {project_health.action_debt.length === 0 ? (
                        <p className="text-sm text-emerald-500 dark:text-emerald-400">
                            {t('reports.allProjectsHaveActions', 'All active projects have at least one next action.')}
                        </p>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 mb-3">
                                <NoSymbolIcon className="h-4 w-4 text-orange-400" />
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {project_health.action_debt.length}{' '}
                                    {t('reports.projectsWithNoNextAction', 'project(s) have no next action')}
                                </p>
                            </div>
                            <ul className="space-y-1.5">
                                {project_health.action_debt.map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <span className="text-gray-800 dark:text-gray-200">
                                            {p.name}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            {p.area && (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                                    {p.area}
                                                </span>
                                            )}
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                                {p.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </section>

            {/* Completion Trends */}
            <section>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                    {t('reports.completionTrends', 'Completion Trends')} &mdash; 8 weeks
                </h3>
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4">
                    {completion_trends.weeks.every((w) => w.count === 0) ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                            {t('reports.noCompletions', 'No completed tasks in the past 8 weeks.')}
                        </p>
                    ) : (
                        <BarChart weeks={completion_trends.weeks} />
                    )}
                </div>
            </section>

            {/* Area Balance */}
            <section>
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
                            </div>
                            <AreaBalanceChart areas={area_balance} />
                        </>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ReportsPage;
