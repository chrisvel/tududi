import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    TrashIcon,
    TagIcon,
    QueueListIcon,
    StarIcon,
    InformationCircleIcon,
    PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { Task } from '../entities/Task';
import { Note } from '../entities/Note';
import { Project } from '../entities/Project';
import TaskList from './Task/TaskList';
import ProjectItem from './Project/ProjectItem';
import ConfirmDialog from './Shared/ConfirmDialog';
import { searchUniversal } from '../utils/searchService';

interface View {
    id: number;
    uid: string;
    name: string;
    search_query: string | null;
    filters: string[];
    priority: string | null;
    due: string | null;
    tags: string[];
    is_pinned: boolean;
}

const ViewDetail: React.FC = () => {
    const { t } = useTranslation();
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const [view, setView] = useState<View | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [showCriteriaDropdown, setShowCriteriaDropdown] = useState(false);

    // State for ProjectItem and Note components
    const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
    const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null);
    const [, setProjectToDelete] = useState<Project | null>(null);

    // Ref for dropdown and title edit
    const criteriaDropdownRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchViewAndResults();
    }, [uid]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                criteriaDropdownRef.current &&
                !criteriaDropdownRef.current.contains(event.target as Node)
            ) {
                setShowCriteriaDropdown(false);
            }
        };

        if (showCriteriaDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showCriteriaDropdown]);

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

    const fetchViewAndResults = async () => {
        if (!uid) return;

        try {
            // Fetch view details
            const viewResponse = await fetch(`/api/views/${uid}`, {
                credentials: 'include',
            });
            if (!viewResponse.ok) {
                navigate('/views');
                return;
            }
            const viewData = await viewResponse.json();
            setView(viewData);

            // Fetch search results
            const results = await searchUniversal({
                query: viewData.search_query || '',
                filters: viewData.filters,
                priority: viewData.priority || undefined,
                due: viewData.due || undefined,
                tags:
                    viewData.tags && viewData.tags.length > 0
                        ? viewData.tags
                        : undefined,
            });

            // Separate results by type
            const taskResults: Task[] = [];
            const noteResults: Note[] = [];
            const projectResults: Project[] = [];

            results.forEach((result) => {
                if (result.type === 'Task') {
                    taskResults.push(result as any);
                } else if (result.type === 'Note') {
                    noteResults.push(result as any);
                } else if (result.type === 'Project') {
                    projectResults.push(result as any);
                }
            });

            setTasks(taskResults);
            setNotes(noteResults);
            setProjects(projectResults);
        } catch (error) {
            console.error('Error fetching view:', error);
            navigate('/views');
        } finally {
            setIsLoading(false);
        }
    };

    // Task handlers
    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            const response = await fetch(`/api/task/${updatedTask.id}`, {
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

    const handleTaskDelete = async (taskId: number) => {
        try {
            const response = await fetch(`/api/task/${taskId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setTasks((prevTasks) =>
                    prevTasks.filter((task) => task.id !== taskId)
                );
            }
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    };

    const handleToggleToday = async (taskId: number) => {
        try {
            const { toggleTaskToday } = await import('../utils/tasksService');
            const updatedTask = await toggleTaskToday(taskId);

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

    const handleEditName = () => {
        if (view) {
            setEditedName(view.name);
            setIsEditingName(true);
        }
    };

    const handleSaveName = async () => {
        if (!view || !editedName.trim()) return;

        try {
            const response = await fetch(`/api/views/${view.uid}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
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
            const response = await fetch(`/api/views/${view.uid}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
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
            const response = await fetch(`/api/views/${view.uid}`, {
                method: 'DELETE',
                credentials: 'include',
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
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center flex-1">
                        {isEditingName ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSaveName();
                                    } else if (e.key === 'Escape') {
                                        handleCancelEdit();
                                    }
                                }}
                                className="text-2xl font-light text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full max-w-2xl"
                                autoFocus
                            />
                        ) : (
                            <h2
                                onClick={handleEditName}
                                className="text-2xl font-light text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                                {view.name}
                            </h2>
                        )}
                    </div>
                    <div className="flex items-center">
                        <div className="relative" ref={criteriaDropdownRef}>
                            <button
                                onClick={() =>
                                    setShowCriteriaDropdown(
                                        !showCriteriaDropdown
                                    )
                                }
                                className={`flex items-center hover:bg-blue-100/50 dark:hover:bg-blue-800/20 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg${showCriteriaDropdown ? ' bg-blue-50/70 dark:bg-blue-900/20' : ''} p-2`}
                                aria-expanded={showCriteriaDropdown}
                                aria-label="View search criteria"
                                title={
                                    showCriteriaDropdown
                                        ? 'Hide criteria'
                                        : 'View search criteria'
                                }
                            >
                                <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                            </button>
                            {showCriteriaDropdown && (
                                <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50">
                                    <div className="p-4">
                                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                                            <InformationCircleIcon className="h-4 w-4 mr-2 text-blue-500" />
                                            {t('views.searchCriteria')}
                                        </h3>
                                        <div className="space-y-3">
                                            {view.filters.length > 0 && (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                                        {t('views.entityTypes')}
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {view.filters.map(
                                                            (filter) => (
                                                                <span
                                                                    key={filter}
                                                                    className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs font-medium"
                                                                >
                                                                    {filter}
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {view.search_query && (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                                        {t('views.searchText')}
                                                    </p>
                                                    <p className="text-sm text-gray-900 dark:text-gray-100 font-medium">
                                                        &quot;
                                                        {view.search_query}
                                                        &quot;
                                                    </p>
                                                </div>
                                            )}
                                            {view.priority && (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                                        {t('views.priority')}
                                                    </p>
                                                    <span className="px-2 py-1 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 rounded text-xs font-medium capitalize">
                                                        {view.priority}
                                                    </span>
                                                </div>
                                            )}
                                            {view.due && (
                                                <div>
                                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                                        {t('views.dueDate')}
                                                    </p>
                                                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs font-medium capitalize">
                                                        {view.due.replace(
                                                            /_/g,
                                                            ' '
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {view.tags &&
                                                view.tags.length > 0 && (
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                                                            {t('views.tags')}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {view.tags.map(
                                                                (tag) => (
                                                                    <span
                                                                        key={
                                                                            tag
                                                                        }
                                                                        className="px-2 py-1 bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 rounded text-xs font-medium"
                                                                    >
                                                                        {tag}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            {!view.filters.length &&
                                                !view.search_query &&
                                                !view.priority &&
                                                !view.due &&
                                                (!view.tags ||
                                                    view.tags.length === 0) && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                                                        {t(
                                                            'views.noCriteriaSet'
                                                        )}
                                                    </p>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={togglePin}
                            className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${view.is_pinned ? 'text-yellow-500' : 'text-gray-400'}`}
                            aria-label={
                                view.is_pinned ? 'Unpin view' : 'Pin view'
                            }
                            title={view.is_pinned ? 'Unpin view' : 'Pin view'}
                        >
                            {view.is_pinned ? (
                                <StarIconSolid className="h-5 w-5" />
                            ) : (
                                <StarIcon className="h-5 w-5" />
                            )}
                        </button>
                        <button
                            onClick={openConfirmDialog}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            aria-label="Delete view"
                            title="Delete view"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Tasks Section */}
                {tasks.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-light text-gray-900 dark:text-white mb-4">
                            {t('tasks.title')} ({tasks.length})
                        </h3>
                        <TaskList
                            tasks={tasks}
                            onTaskUpdate={handleTaskUpdate}
                            onTaskDelete={handleTaskDelete}
                            projects={[]}
                            hideProjectName={false}
                            onToggleToday={handleToggleToday}
                        />
                    </div>
                )}

                {/* Notes Section */}
                {notes.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-lg font-light text-gray-900 dark:text-white mb-4">
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
                        <h3 className="text-lg font-light text-gray-900 dark:text-white mb-4">
                            {t('projects.title')} ({projects.length})
                        </h3>
                        <div className="flex flex-col space-y-1">
                            {projects.map((project) => {
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
                                        setIsConfirmDialogOpen={() => {}}
                                        onOpenShare={() => {
                                            /* noop in view detail */
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {tasks.length === 0 &&
                    notes.length === 0 &&
                    projects.length === 0 && (
                        <div className="text-center py-8">
                            <QueueListIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400 text-lg">
                                No items found matching the view criteria
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
