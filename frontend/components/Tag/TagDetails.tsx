import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePersistedModal } from '../../hooks/usePersistedModal';
import {
    CheckIcon,
    BookOpenIcon,
    FolderIcon,
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    MagnifyingGlassIcon,
} from '@heroicons/react/24/solid';
import { FolderIcon as FolderOutlineIcon } from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import TaskList from '../Task/TaskList';
import GroupedTaskList from '../Task/GroupedTaskList';
import ProjectItem from '../Project/ProjectItem';
import ProjectShareModal from '../Project/ProjectShareModal';
import TagModal from './TagModal';
import ConfirmDialog from '../Shared/ConfirmDialog';

import { Tag } from '../../entities/Tag';
import { deleteNote as apiDeleteNote } from '../../utils/notesService';
import { useToast } from '../Shared/ToastContext';
import { useStore } from '../../store/useStore';
import { updateTag, deleteTag } from '../../utils/tagsService';
import { getApiPath } from '../../config/paths';
import { SortOption } from '../Shared/SortFilterButton';
import IconSortDropdown from '../Shared/IconSortDropdown';

const TagDetails: React.FC = () => {
    const { t } = useTranslation();
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const [tag, setTag] = useState<Tag | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const allProjects = useStore((state: any) => state.projectsStore.projects);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search, filter, and sort state
    const [taskSearchQuery, setTaskSearchQuery] = useState<string>('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [taskStatusFilter, setTaskStatusFilter] = useState<
        'all' | 'active' | 'completed'
    >('active');
    const [groupBy, setGroupBy] = useState<'none' | 'project'>('none');
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');

    // Filter projects by current tag
    const projects = allProjects.filter(
        (project: any) =>
            project.tags &&
            project.tags.some(
                (projectTag: any) => projectTag.name === tag?.name
            )
    );

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

        allProjects.forEach(addProject);
        projects.forEach(addProject);

        return Array.from(map.values());
    }, [allProjects, projects]);

    // State for ProjectItem components
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
    const [, setProjectToDelete] = useState<Project | null>(null);

    // State for tag edit/delete - use persisted modal state that survives component remounts
    const {
        isOpen: isTagModalOpen,
        openModal: openTagModal,
        closeModal: closeTagModal,
    } = usePersistedModal(tag?.id);
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] =
        useState<boolean>(false);

    // State for project sharing
    const [shareModal, setShareModal] = useState<{
        isOpen: boolean;
        project: Project | null;
    }>({ isOpen: false, project: null });

    // State for note deletion
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [isNoteConfirmDialogOpen, setIsNoteConfirmDialogOpen] = useState<boolean>(false);

    const { showSuccessToast, showErrorToast } = useToast();
    const navigate = useNavigate();

    // Sort options for tasks
    const sortOptions: SortOption[] = [
        { value: 'due_date:asc', label: t('sort.due_date', 'Due Date') },
        { value: 'name:asc', label: t('sort.name', 'Name') },
        { value: 'priority:desc', label: t('sort.priority', 'Priority') },
        { value: 'status:desc', label: t('sort.status', 'Status') },
        { value: 'created_at:desc', label: t('sort.created_at', 'Created At') },
    ];

    // Filter and sort tasks
    const displayTasks = useMemo(() => {
        let filteredTasks: Task[];

        // Filter by completion status
        if (taskStatusFilter === 'completed') {
            filteredTasks = tasks.filter(
                (task: Task) =>
                    task.status === 'done' ||
                    task.status === 'archived' ||
                    task.status === 2 ||
                    task.status === 3
            );
        } else if (taskStatusFilter === 'active') {
            filteredTasks = tasks.filter(
                (task: Task) =>
                    task.status !== 'done' &&
                    task.status !== 'archived' &&
                    task.status !== 2 &&
                    task.status !== 3
            );
        } else {
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

        return sortedTasks;
    }, [tasks, taskStatusFilter, taskSearchQuery, orderBy, t]);

    useEffect(() => {
        const fetchTagData = async () => {
            try {
                // First fetch tag details using uid-slug
                const { fetchTagBySlug } = await import(
                    '../../utils/tagsService'
                );
                const tagData = await fetchTagBySlug(uidSlug!);
                setTag(tagData);

                // Now fetch entities that have this tag using the tag name
                const [tasksResponse, notesResponse] = await Promise.all([
                    fetch(
                        getApiPath(
                            `tasks?tag=${encodeURIComponent(tagData.name)}`
                        )
                    ),
                    fetch(
                        getApiPath(
                            `notes?tag=${encodeURIComponent(tagData.name)}`
                        )
                    ),
                ]);

                if (tasksResponse.ok) {
                    const tasksData = await tasksResponse.json();
                    setTasks(tasksData.tasks || []);
                }

                if (notesResponse.ok) {
                    const notesData = await notesResponse.json();
                    setNotes(notesData || []);
                }

                // Projects are now filtered from global store
            } catch {
                setError(t('tags.error'));
            } finally {
                setLoading(false);
            }
        };
        fetchTagData();
    }, [uidSlug, t]);

    useEffect(() => {
        const savedOrderBy =
            localStorage.getItem('order_by') || 'created_at:desc';
        setOrderBy(savedOrderBy);
        const savedGroupBy =
            (localStorage.getItem('tasks_group_by') as 'none' | 'project') ||
            'none';
        setGroupBy(savedGroupBy);
    }, []);

    // Setup native event listener for edit button to avoid React event system conflicts
    useEffect(() => {
        const button = editButtonRef.current;
        if (button) {
            const handleClick = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                openTagModal();
            };

            button.addEventListener('click', handleClick);
            return () => {
                button.removeEventListener('click', handleClick);
            };
        }
    }, [openTagModal]);

    // Task handlers
    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            const response = await fetch(
                getApiPath(`task/${updatedTask.uid}`),
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
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

    // Tag handlers
    const handleSaveTag = async (tagData: Tag) => {
        try {
            if (tag && tag.uid) {
                const updatedTag = await updateTag(tag.uid, tagData);
                setTag(updatedTag);
            }
            closeTagModal();
        } catch (error) {
            console.error('Error updating tag:', error);
            throw error;
        }
    };

    const handleDeleteTag = async () => {
        try {
            if (tag && tag.uid) {
                await deleteTag(tag.uid);
                navigate('/tags');
            }
        } catch (error) {
            console.error('Error deleting tag:', error);
        }
    };

    const handleSortChange = (order: string) => {
        setOrderBy(order);
        localStorage.setItem('order_by', order);
    };

    const handleGroupByChange = (value: 'none' | 'project') => {
        setGroupBy(value);
        localStorage.setItem('tasks_group_by', value);
    };

    const handleStatusChange = (value: 'all' | 'active' | 'completed') => {
        setTaskStatusFilter(value);
    };

    // Note handlers
    const handleEditNote = (note: Note) => {
        if (note.uid) {
            const slug = note.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            navigate(`/notes/${note.uid}-${slug}`);
        }
    };

    const handleDeleteNoteClick = (note: Note) => {
        setNoteToDelete(note);
        setIsNoteConfirmDialogOpen(true);
    };

    const handleConfirmDeleteNote = async () => {
        if (noteToDelete?.uid) {
            try {
                await apiDeleteNote(noteToDelete.uid);
                setNotes((prevNotes) =>
                    prevNotes.filter((note) => note.uid !== noteToDelete.uid)
                );
                showSuccessToast(t('success.noteDeleted'));
            } catch (error) {
                console.error('Error deleting note:', error);
                showErrorToast(t('errors.failedToDeleteNote'));
            }
        }
        setIsNoteConfirmDialogOpen(false);
        setNoteToDelete(null);
    };

    const showCompletedTasks = taskStatusFilter !== 'active';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                    {t('tags.loading')}
                </div>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    if (!tag) {
        return (
            <div className="text-gray-700 dark:text-gray-300 p-4">
                {t('tags.notFound')}
            </div>
        );
    }

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Tag Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
                    <h2 className="text-2xl font-light text-gray-900 dark:text-white mb-2 sm:mb-0">
                        Tag: {tag.name}
                    </h2>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                                    ? t(
                                          'common.hideSearch',
                                          'Collapse search panel'
                                      )
                                    : t(
                                          'common.showSearch',
                                          'Show search input'
                                      )
                            }
                            title={
                                isSearchExpanded
                                    ? t('common.hideSearch', 'Hide search')
                                    : t('common.search', 'Search tasks')
                            }
                        >
                            <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                            <span className="sr-only">
                                {isSearchExpanded
                                    ? t('common.hideSearch', 'Hide search')
                                    : t('common.search', 'Search tasks')}
                            </span>
                        </button>
                        <button
                            ref={editButtonRef}
                            type="button"
                            className="px-1 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            aria-label="Edit tag"
                            title="Edit tag"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => setIsConfirmDialogOpen(true)}
                            className="px-1 py-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            aria-label="Delete tag"
                            title="Delete tag"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
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
                            onChange={(e) => setTaskSearchQuery(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                        />
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <CheckIcon className="h-8 w-8 text-blue-500 mr-3" />
                            <div>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {tasks.length}
                                </p>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {t('tasks.title')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <BookOpenIcon className="h-8 w-8 text-green-500 mr-3" />
                            <div>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {notes.length}
                                </p>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {t('notes.title')}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900 shadow rounded-lg p-6">
                        <div className="flex items-center">
                            <FolderIcon className="h-8 w-8 text-purple-500 mr-3" />
                            <div>
                                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    {projects.length}
                                </p>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {t('projects.title')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tasks Section */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                            <CheckIcon className="h-5 w-5 mr-2" />
                            {t('tasks.title')} ({displayTasks.length})
                        </h3>
                        <IconSortDropdown
                            options={sortOptions}
                            value={orderBy}
                            onChange={handleSortChange}
                            ariaLabel={t('tasks.sortTasks', 'Sort tasks')}
                            title={t('tasks.sortTasks', 'Sort tasks')}
                            dropdownLabel={t('tasks.sortBy', 'Sort by')}
                            footerContent={
                                <div className="space-y-3">
                                    <div>
                                        <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                            {t('tasks.groupBy', 'Group by')}
                                        </div>
                                        <div className="py-1">
                                            {['none', 'project'].map((val) => (
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
                                                        {val === 'project'
                                                            ? t(
                                                                  'tasks.groupByProject',
                                                                  'Project'
                                                              )
                                                            : t(
                                                                  'tasks.grouping.none',
                                                                  'None'
                                                              )}
                                                    </span>
                                                    {groupBy === val && (
                                                        <CheckIcon className="h-4 w-4" />
                                                    )}
                                                </button>
                                            ))}
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
                                                        <span>{opt.label}</span>
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
                                            {t('tasks.direction', 'Direction')}
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
                                                        <span>{dir.label}</span>
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
                    {displayTasks.length > 0 ? (
                        groupBy === 'project' ? (
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
                        )
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('tasks.noTasksAvailable', 'No tasks available.')}
                        </p>
                    )}
                </div>

                {/* Notes Section */}
                {notes.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            <BookOpenIcon className="h-5 w-5 mr-2" />
                            {t('notes.title')} ({notes.length})
                        </h3>
                        <ul className="space-y-1">
                            {notes.map((note) => {
                                const noteTags = note.tags || note.Tags || [];
                                const noteProject = note.project || note.Project;
                                const hasMetadata = noteProject || noteTags.length > 0;

                                return (
                                    <li
                                        key={note.uid}
                                        className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-2 flex justify-between items-start"
                                        onMouseEnter={() =>
                                            setHoveredNoteId(note.uid || null)
                                        }
                                        onMouseLeave={() => setHoveredNoteId(null)}
                                    >
                                        <div className="flex-grow overflow-hidden pr-4">
                                            {/* Note Title */}
                                            <Link
                                                to={
                                                    note.uid
                                                        ? `/notes/${note.uid}-${note.title
                                                              .toLowerCase()
                                                              .replace(
                                                                  /[^a-z0-9]+/g,
                                                                  '-'
                                                              )
                                                              .replace(
                                                                  /^-|-$/g,
                                                                  ''
                                                              )}`
                                                        : '#'
                                                }
                                                className="text-md font-medium text-gray-900 dark:text-gray-300 hover:underline block"
                                            >
                                                {note.title}
                                            </Link>
                                            {/* Project and Tags below title - matching TaskHeader style */}
                                            {hasMetadata && (
                                                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {/* Project */}
                                                    {noteProject && (
                                                        <div className="flex items-center">
                                                            <FolderOutlineIcon className="h-3 w-3 mr-1" />
                                                            <Link
                                                                to={
                                                                    noteProject.uid
                                                                        ? `/project/${noteProject.uid}-${noteProject.name
                                                                              .toLowerCase()
                                                                              .replace(
                                                                                  /[^a-z0-9]+/g,
                                                                                  '-'
                                                                              )
                                                                              .replace(
                                                                                  /^-|-$/g,
                                                                                  ''
                                                                              )}`
                                                                        : `/project/${noteProject.id}`
                                                                }
                                                                className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {noteProject.name}
                                                            </Link>
                                                        </div>
                                                    )}
                                                    {/* Tags */}
                                                    {noteTags.length > 0 && (
                                                        <div className="flex items-center">
                                                            <TagIcon className="h-3 w-3 mr-1" />
                                                            <span>
                                                                {noteTags.map((noteTag, index) => (
                                                                    <React.Fragment key={noteTag.id || noteTag.name}>
                                                                        <Link
                                                                            to={
                                                                                noteTag.uid
                                                                                    ? `/tag/${noteTag.uid}-${noteTag.name
                                                                                          .toLowerCase()
                                                                                          .replace(
                                                                                              /[^a-z0-9]+/g,
                                                                                              '-'
                                                                                          )
                                                                                          .replace(
                                                                                              /^-|-$/g,
                                                                                              ''
                                                                                          )}`
                                                                                    : `/tag/${encodeURIComponent(noteTag.name)}`
                                                                            }
                                                                            className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {noteTag.name}
                                                                        </Link>
                                                                        {index < noteTags.length - 1 && ', '}
                                                                    </React.Fragment>
                                                                ))}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex space-x-2 pt-1">
                                            <button
                                                onClick={() => handleEditNote(note)}
                                                className={`text-gray-500 hover:text-blue-700 dark:hover:text-blue-300 focus:outline-none transition-opacity ${hoveredNoteId === note.uid ? 'opacity-100' : 'opacity-0'}`}
                                                aria-label={`Edit ${note.title}`}
                                                title={`Edit ${note.title}`}
                                            >
                                                <PencilSquareIcon className="h-5 w-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteNoteClick(note)}
                                                className={`text-gray-500 hover:text-red-700 dark:hover:text-red-300 focus:outline-none transition-opacity ${hoveredNoteId === note.uid ? 'opacity-100' : 'opacity-0'}`}
                                                aria-label={`Delete ${note.title}`}
                                                title={`Delete ${note.title}`}
                                            >
                                                <TrashIcon className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}

                {/* Projects Section */}
                {projects.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                            <FolderIcon className="h-5 w-5 mr-2" />
                            {t('projects.title')} ({projects.length})
                        </h3>
                        <div className="flex flex-col space-y-1">
                            {projects.map((project: Project) => {
                                return (
                                    <ProjectItem
                                        key={project.id}
                                        project={project}
                                        viewMode="list"
                                        getCompletionPercentage={() =>
                                            getCompletionPercentage(project)
                                        }
                                        activeDropdown={activeDropdown}
                                        setActiveDropdown={setActiveDropdown}
                                        handleEditProject={handleEditProject}
                                        setProjectToDelete={setProjectToDelete}
                                        setIsConfirmDialogOpen={
                                            setIsConfirmDialogOpen
                                        }
                                        onOpenShare={(p) =>
                                            setShareModal({
                                                isOpen: true,
                                                project: p,
                                            })
                                        }
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {displayTasks.length === 0 &&
                    notes.length === 0 &&
                    projects.length === 0 && (
                        <div className="text-center py-8">
                            <TagIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400 text-lg">
                                {taskSearchQuery.trim()
                                    ? t(
                                          'tasks.noTasksAvailable',
                                          'No tasks available.'
                                      )
                                    : t(
                                          'tags.noItemsWithTag',
                                          `No items found with the tag "${tag.name}"`
                                      )}
                            </p>
                        </div>
                    )}
            </div>

            {/* Tag Modal */}
            {isTagModalOpen && tag && (
                <TagModal
                    isOpen={isTagModalOpen}
                    onClose={closeTagModal}
                    onSave={handleSaveTag}
                    tag={tag}
                />
            )}

            {/* Project Share Modal */}
            {shareModal.isOpen && shareModal.project && (
                <ProjectShareModal
                    isOpen={shareModal.isOpen}
                    onClose={() =>
                        setShareModal({ isOpen: false, project: null })
                    }
                    project={shareModal.project}
                />
            )}

            {/* Confirm Dialog for Tag */}
            {isConfirmDialogOpen && tag && (
                <ConfirmDialog
                    title={t('tags.deleteTag', 'Delete Tag')}
                    message={t(
                        'tags.deleteTagConfirm',
                        `Are you sure you want to delete the tag "${tag.name}"?`
                    )}
                    onConfirm={handleDeleteTag}
                    onCancel={() => setIsConfirmDialogOpen(false)}
                />
            )}

            {/* Confirm Dialog for Note Deletion */}
            {isNoteConfirmDialogOpen && noteToDelete && (
                <ConfirmDialog
                    title={t('notes.deleteNote', 'Delete Note')}
                    message={t(
                        'notes.deleteNoteConfirm',
                        `Are you sure you want to delete the note "${noteToDelete.title}"?`
                    )}
                    onConfirm={handleConfirmDeleteNote}
                    onCancel={() => {
                        setIsNoteConfirmDialogOpen(false);
                        setNoteToDelete(null);
                    }}
                />
            )}
        </div>
    );
};

export default TagDetails;
