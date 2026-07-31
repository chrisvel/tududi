import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    FlagIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { Goal, GoalHorizon, GoalStatus } from '../../entities/Goal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import { fetchGoalByUid, createGoal, updateGoal, deleteGoal } from '../../utils/goalsService';
import { extractUidFromSlug, createProjectUrl } from '../../utils/slugUtils';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskList from '../Task/TaskList';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import ColorPicker from '../Shared/ColorPicker';

const TASK_STATUS_DONE = [2, 3, 'done', 'archived'];

const defaultFormData = (): Partial<Goal> => ({
    title: '',
    why: '',
    horizon: 'season' as GoalHorizon,
    status: 'active' as GoalStatus,
    target_date: '',
    area_id: null,
    color: '',
});

const GoalDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { showSuccessToast, showErrorToast } = useToast();

    const isNew = uidSlug === 'new';
    const prefilledAreaId = isNew ? ((location.state as any)?.area_id ?? null) : null;

    const [goal, setGoal] = useState<Goal | null>(null);
    const [loading, setLoading] = useState(!isNew);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(isNew);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [formData, setFormData] = useState<Partial<Goal>>({ ...defaultFormData(), area_id: prefilledAreaId });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const loadGoals = useStore((state: any) => state.goalsStore.loadGoals);
    const areas = useStore((state: any) => state.areasStore.areas);
    const projects: Project[] = useStore((state: any) => state.projectsStore.projects);

    useEffect(() => {
        if (isNew) return;

        const uid = extractUidFromSlug(uidSlug ?? '');
        if (!uid) { setError(t('goals.notFound', 'Goal not found')); setLoading(false); return; }

        fetchGoalByUid(uid)
            .then((data) => {
                setGoal(data);
                setFormData({
                    title: data.title,
                    why: data.why ?? '',
                    horizon: data.horizon,
                    status: data.status,
                    target_date: data.target_date ?? '',
                    area_id: data.area_id ?? null,
                    color: data.color ?? '',
                });
            })
            .catch((err) => setError(err?.message || t('goals.notFound', 'Goal not found')))
            .finally(() => setLoading(false));
    }, [uidSlug, t, isNew]);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: name === 'area_id' ? (value ? parseInt(value, 10) : null) : value,
        }));
    };

    const handleSubmit = async () => {
        if (!formData.title?.trim()) {
            setFormError(t('errors.goalTitleRequired', 'Goal title is required'));
            return;
        }
        setIsSubmitting(true);
        setFormError(null);
        try {
            const payload = {
                ...formData,
                target_date: formData.target_date || null,
                area_id: formData.area_id || null,
            };
            if (isNew) {
                const result = await createGoal(payload as any);
                const current = useStore.getState().goalsStore.goals;
                useStore.getState().goalsStore.setGoals([...current, result.goal]);
                showSuccessToast(t('success.goalCreated', 'Goal created!'));
                const { createGoalUrl } = await import('../../utils/slugUtils');
                navigate(createGoalUrl({ uid: result.goal.uid!, title: result.goal.title }), { replace: true });
            } else {
                const result = await updateGoal(goal!.uid!, payload);
                setGoal((prev) => prev ? { ...prev, ...result.goal } : result.goal);
                setIsEditing(false);
                loadGoals(true);
                showSuccessToast(t('success.goalUpdated', 'Goal updated!'));
            }
        } catch (err) {
            setFormError((err as Error).message);
            showErrorToast(t('errors.failedToSaveGoal', 'Failed to save goal.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancelEdit = () => {
        if (isNew) {
            navigate('/goals');
            return;
        }
        setIsEditing(false);
        setFormError(null);
        if (goal) {
            setFormData({
                title: goal.title,
                why: goal.why ?? '',
                horizon: goal.horizon,
                status: goal.status,
                target_date: goal.target_date ?? '',
                area_id: goal.area_id ?? null,
                color: goal.color ?? '',
            });
        }
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

    const handleTaskUpdate = async (updatedTask: Task) => {
        setGoal((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                Tasks: (prev.Tasks ?? []).map((t: any) =>
                    (t.uid ?? t.id) === (updatedTask.uid ?? updatedTask.id) ? updatedTask : t
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

    if (error || (!isNew && !goal)) {
        return <div className="text-red-500 p-4">{error ?? t('goals.notFound', 'Goal not found')}</div>;
    }

    const tasks: Task[] = (goal?.Tasks ?? []) as Task[];
    const goalProjects: Project[] = (goal?.Projects ?? []) as Project[];
    const activeTasks = tasks.filter((t) => !TASK_STATUS_DONE.includes(t.status as any));
    const completedTasks = tasks.filter((t) => TASK_STATUS_DONE.includes(t.status as any));

    const effectiveColor = goal?.color || goal?.Area?.color;
    const hasColor = !!effectiveColor;
    const showForm = isEditing || isNew;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            {/* Header banner */}
            <div
                className="rounded-xl mb-8 overflow-hidden"
                style={hasColor && !showForm ? { backgroundColor: effectiveColor } : undefined}
            >
                <div className={`p-6 ${(!hasColor || showForm) ? 'bg-gray-50 dark:bg-gray-900 rounded-xl' : ''}`}>
                    {showForm ? (
                        /* Edit / Create form inline */
                        <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2 mb-1">
                                <FlagIcon className="h-4 w-4 text-blue-500" />
                                <p className="text-xs font-medium uppercase tracking-widest text-gray-400 dark:text-gray-500">
                                    {isNew ? t('goals.newGoal', 'New Goal') : t('goals.editGoal', 'Edit Goal')}
                                </p>
                            </div>

                            <input
                                autoFocus
                                type="text"
                                name="title"
                                value={formData.title ?? ''}
                                onChange={handleChange}
                                className="w-full text-3xl font-light bg-transparent text-gray-900 dark:text-gray-100 border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 pb-1"
                                placeholder={t('forms.goalTitlePlaceholder', 'Goal title')}
                            />

                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                    {t('forms.goalWhy', 'Why')}
                                </label>
                                <textarea
                                    name="why"
                                    value={formData.why ?? ''}
                                    onChange={handleChange}
                                    rows={3}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                                    placeholder={t('forms.goalWhyPlaceholder', 'What will achieving this enable?')}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                        {t('forms.goalHorizon', 'Horizon')}
                                    </label>
                                    <select
                                        name="horizon"
                                        value={formData.horizon ?? 'season'}
                                        onChange={handleChange}
                                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="season">{t('goals.horizon.season', 'Season')}</option>
                                        <option value="year">{t('goals.horizon.year', 'Year')}</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                        {t('forms.goalStatus', 'Status')}
                                    </label>
                                    <select
                                        name="status"
                                        value={formData.status ?? 'active'}
                                        onChange={handleChange}
                                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="active">{t('goals.status.active', 'Active')}</option>
                                        <option value="achieved">{t('goals.status.achieved', 'Achieved')}</option>
                                        <option value="paused">{t('goals.status.paused', 'Paused')}</option>
                                        <option value="dropped">{t('goals.status.dropped', 'Dropped')}</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                    {t('forms.goalTargetDate', 'Target Date')}
                                </label>
                                <input
                                    type="date"
                                    name="target_date"
                                    value={formData.target_date ?? ''}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                    {t('forms.color', 'Color')}
                                </label>
                                <ColorPicker
                                    value={formData.color || ''}
                                    onChange={(color) =>
                                        setFormData((prev) => ({ ...prev, color: color || '' }))
                                    }
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                                    {t('forms.goalArea', 'Area')} ({t('common.optional', 'optional')})
                                </label>
                                <select
                                    name="area_id"
                                    value={formData.area_id ?? ''}
                                    onChange={handleChange}
                                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">{t('forms.noArea', 'No area')}</option>
                                    {areas.map((area: any) => (
                                        <option key={area.id} value={area.id}>
                                            {area.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {formError && (
                                <div className="text-red-500 text-sm">{formError}</div>
                            )}

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    onClick={handleSubmit}
                                    disabled={isSubmitting}
                                    className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-sm ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {isSubmitting
                                        ? t('modals.submitting', 'Saving...')
                                        : isNew
                                            ? t('modals.createGoal', 'Create Goal')
                                            : t('modals.updateGoal', 'Update Goal')}
                                </button>
                                <button
                                    onClick={handleCancelEdit}
                                    className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                >
                                    <XMarkIcon className="h-4 w-4" />
                                    {t('common.cancel', 'Cancel')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* View mode */
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                {/* Breadcrumb: Area → Goal */}
                                <div className="flex items-center gap-1.5 mb-3">
                                    {goal!.Area ? (
                                        <>
                                            <Link
                                                to={`/area/${goal!.Area.uid}-${goal!.Area.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${
                                                    hasColor ? 'bg-white/20 text-white' : ''
                                                }`}
                                                style={!hasColor && goal!.Area.color ? { backgroundColor: goal!.Area.color + '33', color: goal!.Area.color } : {}}
                                            >
                                                {!hasColor && !goal!.Area.color && (
                                                    <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
                                                )}
                                                {goal!.Area.name}
                                            </Link>
                                            <span className={`text-xs ${hasColor ? 'text-white/40' : 'text-gray-300 dark:text-gray-600'}`}>/</span>
                                        </>
                                    ) : null}
                                    <div className="flex items-center gap-1.5">
                                        <FlagIcon className={`h-3.5 w-3.5 ${hasColor ? 'text-white/70' : 'text-blue-500'}`} />
                                        <p className={`text-xs font-medium uppercase tracking-widest ${hasColor ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'}`}>
                                            {t('goals.singular', 'Goal')}
                                        </p>
                                    </div>
                                </div>

                                <h1 className={`text-3xl font-light ${hasColor ? 'text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {goal!.title}
                                </h1>
                                {goal!.why && (
                                    <p className={`mt-2 text-sm italic ${hasColor ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {goal!.why}
                                    </p>
                                )}
                                <div className={`mt-3 flex gap-4 text-xs ${hasColor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <span>{t(`goals.status.${goal!.status}`, goal!.status)}</span>
                                    <span>{t(`goals.horizon.${goal!.horizon}`, goal!.horizon)}</span>
                                    {goal!.target_date && (
                                        <span>{t('goals.targetDate', 'Target')}: {new Date(goal!.target_date).toLocaleDateString()}</span>
                                    )}
                                </div>
                                <div className={`mt-3 flex gap-4 text-xs ${hasColor ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                    <span>{tasks.length} {t('tasks.title', 'tasks')}</span>
                                    <span>{goalProjects.length} {t('projects.title', 'projects')}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
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
                    )}
                </div>
            </div>

            {/* Projects + Tasks sections (only in view mode) */}
            {!isNew && !isEditing && goal && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Projects section */}
                    <div>
                        <h3 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4">
                            {t('projects.title', 'Projects')} ({goalProjects.length})
                        </h3>
                        {goalProjects.length === 0 ? (
                            <p className="text-sm text-gray-400 dark:text-gray-500">
                                {t('goals.noProjects', 'No projects linked to this goal.')}
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {goalProjects.map((project) => (
                                    <Link
                                        key={project.uid ?? project.id}
                                        to={project.uid ? createProjectUrl({ uid: project.uid, name: project.name }) : '/projects'}
                                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 transition-colors group border-l-4"
                                        style={{ borderLeftColor: (project as any).color || '#6366f1' }}
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
                                        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                                            {t('tasks.completed', 'Completed')} ({completedTasks.length})
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
            )}

            {isConfirmDeleteOpen && (
                <ConfirmDialog
                    title={t('modals.deleteGoal.title', 'Delete Goal')}
                    message={`${t('modals.deleteGoal.message', 'Are you sure you want to delete')} "${goal?.title}"?`}
                    onConfirm={handleDeleteGoal}
                    onCancel={() => setIsConfirmDeleteOpen(false)}
                />
            )}
        </div>
    );
};

export default GoalDetails;
