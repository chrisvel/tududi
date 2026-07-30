import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    FlagIcon,
    FolderIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { Goal } from '../../entities/Goal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { fetchGoalByUid, updateGoal, deleteGoal } from '../../utils/goalsService';
import { extractUidFromSlug, createProjectUrl } from '../../utils/slugUtils';
import ConfirmDialog from '../Shared/ConfirmDialog';
import GoalModal from './GoalModal';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achieved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dropped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const TASK_STATUS_DONE = [2, 3, 'done', 'archived'];

const GoalDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();
    const { showSuccessToast, showErrorToast } = useToast();

    const [goal, setGoal] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);

    useEffect(() => {
        const uid = extractUidFromSlug(uidSlug ?? '');
        if (!uid) { setError(t('goals.notFound', 'Goal not found')); setLoading(false); return; }

        fetchGoalByUid(uid)
            .then((data) => setGoal(data))
            .catch(() => setError(t('goals.notFound', 'Goal not found')))
            .finally(() => setLoading(false));
    }, [uidSlug, t]);

    const handleSaveGoal = async (data: Partial<Goal>) => {
        if (!goal?.uid) return;
        const result = await updateGoal(goal.uid, data);
        setGoal((prev) => prev ? { ...prev, ...result.goal } : result.goal);
        loadGoals(true);
        showSuccessToast(t('success.goalUpdated', 'Goal updated!'));
        setIsEditModalOpen(false);
    };

    const handleDeleteGoal = async () => {
        if (!goal?.uid) return;
        try {
            await deleteGoal(goal.uid);
            loadGoals(true);
            showSuccessToast(t('success.goalDeleted', 'Goal deleted!'));
            navigate('/goals');
        } catch {
            showErrorToast(t('errors.failedToDeleteGoal', 'Failed to delete goal.'));
        }
        setIsConfirmDeleteOpen(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('common.loading', 'Loading...')}
                </div>
            </div>
        );
    }

    if (error || !goal) {
        return <div className="text-red-500 p-4">{error ?? t('goals.notFound', 'Goal not found')}</div>;
    }

    const tasks: Task[] = (goal.Tasks ?? []) as Task[];
    const projects: Project[] = (goal.Projects ?? []) as Project[];
    const activeTasks = tasks.filter((t) => !TASK_STATUS_DONE.includes(t.status as any));
    const completedTasks = tasks.filter((t) => TASK_STATUS_DONE.includes(t.status as any));

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            {/* Header banner */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl mb-8 overflow-hidden">
                <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <FlagIcon className="h-4 w-4 text-blue-500" />
                                <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                    {t('goals.singular', 'Goal')}
                                </p>
                            </div>
                            <h1 className="text-3xl font-light text-gray-900 dark:text-gray-100">
                                {goal.title}
                            </h1>
                            {goal.why && (
                                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                                    {goal.why}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[goal.status] ?? ''}`}>
                                    {t(`goals.status.${goal.status}`, goal.status)}
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                    {t(`goals.horizon.${goal.horizon}`, goal.horizon)}
                                </span>
                                {goal.target_date && (
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                        {t('goals.targetDate', 'Target')}: {new Date(goal.target_date).toLocaleDateString()}
                                    </span>
                                )}
                                {goal.Area && (
                                    <Link
                                        to={`/area/${goal.Area.uid}-${(goal.Area.name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                                        className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {goal.Area.name}
                                    </Link>
                                )}
                            </div>
                            <div className="mt-3 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                                <span>{tasks.length} {t('tasks.title', 'tasks')}</span>
                                <span>{projects.length} {t('projects.title', 'projects')}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                title={t('common.edit', 'Edit')}
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsConfirmDeleteOpen(true)}
                                className="p-2 rounded-lg text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                title={t('common.delete', 'Delete')}
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Projects section */}
                <div>
                    <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <FolderIcon className="h-5 w-5" />
                        {t('projects.title', 'Projects')} ({projects.length})
                    </h3>
                    {projects.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('goals.noProjects', 'No projects linked to this goal.')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {projects.map((project) => (
                                <Link
                                    key={project.uid ?? project.id}
                                    to={project.uid ? createProjectUrl({ uid: project.uid, name: project.name }) : '/projects'}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    <span
                                        className="w-1 h-8 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: (project as any).color ?? '#6366f1' }}
                                    />
                                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                        {project.name}
                                    </span>
                                    {project.status && (
                                        <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                            {project.status}
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tasks section */}
                <div className="lg:col-span-2">
                    <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                        <CheckCircleIcon className="h-5 w-5" />
                        {t('tasks.title', 'Tasks')} ({tasks.length})
                    </h3>
                    {tasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('goals.noTasks', 'No tasks assigned to this goal.')}
                        </p>
                    ) : (
                        <div className="flex flex-col gap-1">
                            {activeTasks.map((task) => (
                                <TaskRow key={task.uid ?? task.id} task={task} />
                            ))}
                            {completedTasks.length > 0 && (
                                <>
                                    <div className="mt-4 mb-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                                        {t('tasks.completed', 'Completed')} ({completedTasks.length})
                                    </div>
                                    {completedTasks.map((task) => (
                                        <TaskRow key={task.uid ?? task.id} task={task} done />
                                    ))}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {isEditModalOpen && (
                <GoalModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleSaveGoal}
                    goal={goal}
                />
            )}

            {isConfirmDeleteOpen && (
                <ConfirmDialog
                    title={t('modals.deleteGoal.title', 'Delete Goal')}
                    message={`${t('modals.deleteGoal.message', 'Are you sure you want to delete')} "${goal.title}"?`}
                    onConfirm={handleDeleteGoal}
                    onCancel={() => setIsConfirmDeleteOpen(false)}
                />
            )}
        </div>
    );
};

const TaskRow: React.FC<{ task: Task; done?: boolean }> = ({
    task,
    done = false,
}) => (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${done ? 'opacity-50' : ''}`}>
        <CheckCircleIcon className={`h-4 w-4 flex-shrink-0 ${done ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'}`} />
        <span className={`text-sm flex-1 ${done ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200'}`}>
            {task.name}
        </span>
        {task.due_date && !done && (
            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                {new Date(task.due_date).toLocaleDateString()}
            </span>
        )}
    </div>
);

export default GoalDetails;
