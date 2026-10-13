import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Goal, GoalStatus } from '../../entities/Goal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    fetchGoalByUid,
    deleteGoal,
    updateGoal,
} from '../../utils/goalsService';
import { fetchProjects } from '../../utils/projectsService';
import { extractUidFromSlug } from '../../utils/slugUtils';
import ConfirmDialog from '../Shared/ConfirmDialog';
import ShareModal from '../Shared/ShareModal';
import TaskList from '../Task/TaskList';
import ProjectItem from '../Project/ProjectItem';
import useProjectCardActions from '../Project/useProjectCardActions';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import GoalModal from './GoalModal';
import GoalHero from './GoalHero';

const TASK_STATUS_DONE = [2, 3, 'done', 'archived'];

type GoalTab = 'tasks' | 'projects';

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
    const [activeTab, setActiveTab] = useState<GoalTab>('tasks');
    // Full project records (completion, sharing) for the project cards, the
    // same data /projects shows. Goal.Projects only carries a few fields.
    const [projectCards, setProjectCards] = useState<Project[]>([]);

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

    useEffect(() => {
        fetchProjects('all', '')
            .then((list) => setProjectCards(list))
            .catch(() => undefined);
    }, []);

    const refreshProjects = async () => {
        const [list, refreshedGoal] = await Promise.all([
            fetchProjects('all', ''),
            goal?.uid ? fetchGoalByUid(goal.uid) : Promise.resolve(null),
        ]);
        setProjectCards(list);
        if (refreshedGoal) {
            setGoal((prev) =>
                prev ? { ...prev, ...refreshedGoal } : refreshedGoal
            );
        }
    };

    const { cardActions, modals: projectModals } = useProjectCardActions(() =>
        refreshProjects()
    );

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

    const handleStatusChange = async (status: GoalStatus) => {
        if (!goal?.uid) return;
        try {
            const { goal: updated } = await updateGoal(goal.uid, { status });
            handleGoalSaved(updated);
            loadGoals(true);
        } catch {
            showErrorToast(
                t('errors.failedToUpdateGoal', 'Failed to update goal.')
            );
        }
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
    const goalUids = new Set(goalProjects.map((p) => p.uid));
    const goalProjectCards = projectCards.filter(
        (p) => p.uid && goalUids.has(p.uid)
    );

    const tabClass = (tab: GoalTab) =>
        `relative flex items-center self-stretch py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab
                ? 'text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-px after:right-px after:h-0.5 after:rounded-full after:bg-gray-900 dark:after:bg-gray-100'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
        }`;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-12">
            <GoalHero
                goal={goal}
                t={t}
                doneCount={completedTasks.length}
                totalCount={tasks.length}
                onStatusChange={handleStatusChange}
                onShareClick={() => setIsShareModalOpen(true)}
                onEditClick={() => setIsEditing(true)}
                onDeleteClick={() => setIsConfirmDeleteOpen(true)}
            />

            <div className="mb-4">
                <div className="flex items-center min-h-[2.5rem]">
                    <div className="flex items-center gap-4 sm:gap-6 self-stretch pl-2 sm:pl-3">
                        <button
                            type="button"
                            onClick={() => setActiveTab('tasks')}
                            className={tabClass('tasks')}
                            aria-pressed={activeTab === 'tasks'}
                        >
                            {t('tasks.title', 'Tasks')} ({tasks.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('projects')}
                            className={tabClass('projects')}
                            aria-pressed={activeTab === 'projects'}
                        >
                            {t('projects.title', 'Projects')} (
                            {goalProjects.length})
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'tasks' ? (
                tasks.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 px-2">
                        {t('goals.noTasks', 'No tasks assigned to this goal.')}
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
                                <h4 className="px-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
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
                )
            ) : goalProjects.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 px-2">
                    {t('goals.noProjects', 'No projects linked to this goal.')}
                </p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {goalProjectCards.map((project) => (
                        <ProjectItem
                            key={project.id}
                            project={project}
                            viewMode="cards"
                            getCompletionPercentage={() =>
                                (project as any).completion_percentage || 0
                            }
                            {...cardActions}
                        />
                    ))}
                </div>
            )}

            <GoalModal
                isOpen={isEditing}
                onClose={() => setIsEditing(false)}
                goal={goal}
                onSaved={handleGoalSaved}
            />

            {projectModals}

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
