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
import { Task } from '../../entities/Task';
import { Note } from '../../entities/Note';
import { Project } from '../../entities/Project';
import TaskList from '../Task/TaskList';
import ProjectItem from '../Project/ProjectItem';
import ProjectShareModal from '../Project/ProjectShareModal';
import TagModal from './TagModal';
import ConfirmDialog from '../Shared/ConfirmDialog';

import { Tag } from '../../entities/Tag';
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
    const [showCompleted, setShowCompleted] = useState(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');

    // Filter projects by current tag
    const projects = allProjects.filter(
        (project: any) =>
            project.tags &&
            project.tags.some(
                (projectTag: any) => projectTag.name === tag?.name
            )
    );

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
        if (showCompleted) {
            filteredTasks = tasks.filter(
                (task: Task) =>
                    task.status === 'done' ||
                    task.status === 'archived' ||
                    task.status === 2 ||
                    task.status === 3
            );
        } else {
            filteredTasks = tasks.filter(
                (task: Task) =>
                    task.status !== 'done' &&
                    task.status !== 'archived' &&
                    task.status !== 2 &&
                    task.status !== 3
            );
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
    }, [tasks, showCompleted, taskSearchQuery, orderBy, t]);

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
            const response = await fetch(getApiPath(`task/${updatedTask.id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTask),
            });

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

    const handleToggleToday = async (taskId: number, task?: Task) => {
        try {
            // Use the proper service function that includes auth
            const { toggleTaskToday } = await import(
                '../../utils/tasksService'
            );
            const updatedTask = await toggleTaskToday(taskId, task);

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
            console.error('Error toggling today status:', error);
        }
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
                            onChange={setOrderBy}
                            ariaLabel={t('tasks.sortTasks', 'Sort tasks')}
                            title={t('tasks.sortTasks', 'Sort tasks')}
                            dropdownLabel={t('tasks.sortBy', 'Sort by')}
                            extraContent={
                                <button
                                    type="button"
                                    onClick={() => setShowCompleted((v) => !v)}
                                    className="w-full flex items-center justify-between text-sm text-gray-700 dark:text-gray-300"
                                    aria-pressed={showCompleted}
                                    aria-label={
                                        showCompleted
                                            ? t(
                                                  'tasks.hideCompleted',
                                                  'Hide completed tasks'
                                              )
                                            : t(
                                                  'tasks.showCompleted',
                                                  'Show completed tasks'
                                              )
                                    }
                                    title={
                                        showCompleted
                                            ? t(
                                                  'tasks.hideCompleted',
                                                  'Hide completed tasks'
                                              )
                                            : t(
                                                  'tasks.showCompleted',
                                                  'Show completed tasks'
                                              )
                                    }
                                >
                                    <span>
                                        {t(
                                            'tasks.showCompleted',
                                            'Show completed'
                                        )}
                                    </span>
                                    <span
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                            showCompleted
                                                ? 'bg-blue-600'
                                                : 'bg-gray-200 dark:bg-gray-600'
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                showCompleted
                                                    ? 'translate-x-4'
                                                    : 'translate-x-0.5'
                                            }`}
                                        />
                                    </span>
                                </button>
                            }
                        />
                    </div>
                    {displayTasks.length > 0 ? (
                        <TaskList
                            tasks={displayTasks}
                            onTaskUpdate={handleTaskUpdate}
                            onTaskDelete={handleTaskDelete}
                            projects={[]} // Empty since we're viewing by tag
                            hideProjectName={false}
                            onToggleToday={handleToggleToday}
                            showCompletedTasks={showCompleted}
                        />
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
                            {notes.map((note) => (
                                <li
                                    key={note.uid}
                                    className="bg-white dark:bg-gray-900 shadow rounded-lg px-4 py-3 flex justify-between items-center"
                                    onMouseEnter={() =>
                                        setHoveredNoteId(note.uid || null)
                                    }
                                    onMouseLeave={() => setHoveredNoteId(null)}
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
                                                    note.Tags.length > 0)) && (
                                                <>
                                                    {(
                                                        note.tags ||
                                                        note.Tags ||
                                                        []
                                                    ).map((noteTag) => (
                                                        <button
                                                            key={noteTag.id}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                navigate(
                                                                    `/tag/${encodeURIComponent(noteTag.name)}`
                                                                );
                                                            }}
                                                            className="flex items-center space-x-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                                        >
                                                            <TagIcon className="h-3 w-3 text-gray-500 dark:text-gray-300" />
                                                            <span className="text-gray-700 dark:text-gray-300">
                                                                {noteTag.name}
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

            {/* Confirm Dialog */}
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
        </div>
    );
};

export default TagDetails;
