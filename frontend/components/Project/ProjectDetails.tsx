import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import {
    PencilSquareIcon,
    TrashIcon,
    FolderIcon,
    Squares2X2Icon,
    BookOpenIcon,
    TagIcon,
    ListBulletIcon,
    ChevronDownIcon,
    BarsArrowUpIcon,
} from '@heroicons/react/24/outline';
import TaskList from '../Task/TaskList';
import ProjectModal from '../Project/ProjectModal';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useStore } from '../../store/useStore';
import NewTask from '../Task/NewTask';
import { Project } from '../../entities/Project';
import { PriorityType, Task } from '../../entities/Task';
import { Note } from '../../entities/Note';
import {
    fetchProjectById,
    updateProject,
    deleteProject,
} from '../../utils/projectsService';
import {
    createTask,
    deleteTask,
    toggleTaskToday,
} from '../../utils/tasksService';
import { fetchAreas } from '../../utils/areasService';
import { isAuthError } from '../../utils/authUtils';
import {
    CalendarDaysIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/solid';
import { getAutoSuggestNextActionsEnabled } from '../../utils/profileService';
import AutoSuggestNextActionBox from './AutoSuggestNextActionBox';

type PriorityStyles = Record<PriorityType, string> & { default: string };

const priorityStyles: PriorityStyles = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
    default: 'bg-gray-400',
};

const ProjectDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { showSuccessToast } = useToast();

    const areas = useStore((state) => state.areasStore.areas);

    const [project, setProject] = useState<Project | undefined>(undefined);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(true);
    const [error] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showAutoSuggestForm, setShowAutoSuggestForm] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');

    const dropdownRef = useRef<HTMLDivElement>(null);

    // Dispatch global modal events

    useEffect(() => {
        const loadProjectData = async () => {
            if (!id) {
                console.error('Project ID is missing.');
                return;
            }

            setLoading(true);
            try {
                fetchAreas();
                const projectData = await fetchProjectById(id);
                setProject(projectData);
                // Handle both 'tasks' and 'Tasks' property names
                const projectTasks =
                    projectData.tasks || projectData.Tasks || [];
                setTasks(projectTasks);
                // Handle project notes
                const projectNotes =
                    projectData.notes || projectData.Notes || [];
                setNotes(projectNotes);
            } catch (error) {
                console.error('Error fetching project data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadProjectData();
    }, [id, fetchAreas]);

    // Check if we should show auto-suggest form for projects with no tasks
    useEffect(() => {
        const checkAutoSuggest = async () => {
            if (project && tasks.length === 0 && !loading) {
                const autoSuggestEnabled =
                    await getAutoSuggestNextActionsEnabled();
                if (autoSuggestEnabled) {
                    setShowAutoSuggestForm(true);
                }
            }
        };

        checkAutoSuggest();
    }, [project, tasks, loading]);

    // Load saved sort order from localStorage
    useEffect(() => {
        const savedOrderBy =
            localStorage.getItem('project_order_by') || 'created_at:desc';
        setOrderBy(savedOrderBy);
    }, []);

    // Handle click outside dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [dropdownOpen]);

    const handleTaskCreate = async (taskName: string) => {
        if (!project) {
            console.error('Cannot create task: Project is missing');
            throw new Error('Cannot create task: Project is missing');
        }

        try {
            const newTask = await createTask({
                name: taskName,
                status: 'not_started',
                project_id: project.id,
            });
            setTasks((prevTasks) => [...prevTasks, newTask]);

            // Show success toast with task link
            const taskLink = (
                <span>
                    {t('task.created', 'Task')}{' '}
                    <a
                        href={`/task/${newTask.uuid}`}
                        className="text-green-200 underline hover:text-green-100"
                    >
                        {newTask.name}
                    </a>{' '}
                    {t('task.createdSuccessfully', 'created successfully!')}
                </span>
            );
            showSuccessToast(taskLink);
        } catch (err: any) {
            console.error('Error creating task:', err);
            // Check if it's an authentication error
            if (isAuthError(err)) {
                return;
            }
            throw err; // Re-throw to allow proper error handling by NewTask component
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        if (!updatedTask.id) {
            console.error('Cannot update task: Task ID is missing');
            return;
        }
        try {
            // Use direct fetch call like Tasks.tsx to ensure proper tag saving
            const response = await fetch(`/api/task/${updatedTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(updatedTask),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to update task:', errorData.error);
                throw new Error('Failed to update task');
            }

            const savedTask = await response.json();
            setTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === updatedTask.id ? savedTask : task
                )
            );
        } catch (err) {
            console.error('Error updating task:', err);
        }
    };

    const handleTaskDelete = async (taskId: number | undefined) => {
        if (!taskId) {
            console.error('Cannot delete task: Task ID is missing');
            return;
        }
        try {
            await deleteTask(taskId);
            setTasks((prevTasks) =>
                prevTasks.filter((task) => task.id !== taskId)
            );
        } catch (err) {
            console.error('Error deleting task:', err);
        }
    };

    const handleToggleToday = async (taskId: number): Promise<void> => {
        try {
            const updatedTask = await toggleTaskToday(taskId);
            // Update the task in the local state immediately to avoid UI flashing
            setTasks((prevTasks) =>
                prevTasks.map((task) =>
                    task.id === taskId
                        ? {
                              ...task,
                              today: updatedTask.today,
                              today_move_count: updatedTask.today_move_count,
                          }
                        : task
                )
            );
        } catch (error) {
            console.error('Error toggling task today status:', error);
            // Optionally refetch data on error to ensure consistency
            if (id) {
                try {
                    const updatedProject = await fetchProjectById(id);
                    setProject(updatedProject);
                    setTasks(updatedProject.tasks || []);
                } catch (refetchError) {
                    console.error(
                        'Error refetching project data:',
                        refetchError
                    );
                }
            }
        }
    };

    const handleEditProject = () => {
        setIsModalOpen(true);
    };

    const handleSaveProject = async (updatedProject: Project) => {
        if (!updatedProject.id) {
            console.error('Cannot save project: Project ID is missing');
            return;
        }

        try {
            const savedProject = await updateProject(
                updatedProject.id,
                updatedProject
            );
            setProject(savedProject);
            setIsModalOpen(false);
        } catch (err) {
            console.error('Error saving project:', err);
        }
    };

    const handleCreateNextAction = async (
        projectId: number,
        actionDescription: string
    ) => {
        try {
            const newTask = await createTask({
                name: actionDescription,
                status: 'not_started',
                project_id: projectId,
                priority: 'medium',
            });

            // Update the tasks list to include the new task
            setTasks((prevTasks) => [...prevTasks, newTask]);
            setShowAutoSuggestForm(false);

            // Show success toast with task link
            const taskLink = (
                <span>
                    {t('task.created', 'Task')}{' '}
                    <a
                        href={`/task/${newTask.uuid}`}
                        className="text-green-200 underline hover:text-green-100"
                    >
                        {newTask.name}
                    </a>{' '}
                    {t('task.createdSuccessfully', 'created successfully!')}
                </span>
            );
            showSuccessToast(taskLink);
        } catch (error) {
            console.error('Error creating next action:', error);
        }
    };

    const handleSkipNextAction = () => {
        setShowAutoSuggestForm(false);
    };

    const handleSortChange = (order: string) => {
        setOrderBy(order);
        localStorage.setItem('project_order_by', order);
        setDropdownOpen(false);
    };

    const capitalize = (str: string) =>
        str.charAt(0).toUpperCase() + str.slice(1);

    const handleDeleteProject = async () => {
        if (!project?.id) {
            console.error('Cannot delete project: Project ID is missing');
            return;
        }

        try {
            await deleteProject(project.id);
            navigate('/projects');
        } catch (err) {
            console.error('Error deleting project:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    Loading project details...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">{error}</div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">Project not found.</div>
            </div>
        );
    }

    const activeTasks =
        tasks?.filter((task) => {
            return typeof task.status === 'number'
                ? task.status !== 2
                : task.status !== 'done';
        }) || []; //TODO: Also add archived
    const completedTasks = tasks?.filter((task) => {
        return typeof task.status === 'number'
            ? task.status === 2
            : task.status === 'done';
    });

    const sortTasks = (tasks: Task[], orderBy: string) => {
        const [field, direction] = orderBy.split(':');
        const sortedTasks = [...tasks].sort((a, b) => {
            let aValue: any, bValue: any;

            switch (field) {
                case 'due_date':
                    aValue = a.due_date
                        ? new Date(a.due_date).getTime()
                        : Infinity;
                    bValue = b.due_date
                        ? new Date(b.due_date).getTime()
                        : Infinity;
                    break;
                case 'name':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'priority': {
                    const getPriorityValue = (
                        priority: string | number | undefined
                    ) => {
                        if (typeof priority === 'number') {
                            return priority; // 0=low, 1=medium, 2=high
                        }
                        const priorityOrder = { low: 0, medium: 1, high: 2 };
                        return (
                            priorityOrder[
                                priority as keyof typeof priorityOrder
                            ] || 0
                        );
                    };
                    aValue = getPriorityValue(a.priority);
                    bValue = getPriorityValue(b.priority);
                    break;
                }
                case 'status': {
                    const getStatusValue = (
                        status: string | number | undefined
                    ) => {
                        if (typeof status === 'number') {
                            return status; // 0=not_started, 1=in_progress, 2=done
                        }
                        const statusOrder = {
                            not_started: 0,
                            in_progress: 1,
                            done: 2,
                        };
                        return (
                            statusOrder[status as keyof typeof statusOrder] || 0
                        );
                    };
                    aValue = getStatusValue(a.status);
                    bValue = getStatusValue(b.status);
                    break;
                }
                case 'created_at':
                    aValue = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    bValue = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;
                    break;
                default:
                    return 0;
            }

            if (direction === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });

        return sortedTasks;
    };

    const tasksToDisplay = showCompleted
        ? [...activeTasks, ...completedTasks]
        : activeTasks;

    const displayTasks = sortTasks(tasksToDisplay, orderBy);

    const formatProjectDueDate = (dateString: string) => {
        const date = new Date(dateString);
        const currentLang = i18n.language;

        // Format based on language
        const formatOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };

        return date.toLocaleDateString(currentLang, formatOptions);
    };

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Project Banner Image */}
                {project.image_url && (
                    <div className="mb-6 rounded-lg overflow-hidden relative">
                        <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-full h-48 object-cover"
                        />
                        {/* Title Overlay */}
                        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                            <h1 className="text-4xl md:text-5xl font-bold text-white text-center px-4 drop-shadow-lg">
                                {project.name}
                            </h1>
                        </div>
                        {/* Priority Indicator on Image */}
                        {project.priority !== undefined &&
                            project.priority !== null && (
                                <div className="absolute top-3 left-3">
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 border-white shadow-lg ${getPriorityStyle(
                                            project.priority
                                        )}`}
                                        title={`Priority: ${priorityLabel(project.priority)}`}
                                        aria-label={`Priority: ${priorityLabel(project.priority)}`}
                                    ></div>
                                </div>
                            )}
                        {/* Edit/Delete Buttons on Image */}
                        <div className="absolute bottom-4 right-4 flex space-x-2">
                            <button
                                onClick={handleEditProject}
                                className="p-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsConfirmDialogOpen(true)}
                                className="p-2 bg-black bg-opacity-50 text-white hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Project Metadata Box */}
                {(project.description ||
                    project.area ||
                    project.due_date_at ||
                    (project.tags && project.tags.length > 0)) && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="grid gap-3">
                            {project.description && (
                                <div className="flex items-start">
                                    <InformationCircleIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">
                                            Description:
                                        </span>
                                        <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed mt-1">
                                            {project.description}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {project.area && (
                                <div className="flex items-center">
                                    <Squares2X2Icon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-3" />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">
                                        Area:
                                    </span>
                                    <span className="text-sm text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                        {project.area.name}
                                    </span>
                                </div>
                            )}

                            {project.due_date_at && (
                                <div className="flex items-center">
                                    <CalendarDaysIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-3" />
                                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">
                                        Due Date:
                                    </span>
                                    <span className="text-sm text-gray-900 dark:text-gray-100">
                                        {formatProjectDueDate(
                                            project.due_date_at
                                        )}
                                    </span>
                                </div>
                            )}

                            {project.tags && project.tags.length > 0 && (
                                <div className="flex items-start">
                                    <div className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-3 mt-0.5">
                                        <svg
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">
                                            Tags:
                                        </span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {project.tags.map((tag, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() =>
                                                        navigate(
                                                            `/tag/${encodeURIComponent(tag.name)}`
                                                        )
                                                    }
                                                    className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                                                >
                                                    {tag.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Project Header - Only show when no image */}
                {!project.image_url && (
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center">
                            <FolderIcon className="h-6 w-6 text-gray-500 mr-3" />
                            <h2 className="text-2xl font-light text-gray-900 dark:text-gray-100 mr-2">
                                {project.name}
                            </h2>
                            {/* Show priority indicator only when no image */}
                            {project.priority !== undefined &&
                                project.priority !== null && (
                                    <div
                                        className={`w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${getPriorityStyle(
                                            project.priority
                                        )}`}
                                        title={`Priority: ${priorityLabel(project.priority)}`}
                                        aria-label={`Priority: ${priorityLabel(project.priority)}`}
                                    ></div>
                                )}
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleEditProject}
                                className="text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsConfirmDialogOpen(true)}
                                className="text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                )}

                {!showAutoSuggestForm && (
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center">
                            <ListBulletIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                {t('sidebar.tasks', 'Tasks')}
                            </h3>
                        </div>
                        <div className="flex items-center space-x-3">
                            {completedTasks.length > 0 && (
                                <label className="flex items-center space-x-2 cursor-pointer">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {t(
                                            'project.showCompleted',
                                            'Show completed'
                                        )}
                                    </span>
                                    <div className="relative flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={showCompleted}
                                            onChange={(e) =>
                                                setShowCompleted(
                                                    e.target.checked
                                                )
                                            }
                                            className="sr-only"
                                        />
                                        <div
                                            className={`w-10 h-5 rounded-full transition-colors ${
                                                showCompleted
                                                    ? 'bg-blue-500'
                                                    : 'bg-gray-300 dark:bg-gray-600'
                                            }`}
                                        >
                                            <div
                                                className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
                                                    showCompleted
                                                        ? 'translate-x-5'
                                                        : 'translate-x-0.5'
                                                } translate-y-0.5`}
                                            ></div>
                                        </div>
                                    </div>
                                </label>
                            )}

                            {/* Sort Dropdown */}
                            <div
                                className="relative inline-block text-left"
                                ref={dropdownRef}
                            >
                                <button
                                    type="button"
                                    className="inline-flex justify-center w-full rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                                    id="menu-button"
                                    aria-expanded={dropdownOpen}
                                    aria-haspopup="true"
                                    onClick={() =>
                                        setDropdownOpen(!dropdownOpen)
                                    }
                                >
                                    <BarsArrowUpIcon className="h-5 w-5 text-gray-500 mr-2" />
                                    {t(
                                        `sort.${orderBy.split(':')[0]}`,
                                        capitalize(
                                            orderBy
                                                .split(':')[0]
                                                .replace('_', ' ')
                                        )
                                    )}
                                    <ChevronDownIcon className="h-5 w-5 ml-2 text-gray-500 dark:text-gray-300" />
                                </button>

                                {dropdownOpen && (
                                    <div
                                        className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none z-10"
                                        role="menu"
                                        aria-orientation="vertical"
                                        aria-labelledby="menu-button"
                                    >
                                        <div
                                            className="py-1 max-h-60 overflow-y-auto"
                                            role="none"
                                        >
                                            {[
                                                'due_date:asc',
                                                'name:asc',
                                                'priority:desc',
                                                'status:desc',
                                                'created_at:desc',
                                            ].map((order) => (
                                                <button
                                                    key={order}
                                                    onClick={() =>
                                                        handleSortChange(order)
                                                    }
                                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                                                    role="menuitem"
                                                >
                                                    {t(
                                                        `sort.${order.split(':')[0]}`,
                                                        capitalize(
                                                            order
                                                                .split(':')[0]
                                                                .replace(
                                                                    '_',
                                                                    ' '
                                                                )
                                                        )
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {!showAutoSuggestForm && (
                    <NewTask onTaskCreate={handleTaskCreate} />
                )}

                <div className="mt-2">
                    {displayTasks.length > 0 ? (
                        <TaskList
                            tasks={displayTasks}
                            onTaskUpdate={handleTaskUpdate}
                            onTaskDelete={handleTaskDelete}
                            projects={project ? [project] : []}
                            hideProjectName={true}
                            onToggleToday={handleToggleToday}
                        />
                    ) : showAutoSuggestForm ? (
                        <AutoSuggestNextActionBox
                            onAddAction={(actionDescription) => {
                                if (project?.id) {
                                    handleCreateNextAction(
                                        project.id,
                                        actionDescription
                                    );
                                }
                            }}
                            onDismiss={handleSkipNextAction}
                            projectName={project?.name || ''}
                        />
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">
                            No tasks.
                        </p>
                    )}
                </div>

                {/* Notes Section */}
                <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                        <BookOpenIcon className="h-5 w-5 mr-2" />
                        {t('sidebar.notes', 'Notes')}
                    </h3>

                    {notes.length > 0 ? (
                        <div className="space-y-3">
                            {notes.map((note) => (
                                <div
                                    key={note.id}
                                    className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-3 border-l-4 border-blue-500"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-grow">
                                            <Link
                                                to={`/note/${note.id}`}
                                                className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                                            >
                                                {note.title ||
                                                    t(
                                                        'notes.untitled',
                                                        'Untitled Note'
                                                    )}
                                            </Link>
                                            {note.content && (
                                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                                    {note.content.length > 150
                                                        ? note.content.substring(
                                                              0,
                                                              150
                                                          ) + '...'
                                                        : note.content}
                                                </p>
                                            )}
                                            {note.tags &&
                                                note.tags.length > 0 && (
                                                    <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                                                        <TagIcon className="h-3 w-3 mr-1" />
                                                        <span>
                                                            {note.tags
                                                                .map(
                                                                    (tag) =>
                                                                        tag.name
                                                                )
                                                                .join(', ')}
                                                        </span>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">
                            {t('project.noNotes', 'No notes for this project.')}
                        </p>
                    )}
                </div>

                <ProjectModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveProject}
                    project={project}
                    areas={areas}
                />

                {isConfirmDialogOpen && (
                    <ConfirmDialog
                        title="Delete Project"
                        message={`Are you sure you want to delete the project "${project.name}"?`}
                        onConfirm={handleDeleteProject}
                        onCancel={() => setIsConfirmDialogOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};

const priorityLabel = (priority: PriorityType | number) => {
    // Handle both string and numeric priorities
    const normalizedPriority =
        typeof priority === 'number'
            ? (['low', 'medium', 'high'][priority] as PriorityType)
            : priority;

    switch (normalizedPriority) {
        case 'high':
            return 'High';
        case 'medium':
            return 'Medium';
        case 'low':
            return 'Low';
        default:
            return '';
    }
};

const getPriorityStyle = (priority: PriorityType | number) => {
    // Handle both string and numeric priorities
    const normalizedPriority =
        typeof priority === 'number'
            ? (['low', 'medium', 'high'][priority] as PriorityType)
            : priority;

    return priorityStyles[normalizedPriority] || priorityStyles.default;
};

export default ProjectDetails;
