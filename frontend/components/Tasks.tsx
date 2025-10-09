import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '../contexts/SidebarContext';
import TaskList from './Task/TaskList';
import GroupedTaskList from './Task/GroupedTaskList';
import NewTask from './Task/NewTask';
import SortFilter from './Shared/SortFilter';
import { Task } from '../entities/Task';
import { getTitleAndIcon } from './Task/getTitleAndIcon';
import { getDescription } from './Task/getDescription';
import {
    createTask,
    toggleTaskToday,
    GroupedTasks,
} from '../utils/tasksService';
import { useStore } from '../store/useStore';
import { useToast } from './Shared/ToastContext';
import { SortOption } from './Shared/SortFilterButton';
import {
    TagIcon,
    XMarkIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

// Helper function to get search placeholder by language
const getSearchPlaceholder = (language: string): string => {
    const placeholders: Record<string, string> = {
        en: 'Search tasks...',
        el: 'Αναζήτηση εργασιών...',
        es: 'Buscar tareas...',
        de: 'Aufgaben suchen...',
        jp: 'タスクを検索...',
        ua: 'Пошук завдань...',
    };

    return placeholders[language] || 'Search tasks...';
};

const Tasks: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { showSuccessToast } = useToast();
    const { isSidebarOpen } = useSidebar();
    const [tasks, setTasks] = useState<Task[]>([]);
    const projects = useStore((state: any) => state.projectsStore.projects);
    const [groupedTasks, setGroupedTasks] = useState<GroupedTasks | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');
    const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');
    const [isInfoExpanded, setIsInfoExpanded] = useState(false); // Collapsed by default
    const [isSearchExpanded, setIsSearchExpanded] = useState(false); // Collapsed by default
    const [showCompleted, setShowCompleted] = useState(false); // Show completed tasks toggle
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const query = new URLSearchParams(location.search);
    const isUpcomingView = query.get('type') === 'upcoming';

    // Filter tasks based on completion status and search query
    const displayTasks = useMemo(() => {
        let filteredTasks;

        // For upcoming view, don't filter by completion status here
        // Let GroupedTaskList handle it
        if (isUpcomingView) {
            filteredTasks = tasks;
        } else {
            // First filter by completion status
            if (showCompleted) {
                // Show only completed tasks (done=2 or archived=3)
                filteredTasks = tasks.filter(
                    (task) =>
                        task.status === 'done' ||
                        task.status === 'archived' ||
                        task.status === 2 ||
                        task.status === 3
                );
            } else {
                // Show only non-completed tasks - exclude done(2) and archived(3)
                filteredTasks = tasks.filter(
                    (task) =>
                        task.status !== 'done' &&
                        task.status !== 'archived' &&
                        task.status !== 2 &&
                        task.status !== 3
                );
            }

            // Then filter by search query if provided (skip for upcoming view)
            if (taskSearchQuery.trim()) {
                const query = taskSearchQuery.toLowerCase();
                filteredTasks = filteredTasks.filter(
                    (task) =>
                        task.name.toLowerCase().includes(query) ||
                        task.original_name?.toLowerCase().includes(query) ||
                        task.note?.toLowerCase().includes(query)
                );
            }
        }

        return filteredTasks;
    }, [tasks, showCompleted, taskSearchQuery, isUpcomingView]);

    // Handle the /upcoming route by setting type=upcoming in query params
    if (location.pathname === '/upcoming' && !query.get('type')) {
        query.set('type', 'upcoming');
    }

    const { title: stateTitle } = location.state || {};

    const title =
        stateTitle ||
        getTitleAndIcon(query, projects, t, location.pathname).title;

    const tag = query.get('tag');
    const status = query.get('status');

    useEffect(() => {
        const savedOrderBy =
            localStorage.getItem('order_by') || 'created_at:desc';
        setOrderBy(savedOrderBy);

        const params = new URLSearchParams(location.search);
        if (!params.get('order_by')) {
            params.set('order_by', savedOrderBy);
            navigate(
                {
                    pathname: location.pathname,
                    search: `?${params.toString()}`,
                },
                { replace: true }
            );
        }
    }, [location.pathname]);

    // Clear search query when switching to upcoming view
    useEffect(() => {
        if (isUpcomingView) {
            setTaskSearchQuery('');
            setIsSearchExpanded(false);
        }
    }, [isUpcomingView]);

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

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const tagId = query.get('tag');
                const type = query.get('type');

                // Fetch all tasks (both completed and non-completed) for client-side filtering
                const allTasksUrl = new URLSearchParams(query.toString());
                // Add special parameter to get ALL tasks (completed and non-completed)
                allTasksUrl.set('client_side_filtering', 'true');

                // Add groupBy=day for upcoming tasks
                if (type === 'upcoming') {
                    allTasksUrl.set('type', 'upcoming');
                    allTasksUrl.set('groupBy', 'day');
                    // Always show 7 days (whole week including tomorrow)
                    allTasksUrl.set('maxDays', '7');
                    allTasksUrl.set('sidebarOpen', isSidebarOpen.toString());
                    allTasksUrl.set('isMobile', isMobile.toString());
                }

                const searchParams = allTasksUrl.toString();

                const tasksResponse = await fetch(
                    `/api/tasks?${searchParams}${tagId ? `&tag=${tagId}` : ''}`
                );

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    setTasks(tasksData.tasks || []);
                    setGroupedTasks(tasksData.groupedTasks || null);
                } else {
                    throw new Error('Failed to fetch tasks.');
                }

                // Projects are now loaded by Layout component into global store
            } catch (error) {
                setError((error as Error).message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [location, isSidebarOpen, isMobile]);

    // Handle window resize for mobile detection
    useEffect(() => {
        const handleResize = () => {
            const newIsMobile = window.innerWidth < 768;
            if (newIsMobile !== isMobile) {
                setIsMobile(newIsMobile);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isMobile]);

    // Listen for task creation from other components (e.g., Layout modal)
    useEffect(() => {
        const handleTaskCreated = (event: CustomEvent) => {
            const newTask = event.detail;
            if (newTask) {
                setTasks((prevTasks) => [newTask, ...prevTasks]);
            }
        };

        window.addEventListener(
            'taskCreated',
            handleTaskCreated as EventListener
        );
        return () => {
            window.removeEventListener(
                'taskCreated',
                handleTaskCreated as EventListener
            );
        };
    }, []);

    const handleRemoveTag = () => {
        const params = new URLSearchParams(location.search);
        params.delete('tag');
        navigate({
            pathname: location.pathname,
            search: `?${params.toString()}`,
        });
    };

    const handleTaskCreate = async (taskData: Partial<Task>) => {
        try {
            const newTask = await createTask(taskData as Task);
            // Add the new task optimistically to avoid race conditions
            setTasks((prevTasks) => [newTask, ...prevTasks]);

            // Show success toast with task link
            const taskLink = (
                <span>
                    {t('task.created', 'Task')}{' '}
                    <a
                        href={`/task/${newTask.uid}`}
                        className="text-green-200 underline hover:text-green-100"
                    >
                        {newTask.name}
                    </a>{' '}
                    {t('task.createdSuccessfully', 'created successfully!')}
                </span>
            );
            showSuccessToast(taskLink);
        } catch (error) {
            console.error('Error creating task:', error);
            setError('Error creating task.');
            throw error; // Re-throw to allow proper error handling
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            const response = await fetch(`/api/task/${updatedTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTask),
            });

            if (response.ok) {
                const updatedTaskFromServer = await response.json();
                setTasks((prevTasks) =>
                    prevTasks.map((task) =>
                        task.id === updatedTask.id
                            ? {
                                  ...task,
                                  ...updatedTaskFromServer,
                                  // Explicitly preserve subtasks data
                                  subtasks:
                                      updatedTaskFromServer.subtasks ||
                                      updatedTaskFromServer.Subtasks ||
                                      task.subtasks ||
                                      task.Subtasks ||
                                      [],
                                  Subtasks:
                                      updatedTaskFromServer.subtasks ||
                                      updatedTaskFromServer.Subtasks ||
                                      task.subtasks ||
                                      task.Subtasks ||
                                      [],
                              }
                            : task
                    )
                );
            } else {
                const errorData = await response.json();
                console.error('Failed to update task:', errorData.error);
                setError('Failed to update task.');
            }
        } catch (error) {
            console.error('Error updating task:', error);
            setError('Error updating task.');
        }
    };

    // Handler specifically for task completion toggles (no API call needed, just state update)
    const handleTaskCompletionToggle = (updatedTask: Task) => {
        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task
            )
        );

        // Also update groupedTasks if they exist
        if (groupedTasks) {
            setGroupedTasks((prevGroupedTasks) => {
                if (!prevGroupedTasks) return null;

                const newGroupedTasks: GroupedTasks = {};
                Object.entries(prevGroupedTasks).forEach(
                    ([groupName, tasks]) => {
                        newGroupedTasks[groupName] = tasks.map((task) =>
                            task.id === updatedTask.id ? updatedTask : task
                        );
                    }
                );
                return newGroupedTasks;
            });
        }
    };

    const handleTaskDelete = async (taskId: number) => {
        try {
            const response = await fetch(`/api/task/${taskId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.filter((task) => task.id !== taskId)
                );
            } else {
                const errorData = await response.json();
                console.error('Failed to delete task:', errorData.error);
                setError('Failed to delete task.');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            setError('Error deleting task.');
        }
    };

    const handleToggleToday = async (taskId: number): Promise<void> => {
        try {
            await toggleTaskToday(taskId);
            // Refetch data to ensure consistency with all task relationships
            const params = new URLSearchParams(location.search);
            const type = params.get('type') || 'all';
            const tag = params.get('tag');
            const project = params.get('project');
            const priority = params.get('priority');

            let apiPath = `/api/tasks?type=${type}&order_by=${orderBy}`;
            if (tag) apiPath += `&tag=${tag}`;
            if (project) apiPath += `&project=${project}`;
            if (priority) apiPath += `&priority=${priority}`;

            const response = await fetch(apiPath, {
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                setTasks(data.tasks || data);
            }
        } catch (error) {
            console.error('Error toggling task today status:', error);
            setError('Error toggling task today status.');
        }
    };

    const handleSortChange = (order: string) => {
        setOrderBy(order);
        localStorage.setItem('order_by', order);
        const params = new URLSearchParams(location.search);
        params.set('order_by', order);
        navigate(
            {
                pathname: location.pathname,
                search: `?${params.toString()}`,
            },
            { replace: true }
        );
        setDropdownOpen(false);
    };

    // Sort options for tasks
    const sortOptions: SortOption[] = [
        { value: 'due_date:asc', label: t('sort.due_date', 'Due Date') },
        { value: 'name:asc', label: t('sort.name', 'Name') },
        { value: 'priority:desc', label: t('sort.priority', 'Priority') },
        { value: 'status:desc', label: t('sort.status', 'Status') },
        { value: 'created_at:desc', label: t('sort.created_at', 'Created At') },
    ];

    const description = getDescription(query, projects, t, location.pathname);

    const isNewTaskAllowed = () => {
        const type = query.get('type');
        return status !== 'done' && type !== 'upcoming';
    };

    return (
        <div
            className={
                isUpcomingView
                    ? 'w-full px-2 sm:px-4 lg:px-6'
                    : 'flex justify-center px-4 lg:px-2'
            }
        >
            <div
                className={`w-full ${isUpcomingView ? 'max-w-none' : 'max-w-5xl'}`}
            >
                {/* Title row with info button and filters dropdown on the right */}
                <div
                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between ${isUpcomingView ? 'mb-4 sm:mb-6' : 'mb-8'}`}
                >
                    <div className="flex items-center mb-2 sm:mb-0">
                        <h2
                            className={`${isUpcomingView ? 'text-lg sm:text-xl' : 'text-2xl'} font-medium`}
                        >
                            {title}
                        </h2>
                        {tag && (
                            <div className="ml-4 flex items-center space-x-2">
                                <button
                                    className="flex items-center space-x-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600"
                                    onClick={handleRemoveTag}
                                >
                                    <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-300" />
                                    <span className="text-xs text-gray-700 dark:text-gray-300">
                                        {capitalize(tag)}
                                    </span>
                                    <XMarkIcon className="h-4 w-4 text-gray-500 dark:text-gray-300 hover:text-red-500" />
                                </button>
                            </div>
                        )}
                    </div>
                    {/* Info expand/collapse button, search button, show completed toggle, and sort dropdown */}
                    <div
                        className={`flex items-center gap-2 w-full sm:w-auto justify-end mt-2 sm:mt-0 ${isUpcomingView ? 'md:fixed md:right-4 md:top-20 md:px-3 md:py-2 md:z-20' : 'flex-wrap'}`}
                    >
                        <button
                            onClick={() => setIsInfoExpanded((v) => !v)}
                            className={`flex items-center hover:bg-blue-100/50 dark:hover:bg-blue-800/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg${isInfoExpanded ? ' bg-blue-50/70 dark:bg-blue-900/20' : ''} p-2`}
                            aria-expanded={isInfoExpanded}
                            aria-label={
                                isInfoExpanded
                                    ? 'Collapse info panel'
                                    : 'Show tasks information'
                            }
                            title={isInfoExpanded ? 'Hide info' : 'About Tasks'}
                        >
                            <svg
                                className="h-5 w-5 text-blue-500"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                />
                            </svg>
                            <span className="sr-only">
                                {isInfoExpanded ? 'Hide info' : 'About Tasks'}
                            </span>
                        </button>
                        {!isUpcomingView && (
                            <button
                                onClick={() => setIsSearchExpanded((v) => !v)}
                                className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-2 ${
                                    isSearchExpanded
                                        ? 'bg-blue-50/70 dark:bg-blue-900/20'
                                        : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                                aria-expanded={isSearchExpanded}
                                aria-label={
                                    isSearchExpanded
                                        ? 'Collapse search panel'
                                        : 'Show search input'
                                }
                                title={
                                    isSearchExpanded
                                        ? 'Hide search'
                                        : 'Search Tasks'
                                }
                            >
                                <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                                <span className="sr-only">
                                    {isSearchExpanded
                                        ? 'Hide search'
                                        : 'Search Tasks'}
                                </span>
                            </button>
                        )}
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                Show completed
                            </span>
                            <button
                                onClick={() => setShowCompleted((v) => !v)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                    showCompleted
                                        ? 'bg-blue-600'
                                        : 'bg-gray-200 dark:bg-gray-600'
                                }`}
                                aria-pressed={showCompleted}
                                aria-label={
                                    showCompleted
                                        ? 'Hide completed tasks'
                                        : 'Show completed tasks'
                                }
                                title={
                                    showCompleted
                                        ? 'Hide completed tasks'
                                        : 'Show completed tasks'
                                }
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        showCompleted
                                            ? 'translate-x-4'
                                            : 'translate-x-0.5'
                                    }`}
                                />
                            </button>
                        </div>
                        <SortFilter
                            sortOptions={sortOptions}
                            sortValue={orderBy}
                            onSortChange={handleSortChange}
                        />
                    </div>
                </div>

                {/* Info/description section with large info icon, collapsible */}
                <div
                    className={`transition-all duration-300 ease-in-out ${
                        isInfoExpanded
                            ? 'max-h-96 opacity-100 mb-6'
                            : 'max-h-0 opacity-0 mb-0'
                    } overflow-hidden`}
                >
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg px-6 py-5 flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <svg
                                className="h-12 w-12 text-blue-400 opacity-20"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                {description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Search input section, collapsible - hidden in upcoming view */}
                {!isUpcomingView && (
                    <div
                        className={`transition-all duration-300 ease-in-out ${
                            isSearchExpanded
                                ? 'max-h-24 opacity-100 mb-4'
                                : 'max-h-0 opacity-0 mb-0'
                        } overflow-hidden`}
                    >
                        <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-4 py-3">
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                            <input
                                type="text"
                                placeholder={getSearchPlaceholder(
                                    i18n.language
                                )}
                                value={taskSearchQuery}
                                onChange={(e) =>
                                    setTaskSearchQuery(e.target.value)
                                }
                                className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                            />
                        </div>
                    </div>
                )}

                {loading ? (
                    <p>{t('common.loading', 'Loading...')}</p>
                ) : error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <>
                        {/* New Task Form */}
                        {isNewTaskAllowed() && (
                            <div className="mb-1.5">
                                <NewTask
                                    onTaskCreate={async (taskName: string) =>
                                        await handleTaskCreate({
                                            name: taskName,
                                            status: 'not_started',
                                        })
                                    }
                                />
                            </div>
                        )}

                        {displayTasks.length > 0 ||
                        (groupedTasks &&
                            Object.keys(groupedTasks).length > 0) ? (
                            query.get('type') === 'upcoming' ? (
                                <GroupedTaskList
                                    tasks={displayTasks}
                                    groupedTasks={groupedTasks}
                                    onTaskCreate={handleTaskCreate}
                                    onTaskUpdate={handleTaskUpdate}
                                    onTaskCompletionToggle={
                                        handleTaskCompletionToggle
                                    }
                                    onTaskDelete={handleTaskDelete}
                                    projects={projects}
                                    hideProjectName={false}
                                    onToggleToday={undefined} // Don't show "Add to Today" in upcoming view
                                    showCompletedTasks={showCompleted}
                                    searchQuery={taskSearchQuery}
                                />
                            ) : (
                                <TaskList
                                    tasks={displayTasks}
                                    onTaskCreate={handleTaskCreate}
                                    onTaskUpdate={handleTaskUpdate}
                                    onTaskCompletionToggle={
                                        handleTaskCompletionToggle
                                    }
                                    onTaskDelete={handleTaskDelete}
                                    projects={projects}
                                    onToggleToday={handleToggleToday}
                                    showCompletedTasks={showCompleted}
                                />
                            )
                        ) : (
                            <div className="flex justify-center items-center mt-4">
                                <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                                    <svg
                                        className="h-20 w-20 text-gray-400 opacity-30 mb-6"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                                        />
                                    </svg>
                                    <p className="text-2xl font-light text-center text-gray-600 dark:text-gray-300 mb-2">
                                        {t(
                                            'tasks.noTasksAvailable',
                                            'No tasks available.'
                                        )}
                                    </p>
                                    <p className="text-base text-center text-gray-400 dark:text-gray-400">
                                        {t(
                                            'tasks.blankSlateHint',
                                            'Start by creating a new task or changing your filters.'
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default Tasks;
