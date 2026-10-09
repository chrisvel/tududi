import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../store/useStore';
import { Area } from '../../entities/Area';
import { Goal } from '../../entities/Goal';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import { fetchTasks } from '../../utils/tasksService';
import { fetchProjects } from '../../utils/projectsService';
import { updateArea } from '../../utils/areasService';
import { updateGoal } from '../../utils/goalsService';
import AreaModal from './AreaModal';
import AreaHero from './AreaHero';
import GoalRow from '../Goal/GoalRow';
import TaskList from '../Task/TaskList';
import ProjectItem from '../Project/ProjectItem';
import useProjectCardActions from '../Project/useProjectCardActions';
import ShareModal from '../Shared/ShareModal';
import { TASK_SHEET_CLASS } from '../Task/taskSheet';

type AreaTab = 'projects' | 'goals' | 'tasks';

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
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<AreaTab>('projects');

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
            const result = await fetchTasks(
                `?area_uid=${area.uid}&type=all&status=all`
            );
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

    // Reloads the full project list and keeps the global store in step.
    const refreshProjects = async () => {
        const list = await fetchProjects('all', '');
        useStore.getState().projectsStore.setProjects(list);
    };

    const { cardActions, modals: projectModals } = useProjectCardActions(() =>
        refreshProjects()
    );

    const areaProjects: Project[] = projectsStore.projects.filter(
        (p: Project) => {
            const projectArea = p.area || (p as any).Area;
            return projectArea?.uid === areaUid;
        }
    );

    const areaGoals: Goal[] = goalsStore.goals.filter(
        (g: Goal) =>
            g.Area?.uid === areaUid || (area && g.area_id === (area as any).id)
    );

    const handleRemoveGoalFromArea = async (goal: Goal) => {
        if (!goal.uid) return;
        try {
            const result = await updateGoal(goal.uid, { area_id: null });
            goalsStore.setGoals(
                goalsStore.goals.map((g: Goal) =>
                    g.uid === result.goal.uid ? result.goal : g
                )
            );
        } catch {
            // silently ignore
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        setAreaTasks((prev) =>
            prev.map((t) => (t.uid === updatedTask.uid ? updatedTask : t))
        );
        tasksStore.setTasks(
            tasksStore.tasks.map((t: Task) =>
                t.uid === updatedTask.uid ? updatedTask : t
            )
        );
    };

    const handleTaskDelete = (taskUid: string) => {
        setAreaTasks((prev) => prev.filter((t) => t.uid !== taskUid));
        tasksStore.setTasks(
            tasksStore.tasks.filter((t: Task) => t.uid !== taskUid)
        );
    };

    const handleAreaSave = async (areaData: Partial<Area>) => {
        if (!area?.uid) return;
        const result = await updateArea(area.uid, {
            name: areaData.name,
            description: areaData.description,
            color: areaData.color,
        });
        areasStore.setAreas(
            areasStore.areas.map((a: Area) =>
                a.uid === result.uid ? result : a
            )
        );
        setArea(result);
        setIsEditModalOpen(false);
        const slug = result.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
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
        (t) =>
            t.status !== 'done' &&
            t.status !== 2 &&
            t.status !== 'archived' &&
            t.status !== 3
    );
    const completedTasks = areaTasks.filter(
        (t) => t.status === 'done' || t.status === 2
    );

    const tabClass = (tab: AreaTab) =>
        `relative flex items-center self-stretch py-2.5 text-sm font-medium transition-colors ${
            activeTab === tab
                ? 'text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-px after:right-px after:h-0.5 after:rounded-full after:bg-gray-900 dark:after:bg-gray-100'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
        }`;

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-12">
            <AreaHero
                area={area}
                t={t}
                projectsCount={areaProjects.length}
                goalsCount={areaGoals.length}
                tasksCount={areaTasks.length}
                doneCount={completedTasks.length}
                totalCount={areaTasks.length}
                onShareClick={() => setIsShareModalOpen(true)}
                onEditClick={() => setIsEditModalOpen(true)}
            />

            <div className="mb-4">
                <div className="flex items-center min-h-[2.5rem]">
                    <div className="flex items-center gap-4 sm:gap-6 self-stretch pl-2 sm:pl-3">
                        <button
                            type="button"
                            onClick={() => setActiveTab('projects')}
                            className={tabClass('projects')}
                            aria-pressed={activeTab === 'projects'}
                        >
                            {t('projects.title', 'Projects')} (
                            {areaProjects.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('goals')}
                            className={tabClass('goals')}
                            aria-pressed={activeTab === 'goals'}
                        >
                            {t('goals.title', 'Goals')} ({areaGoals.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('tasks')}
                            className={tabClass('tasks')}
                            aria-pressed={activeTab === 'tasks'}
                        >
                            {t('areas.tasksInArea', 'Tasks')} (
                            {areaTasks.length})
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'projects' &&
                (areaProjects.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 px-2">
                        {t('areas.noProjects', 'No projects in this area.')}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {areaProjects.map((project) => (
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
                ))}

            {activeTab === 'goals' &&
                (areaGoals.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 px-2">
                        {t(
                            'goals.noGoalsInArea',
                            'No goals linked to this area.'
                        )}
                    </p>
                ) : (
                    <div
                        className={`task-list-container overflow-visible ${TASK_SHEET_CLASS} task-sheet-rails`}
                    >
                        {areaGoals.map((goal) => (
                            <div key={goal.uid}>
                                <GoalRow
                                    goal={goal}
                                    onRemoveFromArea={handleRemoveGoalFromArea}
                                />
                            </div>
                        ))}
                    </div>
                ))}

            {activeTab === 'tasks' &&
                (loadingTasks ? (
                    <div className="px-2 text-sm text-gray-400 dark:text-gray-500">
                        {t('loading.tasks', 'Loading tasks…')}
                    </div>
                ) : activeTasks.length === 0 && completedTasks.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 px-2">
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
                                <h3 className="px-2 text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                                    {t('tasks.completed', 'Completed')} (
                                    {completedTasks.length})
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
                ))}

            {projectModals}

            {isEditModalOpen && (
                <AreaModal
                    isOpen={isEditModalOpen}
                    area={area}
                    onSave={handleAreaSave}
                    onClose={() => setIsEditModalOpen(false)}
                />
            )}

            <ShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                resourceType="area"
                resourceUid={area.uid || null}
                resourceName={area.name}
            />
        </div>
    );
};

export default AreaDetails;
