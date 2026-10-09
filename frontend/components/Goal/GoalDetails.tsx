import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    FlagIcon,
    ShareIcon,
} from '@heroicons/react/24/outline';
import { Goal } from '../../entities/Goal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { fetchGoalByUid, deleteGoal } from '../../utils/goalsService';
import { extractUidFromSlug, createProjectUrl } from '../../utils/slugUtils';
import ConfirmDialog from '../Shared/ConfirmDialog';
import ShareModal from '../Shared/ShareModal';
import TaskList from '../Task/TaskList';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import GoalModal from './GoalModal';

const TASK_STATUS_DONE = [2, 3, 'done', 'archived'];

const GoalDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();

    const [goal, setGoal] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);
    const projects: Project[] = useStore(
        (state: any) => state.projectsStore.projects
    );

    useEffect(() => {
        const uid = extractUidFromSlug(uidSlug ?? '');
        if (!uid) {
            setError(t('goals.notFound', 'Goal not found'));
            setLoading(false);
            return;
        }

        fetchGoalByUid(uid)
            .then((data) => setGoal(data))
            .catch((err) =>
                setError(err?.message || t('goals.notFound', 'Goal not found'))
            )
            .finally(() => setLoading(false));
    }, [uidSlug, t]);

    const handleDeleteGoal = async () => {
        if (!goal?.uid) return;
        try {
            await deleteGoal(goal.uid);
            loadGoals(true);
            showSuccessToast(t('success.goalDeleted', 'Goal deleted!'));
            navigate('/goals');
        } catch {
            showErrorToast(
                t('errors.failedToDeleteGoal', 'Failed to delete goal.')
            );
        }
        setIsConfirmDeleteOpen(false);
    };

    const handleGoalSaved = (saved: Goal) => {
        setGoal((prev) => (prev ? { ...prev, ...saved } : saved));
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        setGoal((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                Tasks: (prev.Tasks ?? []).map((t: any) =>
                    (t.uid ?? t.id) === (updatedTask.uid ?? updatedTask.id)
                        ? updatedTask
                        : t
                ),
            };
        });
    };

    const handleTaskDelete = (taskUid: string) => {
        setGoal((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                Tasks: (prev.Tasks ?? []).filter((t: any) => t.uid !== taskUid),
            };
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                {t('common.loading', 'Loading...')}
            </div>
        );
    }

    if (error || !goal) {
        return (
            <div className="text-red-500 p-4">
                {error ?? t('goals.notFound', 'Goal not found')}
            </div>
        );
    }

    const tasks: Task[] = (goal.Tasks ?? []) as Task[];
    const goalProjects: Project[] = (goal.Projects ?? []) as Project[];
    const activeTasks = tasks.filter(
        (t) => !TASK_STATUS_DONE.includes(t.status as any)
    );
    const completedTasks = tasks.filter((t) =>
        TASK_STATUS_DONE.includes(t.status as any)
    );

    const effectiveColor = goal.color || goal.Area?.color;
    const hasColor = !!effectiveColor;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            {/* Header banner */}
            <div
                className="rounded-xl mb-8 overflow-hidden"
                style={
                    hasColor ? { backgroundColor: effectiveColor } : undefined
                }
            >
                <div
                    className={`p-6 ${!hasColor ? 'bg-gray-50 dark:bg-gray-900 rounded-xl' : ''}`}
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            {/* Breadcrumb: Area → Goal */}
                            <div className="flex items-center gap-1.5 mb-3">
                                {goal.Area ? (
                                    <>
                                        <Link
                                            to={`/area/${goal.Area.uid}-${goal.Area.name
                                                .toLowerCase()
                                                .replace(/[^a-z0-9]+/g, '-')
                                                .replace(/^-|-$/g, '')}`}
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${
                                                hasColor
                                                    ? 'bg-white/20 text-white'
                                                    : ''
                                            }`}
                                            style={
                                                !hasColor && goal.Area.color
                                                    ? {
                                                          backgroundColor:
                                                              goal.Area.color +
                                                              '33',
                                                          color: goal.Area
                                                              .color,
                                                      }
                                                    : {}
                                            }
                                        >
                                            {!hasColor && !goal.Area.color && (
                                                <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                                            )}
                                            {goal.Area.name}
                                        </Link>
                                        <span
                                            className={`text-xs ${hasColor ? 'text-white/40' : 'text-gray-300 dark:text-gray-600'}`}
                                        >
                                            /
                                        </span>
                                    </>
                                ) : null}
                                <div className="flex items-center gap-1.5">
                                    <FlagIcon
                                        className={`h-3.5 w-3.5 ${hasColor ? 'text-white/70' : 'text-blue-500'}`}
                                    />
                                    <p
                                        className={`text-xs font-medium uppercase tracking-widest ${hasColor ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}
                                    >
                                        {t('goals.singular', 'Goal')}
                                    </p>
                                </div>
                            </div>

                            <h1
                                className={`text-3xl font-light ${hasColor ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}
                            >
                                {goal.title}
                            </h1>
                            {goal.why && (
                                <p
                                    className={`mt-2 text-sm italic ${hasColor ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    {goal.why}
                                </p>
                            )}
                            <div
                                className={`mt-3 flex gap-4 text-xs ${hasColor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                <span>
                                    {t(
                                        `goals.status.${goal.status}`,
                                        goal.status
                                    )}
                                </span>
                                <span>
                                    {t(
                                        `goals.horizon.${goal.horizon}`,
                                        goal.horizon
                                    )}
                                </span>
                                {goal.target_date && (
                                    <span>
                                        {t('goals.targetDate', 'Target')}:{' '}
                                        {new Date(
                                            goal.target_date
                                        ).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                            <div
                                className={`mt-3 flex gap-4 text-xs ${hasColor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                <span>
                                    {tasks.length} {t('tasks.title', 'tasks')}
                                </span>
                                <span>
                                    {goalProjects.length}{' '}
                                    {t('projects.title', 'projects')}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                onClick={() => setIsShareModalOpen(true)}
                                className={`p-2 rounded-lg transition-colors ${
                                    hasColor
                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={t('shares.shareGoal', 'Share goal')}
                            >
                                <ShareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsEditing(true)}
                                className={`p-2 rounded-lg transition-colors ${
                                    hasColor
                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={t('common.edit', 'Edit')}
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsConfirmDeleteOpen(true)}
                                className={`p-2 rounded-lg transition-colors ${
                                    hasColor
                                        ? 'text-white/80 hover:text-white hover:bg-white/10'
                                        : 'text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title={t('common.delete', 'Delete')}
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Projects + Tasks sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Projects section */}
                <div>
                    <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4">
                        {t('projects.title', 'Projects')} ({goalProjects.length}
                        )
                    </h3>
                    {goalProjects.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t(
                                'goals.noProjects',
                                'No projects linked to this goal.'
                            )}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {goalProjects.map((project) => (
                                <Link
                                    key={project.uid ?? project.id}
                                    to={
                                        project.uid
                                            ? createProjectUrl({
                                                  uid: project.uid,
                                                  name: project.name,
                                              })
                                            : '/projects'
                                    }
                                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 transition-colors group border-l-4"
                                    style={{
                                        borderLeftColor:
                                            (project as any).color || '#6366f1',
                                    }}
                                >
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {project.name}
                                    </span>
                                    {project.status && (
                                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                            {project.status.replace('_', ' ')}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tasks section */}
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4">
                        {t('tasks.title', 'Tasks')} ({tasks.length})
                    </h3>
                    {tasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t(
                                'goals.noTasks',
                                'No tasks assigned to this goal.'
                            )}
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {activeTasks.length > 0 && (
                                <TaskList
                                    tasks={activeTasks}
                                    projects={projects}
                                    onTaskUpdate={handleTaskUpdate}
                                    onTaskDelete={handleTaskDelete}
                                />
                            )}
                            {completedTasks.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                                        {t('tasks.completed', 'Completed')} (
                                        {completedTasks.length})
                                    </h4>
                                    <TaskList
                                        tasks={completedTasks}
                                        projects={projects}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskDelete={handleTaskDelete}
                                        showCompletedTasks={true}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <GoalModal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                goal={goal}
                onSaved={handleGoalSaved}
            />

            {isConfirmDeleteOpen && (
                <ConfirmDialog
                    title={t('modals.deleteGoal.title', 'Delete Goal')}
                    message={`${t('modals.deleteGoal.message', 'Are you sure you want to delete')} "${goal.title}"?`}
                    onConfirm={handleDeleteGoal}
                    onCancel={() => setIsConfirmDeleteOpen(false)}
                />
            )}

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                resourceType="goal"
                resourceUid={goal.uid || null}
                resourceName={goal.title}
            />
        </div>
    );
};

export default GoalDetails;
