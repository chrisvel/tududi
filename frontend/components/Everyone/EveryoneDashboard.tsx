import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UsersIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskList from '../Task/TaskList';
import {
    EveryoneColumn,
    EVERYONE_BUCKETS,
    fetchEveryone,
} from '../../utils/everyoneService';
import { fetchProjects } from '../../utils/projectsService';

const isDone = (t: Task) =>
    t.status === 'done' ||
    t.status === 'archived' ||
    t.status === 'cancelled' ||
    t.status === 2 ||
    t.status === 3 ||
    t.status === 5;

const PersonDot: React.FC<{ color: string | null }> = ({ color }) => (
    <span
        className="inline-block w-3 h-3 rounded-full flex-shrink-0 border border-gray-300 dark:border-gray-600"
        style={color ? { backgroundColor: color, borderColor: color } : {}}
    />
);

const EveryoneDashboard: React.FC = () => {
    const { t } = useTranslation();
    const [columns, setColumns] = useState<EveryoneColumn[] | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await fetchEveryone();
            setColumns(data.columns);
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

    // Any edit / completion / deletion just re-reads the shared workspace.
    const handleTaskUpdate = useCallback(async () => {
        await load();
    }, [load]);

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

    const handleCompletionToggle = useCallback(
        (task: Task) => {
            if (isDone(task) && task.uid) removeLocally(task.uid);
            load();
        },
        [load, removeLocally]
    );

    const handleTaskDelete = useCallback(
        (taskUid: string) => {
            removeLocally(taskUid);
            load();
        },
        [load, removeLocally]
    );

    const bucketLabel = (b: keyof EveryoneColumn['counts']) =>
        ({
            overdue: t('everyone.overdue', 'Overdue'),
            today: t('everyone.today', 'Today'),
            tomorrow: t('everyone.tomorrow', 'Tomorrow'),
            upcoming: t('everyone.upcoming', 'This week'),
            no_date: t('everyone.noDate', 'No date'),
        })[b];

    if (error) {
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            </div>
        );
    }

    if (!columns) {
        return (
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
            data-testid="everyone-dashboard"
        >
            <div className="flex items-center gap-2 mb-1">
                <UsersIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                    {t('everyone.title', 'Everyone')}
                </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                {t(
                    'everyone.subtitle',
                    'What everyone you share work with has on now'
                )}
            </p>

            {!anyTasks && (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
                    {t(
                        'everyone.empty',
                        'Nothing shared is on right now. Share an area, project or goal, or assign someone a task, to see it here.'
                    )}
                </div>
            )}

            <div className="flex flex-col gap-8">
                {columns.map((col) => {
                    const total = EVERYONE_BUCKETS.reduce(
                        (n, b) => n + (col[b] as Task[]).length,
                        0
                    );
                    const activeBuckets = EVERYONE_BUCKETS.filter(
                        (b) => (col[b] as Task[]).length > 0
                    );
                    return (
                        <section key={col.person.uid}>
                            <div className="flex items-center gap-2 mb-3">
                                <PersonDot color={col.person.color} />
                                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    {col.is_self
                                        ? t('everyone.you', 'You')
                                        : col.person.name}
                                </h2>
                                {col.person.relationship_type &&
                                    col.person.relationship_type !==
                                        'other' && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            {col.person.relationship_type}
                                        </span>
                                    )}
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {total}
                                </span>
                            </div>

                            {activeBuckets.length === 0 ? (
                                <p className="text-sm text-gray-400 dark:text-gray-500 pl-5">
                                    {t('everyone.nothing', 'Nothing right now')}
                                </p>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-4 md:gap-6 w-full">
                                    {activeBuckets.map((b) => (
                                        <div
                                            key={b}
                                            className="w-full md:flex-1 md:min-w-64"
                                        >
                                            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                                                {bucketLabel(b)} (
                                                {(col[b] as Task[]).length})
                                            </h3>
                                            <TaskList
                                                tasks={col[b] as Task[]}
                                                projects={projects}
                                                hideProjectName={false}
                                                onTaskUpdate={handleTaskUpdate}
                                                onTaskCompletionToggle={
                                                    handleCompletionToggle
                                                }
                                                onTaskDelete={handleTaskDelete}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};

export default EveryoneDashboard;
