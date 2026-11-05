import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { differenceInCalendarDays, format, Locale } from 'date-fns';
import {
    ArrowUturnLeftIcon,
    ChevronLeftIcon,
    FolderIcon,
} from '@heroicons/react/24/outline';
import { Project } from '../../entities/Project';
import { fetchProjects, updateProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import { getAssetPath } from '../../config/paths';
import { getCurrentLocale } from '../../utils/dateUtils';
import BlankSlate from '../Shared/BlankSlate';
import LoadingSpinner from '../Shared/LoadingSpinner';

const SHOW_CANCELLED_KEY = 'projectsHistoryShowCancelled';

const projectPath = (project: Project) =>
    `/project/${project.uid}-${project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}`;

// When a finished project ended: the recorded completion, or for cancelled
// projects (and done ones from before completed_at existed) the last edit.
export const finishedAt = (project: Project): Date | null => {
    const value = project.completed_at || project.updated_at;
    return value ? new Date(value) : null;
};

interface MonthGroup {
    key: string;
    label: string;
    projects: Project[];
}

interface YearGroup {
    year: number;
    count: number;
    months: MonthGroup[];
}

// Finished projects newest first, as years holding months.
export const groupByFinish = (projects: Project[]): YearGroup[] => {
    const locale = getCurrentLocale();
    const sorted = projects
        .map((project) => ({ project, at: finishedAt(project) }))
        .filter((entry): entry is { project: Project; at: Date } => !!entry.at)
        .sort((a, b) => b.at.getTime() - a.at.getTime());

    const years: YearGroup[] = [];
    for (const { project, at } of sorted) {
        const year = at.getFullYear();
        let yearGroup = years[years.length - 1];
        if (!yearGroup || yearGroup.year !== year) {
            yearGroup = { year, count: 0, months: [] };
            years.push(yearGroup);
        }
        const key = `${year}-${at.getMonth()}`;
        let month = yearGroup.months[yearGroup.months.length - 1];
        if (!month || month.key !== key) {
            month = {
                key,
                label: format(at, 'LLLL', { locale }),
                projects: [],
            };
            yearGroup.months.push(month);
        }
        month.projects.push(project);
        yearGroup.count += 1;
    }
    return years;
};

const ProjectHistory: React.FC = () => {
    const { t } = useTranslation();
    const { showErrorToast, showSuccessToast } = useToast();
    const { projects, setProjects, hasLoaded } = useStore(
        (state: any) => state.projectsStore
    );
    const [loading, setLoading] = useState(!hasLoaded);
    const [showCancelled, setShowCancelled] = useState(() => {
        try {
            return localStorage.getItem(SHOW_CANCELLED_KEY) === '1';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        let cancelled = false;
        fetchProjects('all', '')
            .then((list) => {
                if (!cancelled) setProjects(list);
            })
            .catch(() => {
                if (!cancelled)
                    showErrorToast(
                        t('projects.loadError', 'Failed to load projects')
                    );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const toggleCancelled = () => {
        const next = !showCancelled;
        setShowCancelled(next);
        try {
            localStorage.setItem(SHOW_CANCELLED_KEY, next ? '1' : '0');
        } catch {
            // the choice just is not remembered
        }
    };

    const finished: Project[] = useMemo(
        () =>
            (projects as Project[]).filter(
                (p) =>
                    p.status === 'done' ||
                    (showCancelled && p.status === 'cancelled')
            ),
        [projects, showCancelled]
    );
    const years = useMemo(() => groupByFinish(finished), [finished]);
    const locale = getCurrentLocale();

    const reopen = async (project: Project) => {
        if (!project.uid) return;
        try {
            const saved = await updateProject(project.uid, {
                status: 'in_progress',
            });
            setProjects(
                (projects as Project[]).map((p) =>
                    p.uid === saved.uid ? { ...p, ...saved } : p
                )
            );
            showSuccessToast(
                t('projects.reopened', '"{{name}}" is back in progress', {
                    name: project.name,
                })
            );
        } catch {
            showErrorToast(
                t(
                    'errors.projectStatusUpdateFailed',
                    'Failed to update project status'
                )
            );
        }
    };

    if (loading && finished.length === 0) {
        return <LoadingSpinner message={t('common.loading', 'Loading...')} />;
    }

    return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-4 pb-8">
            <div className="w-full max-w-7xl mx-auto">
                <Link
                    to="/projects"
                    className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                >
                    <ChevronLeftIcon className="h-4 w-4" />
                    {t('projects.title')}
                </Link>
                <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h2 className="text-2xl font-light">
                            {t('projects.historyTitle', 'Completed projects')}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {t('projects.historyCount', '{{count}} finished', {
                                count: finished.length,
                            })}
                        </p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <input
                            type="checkbox"
                            checked={showCancelled}
                            onChange={toggleCancelled}
                            className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
                            data-testid="history-show-cancelled"
                        />
                        {t('projects.historyShowCancelled', 'Show cancelled')}
                    </label>
                </div>

                {years.length === 0 ? (
                    <BlankSlate
                        title={t(
                            'projects.historyEmptyTitle',
                            'Nothing finished yet'
                        )}
                        hint={t(
                            'projects.historyEmptyHint',
                            'Projects you mark as completed show up here, newest first, so the work stays on record without crowding your list.'
                        )}
                    />
                ) : (
                    <div className="space-y-10">
                        {years.map((year) => (
                            <section key={year.year}>
                                <h3 className="mb-4 flex items-baseline gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                    {year.year}
                                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                                        {t(
                                            'projects.historyCount',
                                            '{{count}} finished',
                                            { count: year.count }
                                        )}
                                    </span>
                                </h3>
                                <div className="space-y-6">
                                    {year.months.map((month) => (
                                        <div key={month.key}>
                                            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                {month.label}
                                            </h4>
                                            <ul className="overflow-hidden rounded-xl bg-white dark:bg-gray-900">
                                                {month.projects.map(
                                                    (project) => (
                                                        <HistoryRow
                                                            key={project.uid}
                                                            project={project}
                                                            locale={locale}
                                                            onReopen={reopen}
                                                        />
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

interface HistoryRowProps {
    project: Project;
    locale: Locale;
    onReopen: (project: Project) => void;
}

const HistoryRow: React.FC<HistoryRowProps> = ({
    project,
    locale,
    onReopen,
}) => {
    const { t } = useTranslation();
    const at = finishedAt(project);
    const started = project.created_at ? new Date(project.created_at) : null;
    const days =
        at && started
            ? Math.max(1, differenceInCalendarDays(at, started) + 1)
            : null;
    const area = project.area || (project as any).Area;
    const tasks = project.task_status;
    const tint = project.color || '#3b82f6';

    const details = [
        area?.name,
        tasks && tasks.total > 0
            ? t('projects.historyTasks', '{{done}} of {{total}} tasks', {
                  done: tasks.done,
                  total: tasks.total,
              })
            : null,
        days !== null
            ? t('projects.historyDuration', 'took {{count}} days', {
                  count: days,
              })
            : null,
    ].filter(Boolean);

    return (
        <li
            className="group flex items-center gap-3 px-4 py-3 odd:bg-gray-50/60 dark:odd:bg-gray-800/40"
            data-testid={`history-row-${project.uid}`}
        >
            <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={{
                    backgroundColor: `color-mix(in srgb, ${tint} 16%, transparent)`,
                    color: tint,
                }}
            >
                {project.image_url ? (
                    <img
                        src={getAssetPath(project.image_url)}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <FolderIcon className="h-5 w-5" />
                )}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <Link
                        to={projectPath(project)}
                        className={`truncate font-medium hover:underline ${
                            project.status === 'cancelled'
                                ? 'text-gray-500 line-through dark:text-gray-400'
                                : 'text-gray-900 dark:text-gray-100'
                        }`}
                    >
                        {project.name}
                    </Link>
                    {project.status === 'cancelled' && (
                        <span className="flex-shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {t('projectStatus.cancelled', 'Cancelled')}
                        </span>
                    )}
                </div>
                {details.length > 0 && (
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {details.join(' · ')}
                    </p>
                )}
            </div>
            {at && (
                <time
                    dateTime={at.toISOString()}
                    className="flex-shrink-0 text-xs tabular-nums text-gray-500 dark:text-gray-400"
                >
                    {format(at, 'MMM d', { locale })}
                </time>
            )}
            <button
                type="button"
                onClick={() => onReopen(project)}
                className="flex-shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label={t('projects.reopen', 'Reopen')}
                title={t('projects.reopen', 'Reopen')}
                data-testid={`history-reopen-${project.uid}`}
            >
                <ArrowUturnLeftIcon className="h-4 w-4" />
            </button>
        </li>
    );
};

export default ProjectHistory;
