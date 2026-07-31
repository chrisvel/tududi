import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilIcon,
    FlagIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { Area } from '../../entities/Area';
import { Goal } from '../../entities/Goal';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import { fetchTasks } from '../../utils/tasksService';
import { updateArea } from '../../utils/areasService';
import { updateGoal } from '../../utils/goalsService';
import AreaModal from './AreaModal';
import TaskList from '../Task/TaskList';
import { createGoalUrl } from '../../utils/slugUtils';

const STATUS_COLORS: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    achieved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    dropped: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

const AreaDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();

    const areasStore = useStore((state: any) => state.areasStore);
    const projectsStore = useStore((state: any) => state.projectsStore);
    const tasksStore = useStore((state: any) => state.tasksStore);
    const goalsStore = useStore((state: any) => state.goalsStore);

    const [area, setArea] = useState<Area | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isError, setIsError] = useState(false);
    const [areaTasks, setAreaTasks] = useState<Task[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
        if (!goalsStore.hasLoaded && !goalsStore.isLoading) {
            goalsStore.loadGoals();
        }
    }, [goalsStore]);

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
        if (!area?.uid) return;
        setLoadingTasks(true);
        try {
            const result = await fetchTasks(`?area_uid=${area.uid}&type=all&status=all`);
            setAreaTasks(result.tasks || []);
        } catch {
            setAreaTasks([]);
        } finally {
            setLoadingTasks(false);
        }
    }, [area?.uid]);

    useEffect(() => {
        if (area?.uid) loadAreaTasks();
    }, [area?.uid, loadAreaTasks]);

    const areaProjects = projectsStore.projects.filter((p: Project) => {
        const projectArea = p.area || (p as any).Area;
        return projectArea?.uid === areaUid;
    });

    const areaGoals: Goal[] = goalsStore.goals.filter(
        (g: Goal) => g.Area?.uid === areaUid || (area && g.area_id === (area as any).id)
    );

    const handleRemoveGoalFromArea = async (goal: Goal) => {
        if (!goal.uid) return;
        try {
            const result = await updateGoal(goal.uid, { area_id: null });
            goalsStore.setGoals(
                goalsStore.goals.map((g: Goal) => g.uid === result.goal.uid ? result.goal : g)
            );
        } catch {
            // silently ignore
        }
    };

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
                            <h1 className={`text-3xl font-light uppercase tracking-wide ${
                                area.color ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                            }`}>
                                {area.name}
                            </h1>
                            {area.description && (
                                <p className={`mt-2 text-sm ${area.color ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'}`}>
                                    {area.description}
                                </p>
                            )}
                            <div className={`mt-3 flex gap-4 text-xs ${area.color ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
                                <span>{areaProjects.length} {t('areas.projects', 'projects')}</span>
                                <span>{areaGoals.length} {t('areas.goals', 'goals')}</span>
                                <span>{activeTasks.length} {t('areas.tasks', 'tasks')}</span>
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

            {/* Goals section */}
            <div className="mb-10">
                <h2 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4">
                    {t('goals.title', 'Goals')} ({areaGoals.length})
                </h2>

                {areaGoals.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                        {t('goals.noGoalsInArea', 'No goals linked to this area.')}
                    </p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {areaGoals.map((goal) => {
                            const goalUrl = goal.uid ? createGoalUrl({ uid: goal.uid, title: goal.title }) : '/goals';
                            return (
                                <div key={goal.uid} className="flex items-center gap-2 group">
                                    <Link
                                        to={goalUrl}
                                        className={`flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 hover:bg-white dark:hover:bg-gray-800 transition-colors ${goal.color ? 'border-l-4' : ''}`}
                                        style={goal.color ? { borderLeftColor: goal.color } : {}}
                                    >
                                        <FlagIcon className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                                            {goal.title}
                                        </span>
                                        {goal.why && (
                                            <span className="text-xs text-gray-400 dark:text-gray-500 truncate hidden sm:block max-w-xs">
                                                {goal.why}
                                            </span>
                                        )}
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLORS[goal.status] ?? ''}`}>
                                            {t(`goals.status.${goal.status}`, goal.status)}
                                        </span>
                                    </Link>
                                    <button
                                        onClick={() => handleRemoveGoalFromArea(goal)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 rounded"
                                        title={t('goals.removeFromArea', 'Remove from area')}
                                    >
                                        <XMarkIcon className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tasks */}
            <div>
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

export default AreaDetails;
