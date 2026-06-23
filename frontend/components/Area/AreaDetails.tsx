import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PencilIcon } from '@heroicons/react/24/outline';
import { useStore } from '../../store/useStore';
import { Area } from '../../entities/Area';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import { fetchTasks } from '../../utils/tasksService';
import { updateArea } from '../../utils/areasService';
import AreaModal from './AreaModal';
import TaskList from '../Task/TaskList';

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
        } catch (err) {
            console.error('Error fetching area tasks:', err);
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

    const areaProjects = projectsStore.projects.filter((p: Project) => {
        const projectArea = p.area || (p as any).Area;
        return projectArea?.uid === areaUid;
    });

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

    const getProjectLink = (project: Project) => {
        if (project.uid) {
            const slug = project.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/project/${project.uid}-${slug}`;
        }
        return `/project/${project.id}`;
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
    const completedTasks = areaTasks.filter(
        (t) => t.status === 'done' || t.status === 2
    );

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
                            <h1
                                className={`text-3xl font-light uppercase tracking-wide ${
                                    area.color ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                                }`}
                            >
                                {area.name}
                            </h1>
                            {area.description && (
                                <p
                                    className={`mt-2 text-sm ${
                                        area.color ? 'text-white/80' : 'text-gray-600 dark:text-gray-400'
                                    }`}
                                >
                                    {area.description}
                                </p>
                            )}
                            <div
                                className={`mt-3 flex gap-4 text-xs ${
                                    area.color ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                                }`}
                            >
                                <span>
                                    {areaProjects.length}{' '}
                                    {t('areas.projects', 'projects')}
                                </span>
                                <span>
                                    {activeTasks.length}{' '}
                                    {t('areas.tasks', 'tasks')}
                                </span>
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Projects column */}
                <div className="lg:col-span-1">
                    <h2 className="text-lg font-light text-gray-700 dark:text-gray-300 mb-4">
                        {t('areas.projectsInArea', 'Projects')}
                    </h2>
                    {areaProjects.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500">
                            {t('areas.noProjects', 'No projects in this area')}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {areaProjects.map((project: Project) => (
                                <Link
                                    key={project.uid || project.id}
                                    to={getProjectLink(project)}
                                    className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    {project.image_url ? (
                                        <img
                                            src={project.image_url}
                                            alt={project.name}
                                            className="w-8 h-8 rounded object-cover flex-shrink-0"
                                        />
                                    ) : (
                                        <div
                                            className="w-8 h-8 rounded flex-shrink-0"
                                            style={{
                                                backgroundColor:
                                                    (project as any).color || area.color || '#6b7280',
                                            }}
                                        />
                                    )}
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                                        {project.name}
                                    </span>
                                </Link>
                            ))}
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

export default AreaDetails;
