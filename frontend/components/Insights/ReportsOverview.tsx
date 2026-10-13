import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ClipboardDocumentListIcon,
    ArrowPathIcon,
    FolderIcon,
    CheckCircleIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    CalendarDaysIcon,
    ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../../config/paths';
import { getDefaultHeaders } from '../../utils/authUtils';
import { fetchProjects } from '../../utils/projectsService';
import { Metrics } from '../../entities/Metrics';
import { Project } from '../../entities/Project';
import BurndownChart from './BurndownChart';
import LifeBalance from './LifeBalance';
import AreaDonut from './AreaDonut';

type OverviewMetrics = Metrics & { tasks_overdue?: unknown[] };

const ACTIVE_PROJECT_STATUSES = ['planned', 'in_progress', 'waiting'];

const getCompletionTrend = (todayCount: number, metrics: OverviewMetrics) => {
    if (metrics.weekly_completions.length === 0) {
        return { direction: 'same', percentage: 0 };
    }
    const totalCompleted = metrics.weekly_completions.reduce(
        (sum, c) => sum + c.count,
        0
    );
    const averageCount = totalCompleted / 7;
    let percentage = 0;
    if (averageCount > 0) {
        percentage = Math.round(
            ((todayCount - averageCount) / averageCount) * 100
        );
    } else if (todayCount > 0) {
        percentage = 100;
    }
    if (todayCount > averageCount) {
        return { direction: 'up', percentage: Math.abs(percentage) };
    }
    if (todayCount < averageCount) {
        return { direction: 'down', percentage: Math.abs(percentage) };
    }
    return { direction: 'same', percentage: 0 };
};

interface StatTileProps {
    icon: React.ComponentType<{ className?: string }>;
    value: number;
    label: string;
    active: boolean;
    tone: string;
    children?: React.ReactNode;
}

const TONES: Record<string, { bg: string; icon: string; text: string }> = {
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        icon: 'text-blue-400 dark:text-blue-500',
        text: 'text-blue-600 dark:text-blue-400',
    },
    green: {
        bg: 'bg-green-50 dark:bg-green-900/20',
        icon: 'text-green-400 dark:text-green-500',
        text: 'text-green-600 dark:text-green-400',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        icon: 'text-purple-400 dark:text-purple-500',
        text: 'text-purple-600 dark:text-purple-400',
    },
    red: {
        bg: 'bg-red-50 dark:bg-red-900/20',
        icon: 'text-red-400 dark:text-red-500',
        text: 'text-red-600 dark:text-red-400',
    },
    orange: {
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        icon: 'text-orange-400 dark:text-orange-500',
        text: 'text-orange-600 dark:text-orange-400',
    },
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        icon: 'text-emerald-400 dark:text-emerald-500',
        text: 'text-emerald-600 dark:text-emerald-400',
    },
    muted: {
        bg: 'bg-gray-50 dark:bg-gray-800/40',
        icon: 'text-gray-400 dark:text-gray-500',
        text: 'text-gray-600 dark:text-gray-400',
    },
};

const StatTile: React.FC<StatTileProps> = ({
    icon: Icon,
    value,
    label,
    active,
    tone,
    children,
}) => {
    const colors = TONES[active ? tone : 'muted'];
    return (
        <div
            className={`flex flex-col items-center justify-center rounded-lg p-2.5 gap-1 ${colors.bg}`}
        >
            <div className="flex items-center gap-1.5 leading-none">
                <Icon className={`h-4 w-4 flex-shrink-0 ${colors.icon}`} />
                <span
                    className={`text-2xl font-bold leading-none ${colors.text}`}
                >
                    {value}
                </span>
                {children}
            </div>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
                {label}
            </span>
        </div>
    );
};

const TrendTip: React.FC<{ up: boolean; text: string }> = ({ up, text }) => (
    <div className="relative group/tip">
        {up ? (
            <ArrowUpIcon className="h-3 w-3 text-emerald-500" />
        ) : (
            <ArrowDownIcon className="h-3 w-3 text-red-400" />
        )}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
            {text}
        </div>
    </div>
);

const ReportsOverview: React.FC = () => {
    const { t } = useTranslation();
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);

    useEffect(() => {
        fetch(getApiPath('tasks/metrics'), {
            credentials: 'include',
            headers: getDefaultHeaders(),
        })
            .then((r) => (r.ok ? r.json() : null))
            .then(setMetrics)
            .catch(console.error);
        fetchProjects()
            .then(setProjects)
            .catch(() => setProjects([]));
    }, []);

    const activeProjects = useMemo(
        () =>
            projects.filter(
                (p) => p.status && ACTIVE_PROJECT_STATUSES.includes(p.status)
            ).length,
        [projects]
    );

    const dueToday = metrics?.tasks_due_today_count ?? 0;
    const overdue = metrics?.tasks_overdue?.length ?? 0;
    const completedToday = metrics?.tasks_completed_today_count ?? 0;
    const trend = metrics
        ? getCompletionTrend(completedToday, metrics)
        : { direction: 'same', percentage: 0 };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-4 flex flex-col">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                        {t('dashboard.overview')}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 flex-1 auto-rows-fr">
                        <StatTile
                            icon={ClipboardDocumentListIcon}
                            value={metrics?.total_open_tasks ?? 0}
                            label={t('tasks.total')}
                            active
                            tone="blue"
                        />
                        <StatTile
                            icon={ArrowPathIcon}
                            value={metrics?.tasks_in_progress_count ?? 0}
                            label={t('tasks.inProgress')}
                            active
                            tone="green"
                        />
                        <StatTile
                            icon={FolderIcon}
                            value={activeProjects}
                            label={t('projects.active')}
                            active
                            tone="purple"
                        />
                        <StatTile
                            icon={CalendarDaysIcon}
                            value={dueToday}
                            label={t('tasks.dueToday')}
                            active={dueToday > 0}
                            tone="red"
                        />
                        <StatTile
                            icon={ExclamationTriangleIcon}
                            value={overdue}
                            label={t('tasks.overdue', 'Overdue')}
                            active={overdue > 0}
                            tone="orange"
                        />
                        <StatTile
                            icon={CheckCircleIcon}
                            value={completedToday}
                            label={t('tasks.completedToday', 'Completed Today')}
                            active={completedToday > 0}
                            tone="emerald"
                        >
                            {trend.direction === 'up' && (
                                <TrendTip
                                    up
                                    text={t(
                                        'dashboard.betterThanAverage',
                                        '{{percentage}}% more than average',
                                        { percentage: trend.percentage }
                                    )}
                                />
                            )}
                            {trend.direction === 'down' && (
                                <TrendTip
                                    up={false}
                                    text={t(
                                        'dashboard.worseThanAverage',
                                        '{{percentage}}% less than average',
                                        { percentage: trend.percentage }
                                    )}
                                />
                            )}
                        </StatTile>
                    </div>
                </div>
                <div className="lg:col-span-2 h-full">
                    <BurndownChart />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-stretch">
                <div className="lg:col-span-3">
                    <LifeBalance projects={projects} />
                </div>
                <div className="lg:col-span-1">
                    <AreaDonut projects={projects} />
                </div>
            </div>
        </div>
    );
};

export default ReportsOverview;
