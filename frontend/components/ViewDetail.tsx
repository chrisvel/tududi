import React, {
    useState,
    useEffect,
    useRef,
    useMemo,
    useCallback,
} from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    TagIcon,
    QueueListIcon,
    StarIcon,
    PencilSquareIcon,
    MagnifyingGlassIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Task } from '../entities/Task';
import { Note } from '../entities/Note';
import { Project, ProjectStatus } from '../entities/Project';
import { updateProject } from '../utils/projectsService';
import TaskList from './Task/TaskList';
import GroupedTaskList from './Task/GroupedTaskList';
import ProjectItem from './Project/ProjectItem';
import ConfirmDialog from './Shared/ConfirmDialog';
import { searchUniversal, resolveViewFilters } from '../utils/searchService';
import { getApiPath } from '../config/paths';
import { SortOption } from './Shared/SortFilterButton';
import IconSortDropdown from './Shared/IconSortDropdown';
import { useStore } from '../store/useStore';
import { getCsrfToken } from '../utils/csrfService';
import { isTaskActive, isTaskCompleted } from '../constants/taskStatus';

interface View {
    id: number;
    uid: string;
    name: string;
    search_query: string | null;
    filters: string[];
    priority: string | null;
    due: string | null;
    defer: string | null;
    tags: string[];
    extras: string[] | null;
    task_status: string | null;
    is_pinned: boolean;
}

