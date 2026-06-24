import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilIcon,
    PlusIcon,
    PencilSquareIcon,
    TrashIcon,
    FlagIcon,
    WrenchScrewdriverIcon,
    ChevronRightIcon,
    ExclamationTriangleIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';
import { Goal, GoalStatus, GoalHorizon } from '../../entities/Goal';
import { Task } from '../../entities/Task';
import { fetchTasks } from '../../utils/tasksService';
import { updateArea } from '../../utils/areasService';
import { fetchGoals, createGoal, updateGoal, deleteGoal } from '../../utils/goalsService';
import { updateProject } from '../../utils/projectsService';
import AreaModal from './AreaModal';
import TaskList from '../Task/TaskList';

const HORIZON_LABELS: Record<GoalHorizon, string> = {
    season: 'season',
    year: 'year',
};

const STATUS_LABELS: Record<GoalStatus, string> = {
    active: 'active',
    achieved: 'achieved',
    paused: 'paused',
    dropped: 'dropped',
};

interface GoalFormState {
    title: string;
    why: string;
    horizon: GoalHorizon;
    target_date: string;
    status: GoalStatus;
}

const emptyGoalForm = (): GoalFormState => ({
    title: '',
    why: '',
    horizon: 'season',
    target_date: '',
    status: 'active',
});

const AreaDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();

    const areasStore = useStore((state: any) => state.areasStore);
    const projectsStore = useStore((state: any) => state.projectsStore);
    const tasksStore = useStore((state: any) => state.tasksStore);

    const [area, setArea] = useState<Area | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [areaTasks, setAreaTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [goals, setGoals] = useState<Goal[]>([]);
    const [loadingGoals, setLoadingGoals] = useState(false);

    const [goalForm, setGoalForm] = useState<GoalFormState | null>(null);
    const [editingGoalUid, setEditingGoalUid] = useState<string | null>(null);
    const [savingGoal, setSavingGoal] = useState(false);

    const areaUid = uidSlug?.split('-')[0] || '';

    useEffect(() => {
        if (!areasStore.isLoading && areasStore.areas.length === 0) {
            areasStore.loadAreas();
        }
    }, [areasStore]);

    useEffect(() => {
        if (!projectsStore.hasLoaded && !projectsStore.isLoading) {
            projectsStore.loadProjects();
        }
    }, [projectsStore]);

    useEffect(() => {
        if (!areaUid) {
            setIsError(true);
            setIsLoading(false);
            return;
        }
        const found = areasStore.areas.find((a: Area) => a.uid === areaUid);
        if (found) {
            setArea(found);
            setIsError(false);
        } else if (!areasStore.isLoading && areasStore.areas.length > 0) {
            setIsError(true);
        }
        setIsLoading(areasStore.isLoading && !found);
    }, [areaUid, areasStore.areas, areasStore.isLoading]);

    const loadAreaTasks = useCallback(async () => {
        if (!area?.id) return;
        setLoadingTasks(true);
        try {
            const result = await fetchTasks(`?area_id=${area.id}&type=all&status=all`);
            setAreaTasks(result.tasks || []);
        } catch {
            setAreaTasks([]);
        } finally {
            setLoadingTasks(false);
        }
    }, [area?.id]);

    useEffect(() => {
        if (area?.id) {
            loadAreaTasks();
        }
    }, [area?.id, loadAreaTasks]);

    const loadGoals = useCallback(async () => {
        if (!area?.id) return;
        setLoadingGoals(true);
        try {
            const data = await fetchGoals(area.id);
            setGoals(data);
        } catch {
            setGoals([]);
        } finally {
            setLoadingGoals(false);
        }
    }, [area?.id]);

    useEffect(() => {
        if (area?.id) {
            loadGoals();
        }
    }, [area?.id, loadGoals]);

    const areaProjects = projectsStore.projects.filter((p: Project) => {
        const projectArea = p.area || (p as any).Area;
        return projectArea?.uid === areaUid;
    });

    const handleTaskUpdate = async (updatedTask: Task) => {
        setAreaTasks((prev) => prev.map((t) => (t.uid === updatedTask.uid ? updatedTask : t)));
        tasksStore.setTasks(tasksStore.tasks.map((t: Task) => (t.uid === updatedTask.uid ? updatedTask : t)));
    };

    const handleTaskDelete = (taskUid: string) => {
        setAreaTasks((prev) => prev.filter((t) => t.uid !== taskUid));
        tasksStore.setTasks(tasksStore.tasks.filter((t: Task) => t.uid !== taskUid));
    };

    const handleAreaSave = async (areaData: Partial<Area>) => {
        if (!area?.uid) return;
        const result = await updateArea(area.uid, {
            name: areaData.name,
            description: areaData.description,
            color: areaData.color,
        });
        areasStore.setAreas(areasStore.areas.map((a: Area) => (a.uid === result.uid ? result : a)));
        setArea(result);
        setIsEditModalOpen(false);
        const slug = result.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        navigate(`/area/${result.uid}-${slug}`, { replace: true });
    };

    const getProjectLink = (project: Project) => {
        if (project.uid) {
            const slug = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            return `/project/${project.uid}-${slug}`;
        }
        return `/project/${project.id}`;
    };

    const openNewGoalForm = () => {
        setEditingGoalUid(null);
        setGoalForm(emptyGoalForm());
    };

    const openEditGoalForm = (goal: Goal) => {
        setEditingGoalUid(goal.uid || null);
        setGoalForm({
            title: goal.title,
            why: goal.why || '',
            horizon: goal.horizon,
            target_date: goal.target_date || '',
            status: goal.status,
        });
    };

    const cancelGoalForm = () => {
        setGoalForm(null);
        setEditingGoalUid(null);
    };

    const saveGoal = async () => {
        if (!goalForm || !area?.id) return;
        if (!goalForm.title.trim()) return;
        setSavingGoal(true);
        try {
            if (editingGoalUid) {
                const { goal } = await updateGoal(editingGoalUid, {
                    title: goalForm.title.trim(),
                    why: goalForm.why || null,
                    horizon: goalForm.horizon,
                    target_date: goalForm.target_date || null,
                    status: goalForm.status,
                });
                setGoals((prev) => prev.map((g) => (g.uid === editingGoalUid ? goal : g)));
            } else {
                const { goal } = await createGoal({
                    area_id: area.id!,
                    title: goalForm.title.trim(),
                    why: goalForm.why || null,
                    horizon: goalForm.horizon,
                    target_date: goalForm.target_date || null,
                    status: goalForm.status,
                });
                setGoals((prev) => [...prev, goal]);
            }
            cancelGoalForm();
        } finally {
            setSavingGoal(false);
        }
    };

    const handleDeleteGoal = async (goal: Goal) => {
        if (!goal.uid) return;
        if (!window.confirm(`Drop goal "${goal.title}"? Projects under it will become unlinked.`)) return;
        await deleteGoal(goal.uid);
        setGoals((prev) => prev.filter((g) => g.uid !== goal.uid));
    };

    const patchProjectInStore = (uid: string, patch: Partial<Project>) => {
        projectsStore.setProjects(
            projectsStore.projects.map((p: Project) =>
                p.uid === uid ? { ...p, ...patch } : p
            )
        );
    };

    const handleLinkToGoal = async (project: Project, goal: Goal) => {
        console.log('[handleLinkToGoal]', { projectUid: project.uid, goalId: goal.id, goalUid: goal.uid });
        if (!project.uid || !goal.id) {
            console.warn('[handleLinkToGoal] early return – missing uid or goal.id', { projectUid: project.uid, goalId: goal.id });
            return;
        }
        try {
            const saved = await updateProject(project.uid, { goal_id: goal.id, is_maintenance: false });
            console.log('[handleLinkToGoal] server response goal_id:', saved.goal_id);
            const savedGoalId = saved.goal_id ?? (saved as any).Goal?.id ?? null;
            patchProjectInStore(project.uid, {
                goal_id: savedGoalId,
                is_maintenance: saved.is_maintenance ?? false,
            });
        } catch (err) {
            console.error('[handleLinkToGoal] error:', err);
        }
    };

    const handleMarkMaintenance = async (project: Project) => {
        if (!project.uid) return;
        try {
            const saved = await updateProject(project.uid, { goal_id: null, is_maintenance: true });
            patchProjectInStore(project.uid, {
                goal_id: saved.goal_id ?? null,
                is_maintenance: saved.is_maintenance ?? true,
            });
        } catch (err) {
            console.error('Failed to mark project as maintenance:', err);
        }
    };

    const handleUnmarkMaintenance = async (project: Project) => {
        if (!project.uid) return;
        try {
            const saved = await updateProject(project.uid, { is_maintenance: false, goal_id: null });
            patchProjectInStore(project.uid, {
                is_maintenance: saved.is_maintenance ?? false,
                goal_id: saved.goal_id ?? null,
            });
        } catch (err) {
            console.error('Failed to unmark project as maintenance:', err);
        }
    };

    const handleDropProject = async (project: Project) => {
        if (!project.uid) return;
        if (!window.confirm(`Remove "${project.name}" from this area?`)) return;
        try {
            await updateProject(project.uid, { area_id: null });
            patchProjectInStore(project.uid, { area_id: null, goal_id: null, is_maintenance: false });
        } catch (err) {
            console.error('Failed to remove project from area:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
                {t('areas.loading', 'Loading…')}
            </div>
        );
    }

    if (isError || !area) {
        return (
            <div className="flex items-center justify-center h-64 text-red-500">
                {t('areas.notFound', 'Area not found')}
            </div>
        );
    }

    const activeTasks = areaTasks.filter(
        (t) => t.status !== 'done' && t.status !== 2 && t.status !== 'archived' && t.status !== 3
    );
    const completedTasks = areaTasks.filter((t) => t.status === 'done' || t.status === 2);

    // Bucket projects into: under a goal / maintenance / unlinked
    const projectsByGoal = new Map<number, Project[]>();
    const maintenanceProjects: Project[] = [];
    const unlinkedProjects: Project[] = [];

    areaProjects.forEach((p: Project) => {
        const goalId = (p as any).goal_id ?? p.goal_id;
        const isMaintenance = (p as any).is_maintenance ?? p.is_maintenance;
        if (goalId) {
            const list = projectsByGoal.get(goalId) || [];
            list.push(p);
            projectsByGoal.set(goalId, list);
        } else if (isMaintenance) {
            maintenanceProjects.push(p);
        } else {
            unlinkedProjects.push(p);
        }
    });

    const activeGoals = goals.filter((g) => g.status === 'active');
    const tooManyGoals = activeGoals.length > 5;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-8">
            {/* Area Header */}
            <div
                className="rounded-xl mb-8 overflow-hidden"
                style={area.color ? { backgroundColor: area.color } : undefined}
            >
                <div className={`p-6 ${area.color ? '' : 'bg-gray-50 dark:bg-gray-900 rounded-xl'}`}>
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className={`text-xs font-medium uppercase tracking-widest mb-1 ${
                                area.color ? 'text-white/60' : 'text-gray-400 dark:text-gray-500'
                            }`}>
                                Area
                            </p>
                            <h1
                                className={`text-3xl font-light uppercase tracking-wide ${
                                    area.color ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                                }`}
                            >
                                {area.name}
                            </h1>
                            {area.description && (
                                <p className={`mt-2 text-sm ${area.color ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {area.description}
                                </p>
                            )}
                            <div className={`mt-3 flex gap-4 text-xs ${area.color ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                <span>{areaProjects.length} {t('areas.projects', 'projects')}</span>
                                <span>{activeTasks.length} {t('areas.tasks', 'tasks')}</span>
                                {goals.length > 0 && (
                                    <span>{activeGoals.length} active {activeGoals.length === 1 ? 'goal' : 'goals'}</span>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setIsEditModalOpen(true)}
                            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                                area.color
                                    ? 'text-white/80 hover:text-white hover:bg-white/10'
                                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                            title={t('areas.edit', 'Edit area')}
                        >
                            <PencilIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Scarcity guard */}
            {tooManyGoals && (
                <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                    <span>{activeGoals.length} active goals. Goals work best at 3-5. Achieve or pause one?</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Goals spine + projects */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-lg font-light text-gray-700 dark:text-gray-300">Goals</h2>
                        <button
                            onClick={openNewGoalForm}
                            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            <PlusIcon className="h-3.5 w-3.5" /> Add goal
                        </button>
                    </div>

                    {/* Inline goal form */}
                    {goalForm && (
                        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 space-y-3">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Goal title"
                                value={goalForm.title}
                                onChange={(e) => setGoalForm((f) => f ? { ...f, title: e.target.value } : f)}
                                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="Why this matters (optional)"
                                value={goalForm.why}
                                onChange={(e) => setGoalForm((f) => f ? { ...f, why: e.target.value } : f)}
                                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2">
                                <select
                                    value={goalForm.horizon}
                                    onChange={(e) => setGoalForm((f) => f ? { ...f, horizon: e.target.value as GoalHorizon } : f)}
                                    className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                >
                                    <option value="season">Season</option>
                                    <option value="year">Year</option>
                                </select>
                                <select
                                    value={goalForm.status}
                                    onChange={(e) => setGoalForm((f) => f ? { ...f, status: e.target.value as GoalStatus } : f)}
                                    className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                >
                                    {(Object.keys(STATUS_LABELS) as GoalStatus[]).map((s) => (
                                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                                    ))}
                                </select>
                            </div>
                            <input
                                type="date"
                                value={goalForm.target_date}
                                onChange={(e) => setGoalForm((f) => f ? { ...f, target_date: e.target.value } : f)}
                                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-md py-1.5 px-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={cancelGoalForm}
                                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 px-3 py-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveGoal}
                                    disabled={savingGoal || !goalForm.title.trim()}
                                    className="text-xs bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingGoal ? 'Saving…' : editingGoalUid ? 'Update' : 'Add goal'}
                                </button>
                            </div>
                        </div>
                    )}

                    {loadingGoals ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">Loading goals…</p>
                    ) : (
                        <div className="space-y-4">
                            {/* Empty state: only when there are no goals AND no projects at all */}
                            {goals.length === 0 && areaProjects.length === 0 && !goalForm && (
                                <p className="text-sm text-gray-400 dark:text-gray-500">
                                    No goals yet. Add a goal to group projects by outcome.
                                </p>
                            )}

                            {/* Active goals */}
                            {goals.filter((g) => g.status === 'active').map((goal) => (
                                <GoalBucket
                                    key={goal.uid || goal.id}
                                    goal={goal}
                                    projects={projectsByGoal.get(goal.id!) || []}
                                    areaColor={area.color}
                                    getProjectLink={getProjectLink}
                                    onEdit={() => openEditGoalForm(goal)}
                                    onDelete={() => handleDeleteGoal(goal)}
                                />
                            ))}

                            {/* Maintenance bucket */}
                            {maintenanceProjects.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <WrenchScrewdriverIcon className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Maintenance</span>
                                        <span className="relative group/tip">
                                            <InformationCircleIcon className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600 cursor-help" />
                                            <span className="pointer-events-none absolute left-5 top-0 z-10 w-52 rounded-md bg-gray-800 px-2.5 py-1.5 text-xs text-white opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg">
                                                Maintenance projects keep things running. They&apos;re ongoing work without a specific goal or end date.
                                            </span>
                                        </span>
                                    </div>
                                    <div className="ml-6">
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                                            Projects
                                        </p>
                                        <div className="space-y-2">
                                            {maintenanceProjects.map((p) => (
                                                <MaintenanceProjectRow
                                                    key={p.uid || p.id}
                                                    project={p}
                                                    getLink={getProjectLink}
                                                    onUnmark={handleUnmarkMaintenance}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Inactive goals */}
                            {goals.filter((g) => g.status !== 'active').length > 0 && (
                                <details className="mt-2">
                                    <summary className="text-xs text-gray-400 dark:text-gray-500 cursor-pointer select-none">
                                        Inactive goals ({goals.filter((g) => g.status !== 'active').length})
                                    </summary>
                                    <div className="mt-2 space-y-3">
                                        {goals.filter((g) => g.status !== 'active').map((goal) => (
                                            <GoalBucket
                                                key={goal.uid || goal.id}
                                                goal={goal}
                                                projects={projectsByGoal.get(goal.id!) || []}
                                                areaColor={area.color}
                                                getProjectLink={getProjectLink}
                                                onEdit={() => openEditGoalForm(goal)}
                                                onDelete={() => handleDeleteGoal(goal)}
                                                dimmed
                                            />
                                        ))}
                                    </div>
                                </details>
                            )}

                            {/* Unlinked bucket */}
                            {unlinkedProjects.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <ChevronRightIcon className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                                        <span className="text-sm text-gray-400 dark:text-gray-500">
                                            Unlinked ({unlinkedProjects.length})
                                        </span>
                                    </div>
                                    <div className="ml-6">
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                                            Projects
                                        </p>
                                        <div className="space-y-2">
                                        {unlinkedProjects.map((p) => (
                                            <UnlinkedProjectRow
                                                key={p.uid || p.id}
                                                project={p}
                                                goals={goals.filter((g) => g.status === 'active')}
                                                getLink={getProjectLink}
                                                onLinkToGoal={handleLinkToGoal}
                                                onMarkMaintenance={handleMarkMaintenance}
                                                onDrop={handleDropProject}
                                            />
                                        ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Tasks column */}
                <div className="lg:col-span-2">
                    <h2 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4">
                        {t('areas.tasksInArea', 'Tasks')}
                    </h2>
                    {loadingTasks ? (
                        <div className="text-sm text-gray-400 dark:text-gray-500">
                            {t('loading.tasks', 'Loading tasks…')}
                        </div>
                    ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('areas.noTasks', 'No tasks directly in this area')}
                        </p>
                    ) : (
                        <div className="space-y-6">
                            {activeTasks.length > 0 && (
                                <TaskList
                                    tasks={activeTasks}
                                    projects={projectsStore.projects}
                                    onTaskUpdate={handleTaskUpdate}
                                    onTaskDelete={handleTaskDelete}
                                />
                            )}
                            {completedTasks.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                                        {t('tasks.completed', 'Completed')} ({completedTasks.length})
                                    </h3>
                                    <TaskList
                                        tasks={completedTasks}
                                        projects={projectsStore.projects}
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

            {isEditModalOpen && (
                <AreaModal
                    isOpen={isEditModalOpen}
                    area={area}
                    onSave={handleAreaSave}
                    onClose={() => setIsEditModalOpen(false)}
                />
            )}
        </div>
    );
};

/* ── Sub-components ─────────────────────────────────────────────── */

interface GoalBucketProps {
    goal: Goal;
    projects: Project[];
    areaColor?: string | null;
    getProjectLink: (p: Project) => string;
    onEdit: () => void;
    onDelete: () => void;
    dimmed?: boolean;
}

const GoalBucket: React.FC<GoalBucketProps> = ({
    goal, projects, areaColor, getProjectLink, onEdit, onDelete, dimmed,
}) => {
    const dotColor = areaColor || '#6b7280';
    return (
        <div className={dimmed ? 'opacity-60' : ''}>
            <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                    <FlagIcon className="h-4 w-4 flex-shrink-0" style={{ color: dotColor }} />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {goal.title}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {HORIZON_LABELS[goal.horizon]}
                        {goal.status !== 'active' && ` · ${STATUS_LABELS[goal.status]}`}
                    </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={onEdit} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Edit goal">
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={onDelete} className="p-1 text-gray-400 hover:text-red-500" title="Delete goal">
                        <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
            {goal.why && (
                <p className="text-xs text-gray-400 dark:text-gray-500 ml-6 mb-1.5 italic">{goal.why}</p>
            )}
            {projects.length > 0 ? (
                <div className="ml-6">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5">
                        Projects
                    </p>
                    <div className="space-y-2">
                        {projects.map((p) => (
                            <ProjectChip key={p.uid || p.id} project={p} getLink={getProjectLink} />
                        ))}
                    </div>
                </div>
            ) : (
                <p className="text-xs text-gray-300 dark:text-gray-600 ml-6 italic">No projects linked</p>
            )}
        </div>
    );
};

interface MaintenanceProjectRowProps {
    project: Project;
    getLink: (p: Project) => string;
    onUnmark: (p: Project) => void;
}

const MaintenanceProjectRow: React.FC<MaintenanceProjectRowProps> = ({ project, getLink, onUnmark }) => {
    const cardColor = (project as any).color || '#6b7280';
    return (
        <div
            className="flex items-center gap-3 px-3 py-3 rounded-md bg-white dark:bg-gray-900 shadow-sm border-l-4 group"
            style={{ borderLeftColor: cardColor }}
        >
            <Link
                to={getLink(project)}
                className="min-w-0 flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate hover:text-gray-900 dark:hover:text-gray-100"
            >
                {project.name}
            </Link>
            <button
                onClick={() => onUnmark(project)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Move back to unlinked"
            >
                unlink
            </button>
        </div>
    );
};

interface ProjectChipProps {
    project: Project;
    getLink: (p: Project) => string;
}

const ProjectChip: React.FC<ProjectChipProps> = ({ project, getLink }) => {
    const cardColor = (project as any).color || '#6b7280';
    return (
        <Link
            to={getLink(project)}
            className="flex items-center gap-3 px-3 py-3 rounded-md bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow border-l-4"
            style={{ borderLeftColor: cardColor }}
        >
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                {project.name}
            </span>
        </Link>
    );
};

interface UnlinkedProjectRowProps {
    project: Project;
    goals: Goal[];
    getLink: (p: Project) => string;
    onLinkToGoal: (p: Project, goal: Goal) => void;
    onMarkMaintenance: (p: Project) => void;
    onDrop: (p: Project) => void;
}

const UnlinkedProjectRow: React.FC<UnlinkedProjectRowProps> = ({
    project, goals, getLink, onLinkToGoal, onMarkMaintenance, onDrop,
}) => {
    const [open, setOpen] = useState(false);

    const cardColor = (project as any).color || '#9ca3af';
    return (
        <div
            className="bg-white dark:bg-gray-900 rounded-md shadow-sm px-3 py-3 border-l-4"
            style={{ borderLeftColor: cardColor }}
        >
            <div className="flex items-start justify-between gap-2">
                <Link
                    to={getLink(project)}
                    className="min-w-0 flex-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 truncate"
                >
                    {project.name}
                </Link>
                <button
                    onClick={() => setOpen((o) => !o)}
                    className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0 mt-0.5"
                >
                    {open ? 'cancel' : 'link…'}
                </button>
            </div>
            {open && (
                <div className="mt-2 space-y-1.5">
                    {goals.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                            {goals.map((g) => (
                                <button
                                    key={g.uid}
                                    onClick={() => onLinkToGoal(project, g)}
                                    className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800/40"
                                >
                                    → {g.title}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                            No active goals yet. Add one above to link this project.
                        </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => onMarkMaintenance(project)}
                            className="text-xs border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                            Maintenance
                        </button>
                        <button
                            onClick={() => onDrop(project)}
                            className="text-xs text-red-400 hover:text-red-600 px-1 py-1"
                        >
                            Drop
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AreaDetails;
