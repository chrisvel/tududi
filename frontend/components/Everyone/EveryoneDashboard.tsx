import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { UsersIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    EveryoneColumn,
    EveryoneSummary,
    EVERYONE_BUCKETS,
    fetchEveryone,
} from '../../utils/everyoneService';
import { fetchProjects } from '../../utils/projectsService';
import { toggleTaskCompletion } from '../../utils/tasksService';

type Bucket = keyof EveryoneColumn['counts'];

const BUCKET_META: Record<
    Bucket,
    { key: string; fallback: string; tone: string }
> = {
    overdue: {
        key: 'everyone.overdue',
        fallback: 'Overdue',
        tone: 'text-red-600 dark:text-red-400',
    },
    today: {
        key: 'everyone.today',
        fallback: 'Today',
        tone: 'text-blue-600 dark:text-blue-400',
    },
    tomorrow: {
        key: 'everyone.tomorrow',
        fallback: 'Tomorrow',
        tone: 'text-gray-600 dark:text-gray-300',
    },
    upcoming: {
        key: 'everyone.upcoming',
        fallback: 'This week',
        tone: 'text-gray-500 dark:text-gray-400',
    },
    no_date: {
        key: 'everyone.noDate',
        fallback: 'No date',
        tone: 'text-gray-400 dark:text-gray-500',
    },
};

const isHighPriority = (p: Task['priority']) => p === 'high' || p === 2;

