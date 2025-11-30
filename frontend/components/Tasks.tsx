import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSidebar } from '../contexts/SidebarContext';
import TaskList from './Task/TaskList';
import GroupedTaskList from './Task/GroupedTaskList';
import NewTask from './Task/NewTask';
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
import IconSortDropdown from './Shared/IconSortDropdown';
import { TagIcon, XMarkIcon } from '@heroicons/react/24/solid';
import {
    QueueListIcon,
    InformationCircleIcon,
    MagnifyingGlassIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { getApiPath } from '../config/paths';

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
    const [groupBy, setGroupBy] = useState<'none' | 'project'>('none');

    // Pagination state
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const DEFAULT_LIMIT = 20;
    const [limit, setLimit] = useState(DEFAULT_LIMIT);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const location = useLocation();
    const navigate = useNavigate();

    const query = new URLSearchParams(location.search);
    const isUpcomingView =
        query.get('type') === 'upcoming' || location.pathname === '/upcoming';
    const status = query.get('status');
    const tag = query.get('tag');

    // Sync showCompleted state with status URL parameter (skip for upcoming view)
    useEffect(() => {
        if (isUpcomingView) return; // Don't apply status filtering in upcoming view

        if (status === 'completed') {
            setShowCompleted(true);
        } else if (status === 'active') {
            setShowCompleted(false);
        } else if (status === null) {
            // When status is null, we show "All" (both completed and active)
            setShowCompleted(true);
        }
    }, [status, isUpcomingView]);

    // Filter tasks based on completion status and search query
    const displayTasks = useMemo(() => {
        let filteredTasks: Task[] = tasks;

        // Status-based filtering
        if (status === 'completed') {
            // Show only completed tasks
            filteredTasks = filteredTasks.filter((task: Task) => {
                const isCompleted =
                    task.status === 'done' ||
                    task.status === 'archived' ||
                    task.status === 2 ||
                    task.status === 3;
                return isCompleted;
            });
        } else if (status === 'active') {
            // Show only active (not completed) tasks
            filteredTasks = filteredTasks.filter((task: Task) => {
                const isCompleted =
                    task.status === 'done' ||
                    task.status === 'archived' ||
                    task.status === 2 ||
                    task.status === 3;
                return !isCompleted;
            });
        }
        // When status is null, show all tasks (no filtering)

        // Then filter by search query if provided (skip for upcoming view)
        if (taskSearchQuery.trim() && !isUpcomingView) {
            const queryLower = taskSearchQuery.toLowerCase();
            filteredTasks = filteredTasks.filter(
                (task: Task) =>
                    task.name.toLowerCase().includes(queryLower) ||
                    task.original_name?.toLowerCase().includes(queryLower) ||
                    task.note?.toLowerCase().includes(queryLower)
            );
        }

        return filteredTasks;
    }, [tasks, showCompleted, status, taskSearchQuery, isUpcomingView]);

    // Handle the /upcoming route by setting type=upcoming in query params
    if (location.pathname === '/upcoming' && !query.get('type')) {
        query.set('type', 'upcoming');
    }

    const { title: stateTitle } = location.state || {};

    const title =
        stateTitle ||
        getTitleAndIcon(query, projects, t, location.pathname).title;

    useEffect(() => {
        const savedOrderBy =
            localStorage.getItem('order_by') || 'created_at:desc';
        setOrderBy(savedOrderBy);
        const savedGroupBy =
            (localStorage.getItem('tasks_group_by') as 'none' | 'project') ||
            'none';
        setGroupBy(savedGroupBy);

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

    const fetchData = async (
        resetPagination = true,
        options?: {
            limitOverride?: number;
            forceOffset?: number;
            disableHasMore?: boolean;
            disablePagination?: boolean;
        }
    ) => {
        setLoading(resetPagination);
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

            // Add pagination parameters (skip when explicitly disabled or for upcoming view)
            if (!options?.disablePagination && type !== 'upcoming') {
                const currentOffset =
                    options?.forceOffset !== undefined
                        ? options.forceOffset
                        : resetPagination
                          ? 0
                          : offset;
                const limitToUse = options?.limitOverride ?? limit;
                allTasksUrl.set('limit', limitToUse.toString());
                allTasksUrl.set('offset', currentOffset.toString());
            }

            const searchParams = allTasksUrl.toString();

            const tasksResponse = await fetch(
                getApiPath(
                    `tasks?${searchParams}${tagId ? `&tag=${tagId}` : ''}`
                )
            );

            if (tasksResponse.ok) {
                const tasksData = await tasksResponse.json();

                if (resetPagination) {
                    setTasks(tasksData.tasks || []);
                    setGroupedTasks(tasksData.groupedTasks || null);
                    if (!options?.disablePagination) {
                        const limitToUse = options?.limitOverride ?? limit;
                        setOffset(limitToUse);
                    }
                } else {
                    setTasks((prev) => [...prev, ...(tasksData.tasks || [])]);
                    // For grouped tasks, merge them
                    if (tasksData.groupedTasks) {
                        setGroupedTasks((prev) => {
                            if (!prev) return tasksData.groupedTasks;
                            return {
                                ...prev,
                                ...tasksData.groupedTasks,
                            };
                        });
                    }
                    if (!options?.disablePagination) {
                        const limitToUse = options?.limitOverride ?? limit;
                        setOffset((prev) => prev + limitToUse);
                    }
                }

                setHasMore(
                    options?.disableHasMore ||
                        options?.disablePagination ||
                        type === 'upcoming'
                        ? false
                        : tasksData.pagination?.hasMore || false
                );
                if (tasksData.pagination) {
                    setTotalCount(tasksData.pagination.total);
                } else if (options?.disablePagination || type === 'upcoming') {
                    setTotalCount(tasksData.tasks?.length || 0);
                }
            } else {
                throw new Error('Failed to fetch tasks.');
            }

            // Projects are now loaded by Layout component into global store
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setLoading(false);
            setIsLoadingMore(false);
        }
    };

    const loadMore = async (all: boolean) => {
        if (isLoadingMore) return;
        if (!hasMore && !all) return;
        setIsLoadingMore(true);
        const shouldDisablePagination =
            !isUpcomingView && groupBy === 'project';
        if (all || shouldDisablePagination) {
            const newLimit = totalCount > 0 ? totalCount : 10000;
            await fetchData(true, {
                limitOverride: newLimit,
                forceOffset: 0,
                disableHasMore: true,
                disablePagination: true,
            });
            setLimit(DEFAULT_LIMIT);
            setHasMore(false);
        } else {
            await fetchData(false);
        }
        if (all) {
            setHasMore(false);
        }
    };

    useEffect(() => {
        // Disable pagination for: upcoming view OR when grouping by project
        const shouldDisablePagination = isUpcomingView || groupBy === 'project';
        fetchData(
            true,
            shouldDisablePagination
                ? {
                      disablePagination: true,
                      disableHasMore: true,
                      limitOverride: 10000,
                      forceOffset: 0,
                  }
                : undefined
        );
    }, [location, isSidebarOpen, isMobile, groupBy, isUpcomingView]);

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
            const response = await fetch(getApiPath(`task/${updatedTask.id}`), {
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

    const handleTaskDelete = async (taskUid: string) => {
        try {
            const response = await fetch(
                getApiPath(`task/${encodeURIComponent(taskUid)}`),
                {
                    method: 'DELETE',
                }
            );

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.filter((task) => task.uid !== taskUid)
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

    const handleToggleToday = async (
        taskId: number,
        task?: Task
    ): Promise<void> => {
        try {
            await toggleTaskToday(taskId, task);
            // Refetch data to ensure consistency with all task relationships
            const params = new URLSearchParams(location.search);
            const type = params.get('type') || 'all';
            const tag = params.get('tag');
            const project = params.get('project');
            const priority = params.get('priority');

            let apiPath = `tasks?type=${type}&order_by=${orderBy}`;
            if (tag) apiPath += `&tag=${tag}`;
            if (project) apiPath += `&project=${project}`;
            if (priority) apiPath += `&priority=${priority}`;

            const response = await fetch(getApiPath(apiPath), {
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
            className={`w-full pt-4 pb-8 ${isUpcomingView ? 'pl-2 sm:pl-4' : 'px-2 sm:px-4 lg:px-6'}`}
        >
            <div
                className={`w-full ${isUpcomingView ? '' : 'max-w-5xl mx-auto'}`}
            >
                {/* Title row with info button and filters dropdown on the right */}
                <div
                    className={`flex items-center justify-between gap-2 min-w-0 ${
                        isUpcomingView ? 'mb-4 sm:mb-6' : 'mb-8'
                    }`}
                >
                    <div className="flex items-center flex-1 min-w-0 gap-2">
                        <h2
                            className={`${isUpcomingView ? 'text-lg sm:text-xl' : 'text-2xl'} font-light truncate`}
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
                        className={`flex items-center gap-2 flex-shrink-0 ${
                            isUpcomingView
                                ? 'md:fixed md:right-4 md:top-20 md:px-3 md:py-2 md:z-20'
                                : ''
                        }`}
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
                            <InformationCircleIcon className="h-5 w-5 text-blue-500" />
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
                        <IconSortDropdown
                            options={sortOptions}
                            value={orderBy}
                            onChange={handleSortChange}
                            ariaLabel={t('tasks.sortTasks', 'Sort tasks')}
                            title={t('tasks.sortTasks', 'Sort tasks')}
                            dropdownLabel={t('tasks.sortBy', 'Sort by')}
                            align="right"
                            footerContent={
                                !isUpcomingView && (
                                    <div className="space-y-3">
                                        <div>
                                            <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                                {t('tasks.groupBy', 'Group by')}
                                            </div>
                                            <div className="py-1">
                                                {['none', 'project'].map(
                                                    (val) => (
                                                        <button
                                                            key={val}
                                                            onClick={() => {
                                                                setGroupBy(
                                                                    val as
                                                                        | 'none'
                                                                        | 'project'
                                                                );
                                                                localStorage.setItem(
                                                                    'tasks_group_by',
                                                                    val
                                                                );
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                                                groupBy === val
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            <span>
                                                                {val ===
                                                                'project'
                                                                    ? t(
                                                                          'tasks.groupByProject',
                                                                          'Project'
                                                                      )
                                                                    : t(
                                                                          'tasks.grouping.none',
                                                                          'None'
                                                                      )}
                                                            </span>
                                                            {groupBy ===
                                                                val && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-t border-b border-gray-200 dark:border-gray-700">
                                                {t('tasks.show', 'Show')}
                                            </div>
                                            <div className="py-1 space-y-1">
                                                {[
                                                    {
                                                        key: 'active',
                                                        label: t(
                                                            'tasks.open',
                                                            'Open'
                                                        ),
                                                    },
                                                    {
                                                        key: 'all',
                                                        label: t(
                                                            'tasks.all',
                                                            'All'
                                                        ),
                                                    },
                                                    {
                                                        key: 'completed',
                                                        label: t(
                                                            'tasks.completed',
                                                            'Completed'
                                                        ),
                                                    },
                                                ].map((opt) => {
                                                    const isActive =
                                                        (opt.key === 'all' &&
                                                            status === null) ||
                                                        (opt.key ===
                                                            'completed' &&
                                                            status ===
                                                                'completed') ||
                                                        (opt.key === 'active' &&
                                                            status ===
                                                                'active');
                                                    return (
                                                        <button
                                                            key={opt.key}
                                                            type="button"
                                                            onClick={() => {
                                                                if (
                                                                    opt.key ===
                                                                    'completed'
                                                                ) {
                                                                    const params =
                                                                        new URLSearchParams(
                                                                            location.search
                                                                        );
                                                                    params.set(
                                                                        'status',
                                                                        'completed'
                                                                    );
                                                                    navigate(
                                                                        {
                                                                            pathname:
                                                                                location.pathname,
                                                                            search: `?${params.toString()}`,
                                                                        },
                                                                        {
                                                                            replace: true,
                                                                        }
                                                                    );
                                                                } else if (
                                                                    opt.key ===
                                                                    'all'
                                                                ) {
                                                                    const params =
                                                                        new URLSearchParams(
                                                                            location.search
                                                                        );
                                                                    params.delete(
                                                                        'status'
                                                                    );
                                                                    navigate(
                                                                        {
                                                                            pathname:
                                                                                location.pathname,
                                                                            search: `?${params.toString()}`,
                                                                        },
                                                                        {
                                                                            replace: true,
                                                                        }
                                                                    );
                                                                } else {
                                                                    // active (not completed)
                                                                    const params =
                                                                        new URLSearchParams(
                                                                            location.search
                                                                        );
                                                                    params.set(
                                                                        'status',
                                                                        'active'
                                                                    );
                                                                    navigate(
                                                                        {
                                                                            pathname:
                                                                                location.pathname,
                                                                            search: `?${params.toString()}`,
                                                                        },
                                                                        {
                                                                            replace: true,
                                                                        }
                                                                    );
                                                                }
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                                                isActive
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            <span>
                                                                {opt.label}
                                                            </span>
                                                            {isActive && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-t border-b border-gray-200 dark:border-gray-700">
                                                {t(
                                                    'tasks.direction',
                                                    'Direction'
                                                )}
                                            </div>
                                            <div className="py-1">
                                                {[
                                                    {
                                                        key: 'asc',
                                                        label: t(
                                                            'tasks.ascending',
                                                            'Ascending'
                                                        ),
                                                    },
                                                    {
                                                        key: 'desc',
                                                        label: t(
                                                            'tasks.descending',
                                                            'Descending'
                                                        ),
                                                    },
                                                ].map((dir) => {
                                                    const currentDirection =
                                                        orderBy.split(':')[1] ||
                                                        'asc';
                                                    const isActive =
                                                        currentDirection ===
                                                        dir.key;
                                                    return (
                                                        <button
                                                            key={dir.key}
                                                            onClick={() => {
                                                                const [field] =
                                                                    orderBy.split(
                                                                        ':'
                                                                    );
                                                                const newOrderBy = `${field}:${dir.key}`;
                                                                handleSortChange(
                                                                    newOrderBy
                                                                );
                                                            }}
                                                            className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                                                isActive
                                                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            <span>
                                                                {dir.label}
                                                            </span>
                                                            {isActive && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )
                            }
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
                            <InformationCircleIcon className="h-12 w-12 text-blue-400 opacity-20" />
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
                            <div className="mb-6">
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
                            <>
                                {query.get('type') === 'upcoming' ? (
                                    <GroupedTaskList
                                        tasks={displayTasks}
                                        groupedTasks={groupedTasks}
                                        groupBy="none"
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
                                ) : groupBy === 'project' ? (
                                    <GroupedTaskList
                                        tasks={displayTasks}
                                        groupedTasks={null}
                                        groupBy="project"
                                        onTaskCreate={handleTaskCreate}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskCompletionToggle={
                                            handleTaskCompletionToggle
                                        }
                                        onTaskDelete={handleTaskDelete}
                                        projects={projects}
                                        hideProjectName={false}
                                        onToggleToday={handleToggleToday}
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
                                )}
                                {/* Load more button - hide in upcoming view */}
                                {!isUpcomingView && hasMore && (
                                    <div className="flex justify-center pt-4 gap-3">
                                        <button
                                            onClick={() => loadMore(false)}
                                            disabled={isLoadingMore}
                                            className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isLoadingMore ? (
                                                <>
                                                    <svg
                                                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        ></circle>
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                        ></path>
                                                    </svg>
                                                    {t(
                                                        'common.loading',
                                                        'Loading...'
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <QueueListIcon className="h-4 w-4 mr-2" />
                                                    {t(
                                                        'common.loadMore',
                                                        'Load More'
                                                    )}
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => loadMore(true)}
                                            disabled={isLoadingMore}
                                            className="inline-flex items-center px-5 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {t('common.showAll', 'Show All')}
                                        </button>
                                    </div>
                                )}

                                {/* Pagination info - hide in upcoming view */}
                                {!isUpcomingView && tasks.length > 0 && (
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                        {t(
                                            'tasks.showingItems',
                                            'Showing {{current}} of {{total}} items',
                                            {
                                                current: tasks.length,
                                                total: totalCount,
                                            }
                                        )}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex justify-center items-center mt-4">
                                <div className="w-full max-w bg-black/2 dark:bg-gray-900/25 rounded-l px-10 py-24 flex flex-col items-center opacity-95">
                                    <InformationCircleIcon className="h-20 w-20 text-gray-400 opacity-30 mb-6" />
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