const ViewDetail: React.FC = () => {
    const { t } = useTranslation();
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [view, setView] = useState<View | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const doneTaskCount = tasks.filter((task) =>
        [2, 3, 'done', 'archived'].includes(task.status as any)
    ).length;
    const [activeTab, setActiveTab] = useState<'tasks' | 'notes' | 'projects'>(
        'tasks'
    );
    const globalProjects = useStore((state) => state.projectsStore.projects);
    const allTags = useStore((state) => state.tagsStore.tags);
    const getTagColor = (name: string): string | undefined =>
        allTags.find((t) => t.name === name)?.color;
    const updateQueryParams = useCallback(
        (updates: Record<string, string | null>) => {
            const params = new URLSearchParams(location.search);
            let shouldNavigate = false;

            Object.entries(updates).forEach(([key, value]) => {
                if (value === null || value === '') {
                    if (params.has(key)) {
                        params.delete(key);
                        shouldNavigate = true;
                    }
                } else if (params.get(key) !== value) {
                    params.set(key, value);
                    shouldNavigate = true;
                }
            });

            if (shouldNavigate) {
                const searchString = params.toString();
                navigate(
                    {
                        pathname: location.pathname,
                        search: searchString ? `?${searchString}` : '',
                    },
                    { replace: true }
                );
            }
        },
        [location.pathname, location.search, navigate]
    );
    const [isLoading, setIsLoading] = useState(true);
    const tabInitRef = useRef(false);
    useEffect(() => {
        if (isLoading || tabInitRef.current) return;
        tabInitRef.current = true;
        if (tasks.length > 0) return;
        if (notes.length > 0) setActiveTab('notes');
        else if (projects.length > 0) setActiveTab('projects');
    }, [isLoading, tasks.length, notes.length, projects.length]);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    // Search, filter, and sort state
    const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [taskStatusFilter, setTaskStatusFilter] = useState<
        'all' | 'active' | 'completed'
    >('active');
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');
    const [groupBy, setGroupBy] = useState<'none' | 'project'>('none');

    // Pagination state
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [, setTotalCount] = useState(0);
    const limit = 20;

    // State for ProjectItem and Note components
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
    const [, setProjectToDelete] = useState<Project | null>(null);

    // Ref for dropdown and title edit
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Sort options for tasks
    const sortOptions: SortOption[] = [
        { value: 'due_date:asc', label: t('sort.due_date', 'Due Date') },
        { value: 'name:asc', label: t('sort.name', 'Name') },
        { value: 'priority:desc', label: t('sort.priority', 'Priority') },
        { value: 'status:desc', label: t('sort.status', 'Status') },
        { value: 'created_at:desc', label: t('sort.created_at', 'Created At') },
    ];

    const projectLookupList = useMemo(() => {
        const map = new Map<string, Project>();

        const addProject = (project?: Project | null) => {
            if (!project) return;
            const key =
                (project.uid && `uid-${project.uid}`) ??
                (project.id !== undefined && project.id !== null
                    ? `id-${project.id}`
                    : undefined);
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, project);
            }
        };

        globalProjects.forEach(addProject);
        projects.forEach(addProject);

        return Array.from(map.values());
    }, [globalProjects, projects]);

    const projectLookupMap = useMemo(() => {
        const byId = new Map<number, Project>();
        const byUid = new Map<string, Project>();

        projectLookupList.forEach((project) => {
            if (project.id !== undefined && project.id !== null) {
                const numericId =
                    typeof project.id === 'string'
                        ? Number(project.id)
                        : project.id;
                if (!Number.isNaN(numericId)) {
                    byId.set(numericId, project);
                }
            }
            if (project.uid) {
                byUid.set(project.uid, project);
            }
        });

        return { byId, byUid };
    }, [projectLookupList]);

    // Filter and sort tasks
    const displayTasks = useMemo(() => {
        let filteredTasks: Task[];

        // Filter by completion status, unless the view pins one status
        if (view?.task_status) {
            filteredTasks = tasks;
        } else if (taskStatusFilter === 'completed') {
            filteredTasks = tasks.filter((task: Task) =>
                isTaskCompleted(task.status)
            );
        } else if (taskStatusFilter === 'active') {
            filteredTasks = tasks.filter((task: Task) =>
                isTaskActive(task.status)
            );
        } else {
            // taskStatusFilter === 'all'
            filteredTasks = tasks;
        }

        // Filter by search query
        if (taskSearchQuery.trim()) {
            const query = taskSearchQuery.toLowerCase();
            filteredTasks = filteredTasks.filter(
                (task: Task) =>
                    task.name.toLowerCase().includes(query) ||
                    task.original_name?.toLowerCase().includes(query) ||
                    task.note?.toLowerCase().includes(query)
            );
        }

        // Sort tasks
        const sortedTasks = [...filteredTasks].sort((a, b) => {
            const [field, direction] = orderBy.split(':');
            const isAsc = direction === 'asc';

            let valueA, valueB;

            switch (field) {
                case 'name':
                    valueA = a.name?.toLowerCase() || '';
                    valueB = b.name?.toLowerCase() || '';
                    break;
                case 'due_date':
                    valueA = a.due_date ? new Date(a.due_date).getTime() : 0;
                    valueB = b.due_date ? new Date(b.due_date).getTime() : 0;
                    break;
                case 'priority': {
                    const priorityMap = { high: 2, medium: 1, low: 0 };
                    valueA =
                        typeof a.priority === 'string'
                            ? priorityMap[a.priority] || 0
                            : a.priority || 0;
                    valueB =
                        typeof b.priority === 'string'
                            ? priorityMap[b.priority] || 0
                            : b.priority || 0;
                    break;
                }
                case 'status':
                    valueA =
                        typeof a.status === 'string' ? a.status : a.status || 0;
                    valueB =
                        typeof b.status === 'string' ? b.status : b.status || 0;
                    break;
                case 'created_at':
                default:
                    valueA = a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    valueB = b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;
                    break;
            }

            if (valueA < valueB) return isAsc ? -1 : 1;
            if (valueA > valueB) return isAsc ? 1 : -1;
            return 0;
        });

        return sortedTasks.map((task) => {
            if (task.Project) {
                return task;
            }

            let matchedProject: Project | undefined;
            if (task.project_uid) {
                matchedProject = projectLookupMap.byUid.get(task.project_uid);
            }
            if (
                !matchedProject &&
                task.project_id !== undefined &&
                task.project_id !== null
            ) {
                matchedProject = projectLookupMap.byId.get(task.project_id);
            }

            return matchedProject
                ? {
                      ...task,
                      Project: matchedProject,
                  }
                : task;
        });
    }, [
        tasks,
        taskStatusFilter,
        view?.task_status,
        taskSearchQuery,
        orderBy,
        t,
        projectLookupMap,
    ]);

    const handleSortChange = useCallback(
        (newOrderBy: string, options?: { skipUrlUpdate?: boolean }) => {
            setOrderBy(newOrderBy);
            if (!options?.skipUrlUpdate) {
                updateQueryParams({
                    order_by:
                        newOrderBy === 'created_at:desc' ? null : newOrderBy,
                });
            }
        },
        [updateQueryParams]
    );

    const handleStatusChange = useCallback(
        (
            status: 'all' | 'active' | 'completed',
            options?: { skipUrlUpdate?: boolean }
        ) => {
            setTaskStatusFilter(status);
            if (!options?.skipUrlUpdate) {
                updateQueryParams({
                    status: status === 'active' ? null : status,
                });
            }
        },
        [updateQueryParams]
    );

    const handleGroupByChange = useCallback(
        (value: 'none' | 'project', options?: { skipUrlUpdate?: boolean }) => {
            setGroupBy(value);
            if (uid) {
                localStorage.setItem(`view_${uid}_group_by`, value);
            }
            if (!options?.skipUrlUpdate) {
                updateQueryParams({
                    group_by: value === 'none' ? null : value,
                });
            }
        },
        [uid, updateQueryParams]
    );

    const handleSearchChange = useCallback(
        (value: string, options?: { skipUrlUpdate?: boolean }) => {
            setTaskSearchQuery(value);
            if (!options?.skipUrlUpdate) {
                updateQueryParams({
                    search: value.trim() ? value : null,
                });
            }
        },
        [updateQueryParams]
    );

    const showCompletedTasks =
        !!view?.task_status || taskStatusFilter !== 'active';

    useEffect(() => {
        fetchViewAndResults();
    }, [uid, taskStatusFilter]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const urlOrderBy = params.get('order_by') || 'created_at:desc';
        handleSortChange(urlOrderBy, { skipUrlUpdate: true });

        const urlStatus = params.get('status');
        const normalizedStatus =
            urlStatus === 'completed'
                ? 'completed'
                : urlStatus === 'all'
                  ? 'all'
                  : 'active';
        handleStatusChange(normalizedStatus, { skipUrlUpdate: true });

        const urlGroup =
            params.get('group_by') === 'project' ? 'project' : 'none';
        setGroupBy((prev) => {
            if (prev !== urlGroup) {
                if (uid) {
                    localStorage.setItem(`view_${uid}_group_by`, urlGroup);
                }
                return urlGroup;
            }
            return prev;
        });

        const urlSearch = params.get('search') || '';
        if (urlSearch) {
            setIsSearchExpanded(true);
        }
        handleSearchChange(urlSearch, { skipUrlUpdate: true });
    }, [
        location.search,
        uid,
        handleSortChange,
        handleStatusChange,
        handleSearchChange,
    ]);

    // Save title when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                titleInputRef.current &&
                !titleInputRef.current.contains(event.target as Node)
            ) {
                handleSaveName();
            }
        };

        if (isEditingName) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [isEditingName, editedName]);

    const fetchViewAndResults = async (resetPagination = true) => {
        if (!uid) return;

        try {
            // Fetch view details
            const viewResponse = await fetch(getApiPath(`views/${uid}`), {
                credentials: 'include',
            });
            if (!viewResponse.ok) {
                navigate('/views');
                return;
            }
            const viewData = await viewResponse.json();
            const normalizedView: View = {
                ...viewData,
                tags: viewData.tags || [],
                extras: viewData.extras || [],
                defer: viewData.defer || null,
                task_status: viewData.task_status || null,
            };
            setView(normalizedView);

            const currentOffset = resetPagination ? 0 : offset;

            // Fetch search results with pagination and exclude subtasks
            const response = await searchUniversal({
                query: normalizedView.search_query || '',
                filters: resolveViewFilters(normalizedView.filters),
                priority: normalizedView.priority || undefined,
                taskStatus: normalizedView.task_status || undefined,
                due: normalizedView.due || undefined,
                defer: normalizedView.defer || undefined,
                tags:
                    normalizedView.tags && normalizedView.tags.length > 0
                        ? normalizedView.tags
                        : undefined,
                extras:
                    normalizedView.extras && normalizedView.extras.length > 0
                        ? normalizedView.extras
                        : undefined,
                limit: limit,
                offset: currentOffset,
                excludeSubtasks: true,
                status: taskStatusFilter,
            });

            // Separate results by type
            const taskResults: Task[] = [];
            const noteResults: Note[] = [];
            const projectResults: Project[] = [];

            response.results.forEach((result) => {
                if (result.type === 'Task') {
                    taskResults.push(result as any);
                } else if (result.type === 'Note') {
                    noteResults.push(result as any);
                } else if (result.type === 'Project') {
                    projectResults.push(result as any);
                }
            });

            if (resetPagination) {
                setTasks(taskResults);
                setNotes(noteResults);
                setProjects(projectResults);
                setOffset(limit);
            } else {
                setTasks((prev) => [...prev, ...taskResults]);
                setNotes((prev) => [...prev, ...noteResults]);
                setProjects((prev) => [...prev, ...projectResults]);
                setOffset((prev) => prev + limit);
            }

            setHasMore(response.pagination?.hasMore || false);
            if (response.pagination) {
                setTotalCount(response.pagination.total);
            }
        } catch (error) {
            console.error('Error fetching view:', error);
            navigate('/views');
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    };

    const loadMore = async () => {
        if (!hasMore || isLoadingMore) return;
        setIsLoadingMore(true);
        await fetchViewAndResults(false);
    };

    // Task handlers
    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            const response = await fetch(
                getApiPath(`task/${updatedTask.uid}`),
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-csrf-token': await getCsrfToken(),
                    },
                    body: JSON.stringify(updatedTask),
                }
            );

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.map((task) =>
                        task.id === updatedTask.id ? updatedTask : task
                    )
                );
            }
        } catch (error) {
            console.error('Error updating task:', error);
        }
    };

    const handleTaskDelete = async (taskUid: string) => {
        try {
            const response = await fetch(
                getApiPath(`task/${encodeURIComponent(taskUid)}`),
                {
                    method: 'DELETE',
                    headers: {
                        'x-csrf-token': await getCsrfToken(),
                    },
                }
            );

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.filter((task) => task.uid !== taskUid)
                );
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleTaskCompletionToggle = (updatedTask: Task) => {
        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task
            )
        );
    };

    const getCompletionPercentage = (project: Project) => {
        return (project as any).completion_percentage || 0;
    };

    const handleEditProject = (project: Project) => {
        if (project.uid) {
            const slug = project.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            navigate(`/project/${project.uid}-${slug}/edit`);
        } else {
            navigate(`/project/${project.id}/edit`);
        }
    };

    const handleProjectStatusChange = async (
        project: Project,
        newStatus: ProjectStatus
    ) => {
        if (!project.uid) return;
        const prevProjects = projects;
        setProjects(
            projects.map((p) =>
                p.uid === project.uid ? { ...p, status: newStatus } : p
            )
        );
        try {
            await updateProject(project.uid, { status: newStatus });
        } catch {
            setProjects(prevProjects);
        }
    };

    const handleEditName = () => {
        if (view) {
            setEditedName(view.name);
            setIsEditingName(true);
        }
    };

    const handleSaveName = async () => {
        if (!view || !editedName.trim()) return;

        try {
            const response = await fetch(getApiPath(`views/${view.uid}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: editedName.trim(),
                }),
            });

            if (response.ok) {
                setView({ ...view, name: editedName.trim() });
                setIsEditingName(false);
                window.dispatchEvent(new CustomEvent('viewUpdated'));
            }
        } catch (error) {
            console.error('Error updating view name:', error);
        }
    };

    const handleCancelEdit = () => {
        setIsEditingName(false);
        setEditedName('');
    };

    const togglePin = async () => {
        if (!view) return;

        try {
            const response = await fetch(getApiPath(`views/${view.uid}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-csrf-token': await getCsrfToken(),
                },
                credentials: 'include',
                body: JSON.stringify({
                    is_pinned: !view.is_pinned,
                }),
            });

            if (response.ok) {
                setView({ ...view, is_pinned: !view.is_pinned });
                window.dispatchEvent(new CustomEvent('viewUpdated'));
            }
        } catch (error) {
            console.error('Error toggling pin:', error);
        }
    };

    const handleDeleteView = async () => {
        if (!view) return;

        try {
            const response = await fetch(getApiPath(`views/${view.uid}`), {
                method: 'DELETE',
                credentials: 'include',
                headers: {
                    'x-csrf-token': await getCsrfToken(),
                },
            });

            if (response.ok) {
                window.dispatchEvent(new CustomEvent('viewUpdated'));
                navigate('/views');
            }
        } catch (error) {
            console.error('Error deleting view:', error);
        } finally {
            setIsConfirmDialogOpen(false);
        }
    };

    const openConfirmDialog = () => {
        setIsConfirmDialogOpen(true);
    };

    const closeConfirmDialog = () => {
        setIsConfirmDialogOpen(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    Loading view...
                </div>
            </div>
        );
    }

    if (!view) {
        return null;
    }

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-12">
            <div className="w-full">
                {/* View header, same card as the other detail pages */}
                <div className="mb-6 space-y-3">
                    <div
                        className="space-y-5 rounded-2xl bg-white p-5 sm:p-6 dark:bg-gray-900"
                        style={{
                            backgroundImage:
                                'linear-gradient(color-mix(in srgb, #6b7280 10%, transparent), color-mix(in srgb, #6b7280 10%, transparent))',
                        }}
                    >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-white text-gray-500 shadow-sm ring-4 ring-white dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-900">
                                <QueueListIcon className="h-7 w-7" />
                            </span>
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                        {t('views.view', 'View')}
                                    </span>
                                    <span>
                                        {tasks.length}{' '}
                                        {t('tasks.title', 'tasks')}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {notes.length}{' '}
                                        {t('notes.title', 'notes')}
                                    </span>
                                    <span>·</span>
                                    <span>
                                        {projects.length}{' '}
                                        {t('projects.title', 'projects')}
                                    </span>
                                </div>
                                {isEditingName ? (
                                    <input
                                        ref={titleInputRef}
                                        type="text"
                                        value={editedName}
                                        onChange={(e) =>
                                            setEditedName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter')
                                                handleSaveName();
                                            else if (e.key === 'Escape')
                                                handleCancelEdit();
                                        }}
                                        className="text-xl font-semibold sm:text-2xl text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <h1
                                        onClick={handleEditName}
                                        className="text-xl font-semibold leading-tight sm:text-2xl text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                    >
                                        {view.name}
                                    </h1>
                                )}
                                {/* Filter chips */}
                                {(view.tags.length > 0 ||
                                    view.filters.length > 0 ||
                                    view.search_query ||
                                    view.priority ||
                                    view.task_status ||
                                    view.due ||
                                    view.defer ||
                                    (view.extras &&
                                        view.extras.length > 0)) && (
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {view.tags.map((tag) => {
                                            const color = getTagColor(tag);
                                            return (
                                                <span
                                                    key={tag}
                                                    className={
                                                        color
                                                            ? 'px-2 py-0.5 rounded text-xs font-medium text-white'
                                                            : 'px-2 py-0.5 bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 rounded text-xs font-medium'
                                                    }
                                                    style={
                                                        color
                                                            ? {
                                                                  backgroundColor:
                                                                      color,
                                                              }
                                                            : undefined
                                                    }
                                                >
                                                    {tag}
                                                </span>
                                            );
                                        })}
                                        {view.search_query && (
                                            <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-medium">
                                                &quot;{view.search_query}&quot;
                                            </span>
                                        )}
                                        {view.priority && (
                                            <span className="px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded text-xs font-medium capitalize">
                                                {view.priority}
                                            </span>
                                        )}
                                        {view.task_status && (
                                            <span className="px-2 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 rounded text-xs font-medium">
                                                {t(
                                                    `task.status.${view.task_status.replace(/_(\w)/g, (_, c) => c.toUpperCase())}`
                                                )}
                                            </span>
                                        )}
                                        {view.due && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs font-medium capitalize">
                                                {view.due.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        {view.defer && (
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded text-xs font-medium capitalize">
                                                {view.defer.replace(/_/g, ' ')}
                                            </span>
                                        )}
                                        {view.filters.map((filter) => (
                                            <span
                                                key={filter}
                                                className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium"
                                            >
                                                {filter}
                                            </span>
                                        ))}
                                        {view.extras &&
                                            view.extras.map((extra, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded text-xs font-medium capitalize"
                                                >
                                                    {extra.replace(/_/g, ' ')}
                                                </span>
                                            ))}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsSearchExpanded((v) => !v)
                                    }
                                    aria-expanded={isSearchExpanded}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    <MagnifyingGlassIcon className="h-4 w-4" />
                                    {t('common.search', 'Search')}
                                </button>
                                <button
                                    type="button"
                                    onClick={togglePin}
                                    aria-pressed={!!view.is_pinned}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    {view.is_pinned ? (
                                        <StarIconSolid className="h-4 w-4 text-yellow-400" />
                                    ) : (
                                        <StarIcon className="h-4 w-4" />
                                    )}
                                    {view.is_pinned
                                        ? t('project.pinned', 'Pinned')
                                        : t('project.pin', 'Pin')}
                                </button>
                                <button
                                    type="button"
                                    onClick={openConfirmDialog}
                                    title={t('views.deleteView')}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                    <TrashIcon className="h-4 w-4" />
                                    {t('common.delete', 'Delete')}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-baseline justify-between gap-3 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                <span>
                                    {t(
                                        'views.progressSummary',
                                        'View progress · {{done}} of {{total}} tasks done',
                                        {
                                            done: doneTaskCount,
                                            total: tasks.length,
                                        }
                                    )}
                                </span>
                                <span className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                                    {tasks.length > 0
                                        ? Math.round(
                                              (doneTaskCount / tasks.length) *
                                                  100
                                          )
                                        : 0}
                                    <span className="ml-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                                        %
                                    </span>
                                </span>
                            </div>
                            <div
                                className="relative h-1.5 rounded-full"
                                style={{
                                    backgroundColor:
                                        'color-mix(in srgb, #6b7280 20%, transparent)',
                                }}
                            >
                                <div
                                    className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-all duration-300"
                                    style={{
                                        width: `${tasks.length > 0 ? Math.round((doneTaskCount / tasks.length) * 100) : 0}%`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Search input section, collapsible */}
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
                            placeholder={t(
                                'tasks.searchPlaceholder',
                                'Search tasks...'
                            )}
                            value={taskSearchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-4">
                    <div className="flex items-center min-h-[2.5rem]">
                        <div className="flex items-center gap-4 sm:gap-6 self-stretch pl-2 sm:pl-3">
                            {(
                                [
                                    [
                                        'tasks',
                                        t('tasks.title', 'Tasks'),
                                        tasks.length,
                                    ],
                                    [
                                        'notes',
                                        t('notes.title', 'Notes'),
                                        notes.length,
                                    ],
                                    [
                                        'projects',
                                        t('projects.title', 'Projects'),
                                        projects.length,
                                    ],
                                ] as const
                            ).map(([tab, label, count]) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`relative flex items-center self-stretch py-2.5 text-sm font-medium transition-colors ${
                                        activeTab === tab
                                            ? 'text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-px after:right-px after:h-0.5 after:rounded-full after:bg-gray-900 dark:after:bg-gray-100'
                                            : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                                    }`}
                                    aria-pressed={activeTab === tab}
                                >
                                    {label} ({count})
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tasks Section */}
                {activeTab === 'tasks' && (
                    <>
                        <div className="mb-4 flex items-center justify-end">
                            <IconSortDropdown
                                options={sortOptions}
                                value={orderBy}
                                onChange={handleSortChange}
                                ariaLabel={t('views.sortTasks', 'Sort tasks')}
                                title={t('views.sortTasks', 'Sort tasks')}
                                dropdownLabel={t('tasks.sortBy', 'Sort by')}
                                footerContent={
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
                                                            onClick={() =>
                                                                handleGroupByChange(
                                                                    val as
                                                                        | 'none'
                                                                        | 'project'
                                                                )
                                                            }
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
                                        {!view.task_status && (
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
                                                            taskStatusFilter ===
                                                            opt.key;
                                                        return (
                                                            <button
                                                                key={opt.key}
                                                                type="button"
                                                                onClick={() =>
                                                                    handleStatusChange(
                                                                        opt.key as
                                                                            | 'all'
                                                                            | 'active'
                                                                            | 'completed'
                                                                    )
                                                                }
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
                                        )}
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
                                                                handleSortChange(
                                                                    `${field}:${dir.key}`
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
                                }
                            />
                        </div>
                        {displayTasks.length > 0 && (
                            <div className="mb-8">
                                {groupBy === 'project' ? (
                                    <GroupedTaskList
                                        tasks={displayTasks}
                                        groupBy="project"
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskCompletionToggle={
                                            handleTaskCompletionToggle
                                        }
                                        onTaskDelete={handleTaskDelete}
                                        projects={projectLookupList}
                                        hideProjectName={false}
                                        onToggleToday={undefined}
                                        showCompletedTasks={showCompletedTasks}
                                        searchQuery={taskSearchQuery}
                                    />
                                ) : (
                                    <TaskList
                                        tasks={displayTasks}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskCompletionToggle={
                                            handleTaskCompletionToggle
                                        }
                                        onTaskDelete={handleTaskDelete}
                                        projects={projectLookupList}
                                        hideProjectName={false}
                                        onToggleToday={undefined}
                                        showCompletedTasks={showCompletedTasks}
                                    />
                                )}
                                {/* Load more button */}
                                {hasMore && (
                                    <div className="flex justify-center pt-4">
                                        <button
                                            onClick={loadMore}
                                            disabled={isLoadingMore}
                                            className="inline-flex items-center px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                    </div>
                                )}

                                {/* Pagination info */}
                                {displayTasks.length > 0 && (
                                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-2 pb-4">
                                        {t(
                                            'tasks.showingItems',
                                            'Showing {{current}} of {{total}} tasks',
                                            {
                                                current: displayTasks.length,
                                                total: tasks.length,
                                            }
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Notes Section */}
                {activeTab === 'notes' && (
                    <>
                        {notes.length > 0 && (
                            <div className="mb-8">
                                <ul className="space-y-1">
                                    {notes.map((note) => (
                                        <li
                                            key={note.uid}
                                            className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-3 flex justify-between items-center"
                                            onMouseEnter={() =>
                                                setHoveredNoteId(
                                                    note.uid || null
                                                )
                                            }
                                            onMouseLeave={() =>
                                                setHoveredNoteId(null)
                                            }
                                        >
                                            <div className="flex-grow overflow-hidden pr-4">
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <Link
                                                        to={
                                                            note.uid
                                                                ? `/note/${note.uid}-${note.title
                                                                      .toLowerCase()
                                                                      .replace(
                                                                          /[^a-z0-9]+/g,
                                                                          '-'
                                                                      )
                                                                      .replace(
                                                                          /^-|-$/g,
                                                                          ''
                                                                      )}`
                                                                : note.uid
                                                                  ? `/note/${note.uid}`
                                                                  : '#'
                                                        }
                                                        className="text-md font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                                                    >
                                                        {note.title}
                                                    </Link>
                                                    {/* Tags */}
                                                    {((note.tags &&
                                                        note.tags.length > 0) ||
                                                        (note.Tags &&
                                                            note.Tags.length >
                                                                0)) && (
                                                        <>
                                                            {(
                                                                note.tags ||
                                                                note.Tags ||
                                                                []
                                                            ).map((noteTag) => (
                                                                <button
                                                                    key={
                                                                        noteTag.id
                                                                    }
                                                                    onClick={(
                                                                        e
                                                                    ) => {
                                                                        e.preventDefault();
                                                                        navigate(
                                                                            `/tag/${encodeURIComponent(noteTag.name)}`
                                                                        );
                                                                    }}
                                                                    className="flex items-center space-x-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                                >
                                                                    <TagIcon className="h-3 w-3 text-gray-500 dark:text-gray-300" />
                                                                    <span className="text-gray-700 dark:text-gray-300">
                                                                        {
                                                                            noteTag.name
                                                                        }
                                                                    </span>
                                                                </button>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={
                                                        () => {} // Edit functionality not implemented yet
                                                    }
                                                    className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${hoveredNoteId === note.uid ? 'opacity-100' : 'opacity-0'}`}
                                                    aria-label={`Edit ${note.title}`}
                                                    title={`Edit ${note.title}`}
                                                >
                                                    <PencilSquareIcon className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={
                                                        () => {} // Delete functionality not implemented yet
                                                    }
                                                    className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${hoveredNoteId === note.uid ? 'opacity-100' : 'opacity-0'}`}
                                                    aria-label={`Delete ${note.title}`}
                                                    title={`Delete ${note.title}`}
                                                >
                                                    <TrashIcon className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )}

                {/* Projects Section */}
                {activeTab === 'projects' && (
                    <>
                        {projects.length > 0 && (
                            <div className="mb-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {projects.map((project) => {
                                        return (
                                            <ProjectItem
                                                key={project.id}
                                                project={project}
                                                viewMode="cards"
                                                getCompletionPercentage={() =>
                                                    getCompletionPercentage(
                                                        project
                                                    )
                                                }
                                                activeDropdown={activeDropdown}
                                                setActiveDropdown={
                                                    setActiveDropdown
                                                }
                                                handleEditProject={
                                                    handleEditProject
                                                }
                                                setProjectToDelete={
                                                    setProjectToDelete
                                                }
                                                setIsConfirmDialogOpen={() => {}}
                                                onOpenShare={() => {
                                                    /* noop in view detail */
                                                }}
                                                onStatusChange={
                                                    handleProjectStatusChange
                                                }
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Empty State */}
                {displayTasks.length === 0 &&
                    notes.length === 0 &&
                    projects.length === 0 && (
                        <div className="text-center py-8">
                            <QueueListIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400 text-lg">
                                {taskSearchQuery.trim()
                                    ? t(
                                          'tasks.noTasksAvailable',
                                          'No tasks available.'
                                      )
                                    : 'No items found matching the view criteria'}
                            </p>
                        </div>
                    )}

                {/* Confirm Delete Dialog */}
                {isConfirmDialogOpen && (
                    <ConfirmDialog
                        title={t('views.deleteView')}
                        message={t('views.confirmDelete', {
                            viewName: view.name,
                        })}
                        onConfirm={handleDeleteView}
                        onCancel={closeConfirmDialog}
                    />
                )}
            </div>
        </div>
    );
};

export default ViewDetail;