const weekday = (due?: string): string | null => {
    if (!due) return null;
    const d = new Date(`${due.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { weekday: 'short' });
};

const PersonDot: React.FC<{ color: string | null }> = ({ color }) => (
    <span
        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
        style={color ? { backgroundColor: color, borderColor: color } : {}}
    />
);

const StatChip: React.FC<{ value: number; label: string; tone?: string }> = ({
    value,
    label,
    tone,
}) => (
    <div className="flex items-baseline gap-1.5">
        <span
            className={`text-sm font-semibold tabular-nums ${
                tone || 'text-gray-900 dark:text-gray-100'
            }`}
        >
            {value}
        </span>
        <span className="text-[11px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
            {label}
        </span>
    </div>
);

interface RowProps {
    task: Task;
    bucket: Bucket;
    projectName: string | null;
    onOpen: (uid: string) => void;
    onComplete: (task: Task) => void;
}

const CompactTaskRow: React.FC<RowProps> = ({
    task,
    bucket,
    projectName,
    onOpen,
    onComplete,
}) => {
    const { t } = useTranslation();
    const day = bucket === 'upcoming' ? weekday(task.due_date) : null;
    return (
        <li
            className={`group flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 ${
                isHighPriority(task.priority)
                    ? 'border-l-2 border-l-red-400 dark:border-l-red-500 pl-1'
                    : ''
            }`}
        >
            <button
                type="button"
                aria-label={t('everyone.complete', 'Mark complete')}
                onClick={() => onComplete(task)}
                className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-full border border-gray-300 dark:border-gray-600 transition-colors hover:border-green-500 hover:bg-green-500/20"
            />
            <button
                type="button"
                onClick={() => task.uid && onOpen(task.uid)}
                className="min-w-0 flex-1 text-left"
            >
                <span className="block truncate text-[13px] leading-snug text-gray-800 dark:text-gray-200">
                    {task.name}
                </span>
                {(projectName || day) && (
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-gray-500">
                        {projectName && (
                            <span className="truncate">{projectName}</span>
                        )}
                        {day && <span className="shrink-0">{day}</span>}
                    </span>
                )}
            </button>
        </li>
    );
};

const EveryoneDashboard: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [columns, setColumns] = useState<EveryoneColumn[] | null>(null);
    const [summary, setSummary] = useState<EveryoneSummary | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await fetchEveryone();
            setColumns(data.columns);
            setSummary(data.summary ?? null);
        } catch (e: any) {
            setError(e?.message || 'Failed to load the dashboard.');
        }
    }, []);

    useEffect(() => {
        load();
        fetchProjects()
            .then(setProjects)
            .catch(() => setProjects([]));
    }, [load]);

    const projectNameByUid = useMemo(() => {
        const map: Record<string, string> = {};
        for (const p of projects) if (p.uid) map[p.uid] = p.name;
        return map;
    }, [projects]);

    const removeLocally = useCallback((taskUid: string) => {
        setColumns((prev) =>
            prev
                ? prev.map((col) => {
                      const next = { ...col };
                      for (const b of EVERYONE_BUCKETS) {
                          next[b] = (col[b] as Task[]).filter(
                              (x) => x.uid !== taskUid
                          );
                      }
                      return next;
                  })
                : prev
        );
    }, []);

    const completeTask = useCallback(
        async (task: Task) => {
            if (!task.uid) return;
            removeLocally(task.uid);
            try {
                await toggleTaskCompletion(task.uid, task);
            } catch {
                // Re-read puts the task back if the toggle did not land.
            }
            load();
        },
        [load, removeLocally]
    );

    const openTask = useCallback(
        (uid: string) => navigate(`/task/${uid}`),
        [navigate]
    );

    const projectNameFor = useCallback(
        (task: Task): string | null =>
            task.Project?.name ||
            (task.project_uid ? projectNameByUid[task.project_uid] : null) ||
            null,
        [projectNameByUid]
    );

    if (error) {
        return (
            <div className="px-4 sm:px-6 py-6">
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            </div>
        );
    }

    if (!columns) {
        return (
            <div className="px-4 sm:px-6 py-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('common.loading', 'Loading...')}
                </p>
            </div>
        );
    }

    const anyTasks = columns.some((c) =>
        EVERYONE_BUCKETS.some((b) => (c[b] as Task[]).length > 0)
    );

    return (
        <div
            className="h-full flex flex-col overflow-hidden px-4 sm:px-6"
            data-testid="everyone-dashboard"
        >
            <div className="shrink-0 flex items-baseline gap-2 py-3">
                <UsersIcon className="w-5 h-5 self-center text-gray-400 dark:text-gray-500" />
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('everyone.title', 'Everyone')}
                </h1>
                <p className="hidden sm:block text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'everyone.subtitle',
                        'What everyone you share work with has on now'
                    )}
                </p>
            </div>

            {summary && (
                <div className="shrink-0 flex flex-wrap items-center gap-x-5 gap-y-1 pb-3">
                    <StatChip
                        value={summary.people}
                        label={t('everyone.people', 'People')}
                    />
                    <StatChip
                        value={summary.total}
                        label={t('everyone.tasks', 'Tasks')}
                    />
                    <StatChip
                        value={summary.overdue}
                        label={t('everyone.overdue', 'Overdue')}
                        tone={
                            summary.overdue > 0
                                ? 'text-red-600 dark:text-red-400'
                                : undefined
                        }
                    />
                    <StatChip
                        value={summary.today}
                        label={t('everyone.today', 'Today')}
                    />
                </div>
            )}

            {!anyTasks && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'everyone.empty',
                        'Nothing shared is on right now. Share an area, project or goal, or assign someone a task, to see it here.'
                    )}
                </div>
            )}

            <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto pb-3">
                {columns.map((col) => {
                    const total = EVERYONE_BUCKETS.reduce(
                        (n, b) => n + (col[b] as Task[]).length,
                        0
                    );
                    const activeBuckets = EVERYONE_BUCKETS.filter(
                        (b) => (col[b] as Task[]).length > 0
                    );
                    return (
                        <section
                            key={col.person.uid}
                            className="flex flex-col w-[17rem] shrink-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 overflow-hidden"
                        >
                            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                                <PersonDot color={col.person.color} />
                                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                    {col.is_self
                                        ? t('everyone.you', 'You')
                                        : col.person.name}
                                </span>
                                <span className="ml-auto text-xs tabular-nums text-gray-400 dark:text-gray-500">
                                    {total}
                                </span>
                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
                                {activeBuckets.length === 0 ? (
                                    <p className="text-xs text-gray-400 dark:text-gray-500 px-1.5 py-1">
                                        {t(
                                            'everyone.nothing',
                                            'Nothing right now'
                                        )}
                                    </p>
                                ) : (
                                    activeBuckets.map((b) => {
                                        const meta = BUCKET_META[b];
                                        const tasks = col[b] as Task[];
                                        return (
                                            <div key={b}>
                                                <div className="flex items-center gap-1.5 px-1.5 mb-1">
                                                    <span
                                                        className={`text-[11px] font-semibold uppercase tracking-wide ${meta.tone}`}
                                                    >
                                                        {t(
                                                            meta.key,
                                                            meta.fallback
                                                        )}
                                                    </span>
                                                    <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                                                        {tasks.length}
                                                    </span>
                                                </div>
                                                <ul className="space-y-0.5">
                                                    {tasks.map((task) => (
                                                        <CompactTaskRow
                                                            key={task.uid}
                                                            task={task}
                                                            bucket={b}
                                                            projectName={projectNameFor(
                                                                task
                                                            )}
                                                            onOpen={openTask}
                                                            onComplete={
                                                                completeTask
                                                            }
                                                        />
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

export default EveryoneDashboard;
