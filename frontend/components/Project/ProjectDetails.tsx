import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import {
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    PlusCircleIcon,
    Squares2X2Icon,
    PlayIcon,
    LightBulbIcon,
    ClipboardDocumentListIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
    ShareIcon,
} from '@heroicons/react/24/outline';
import TaskList from '../Task/TaskList';
import ProjectModal from '../Project/ProjectModal';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from '../Note/NoteModal';
import { useStore } from '../../store/useStore';
import NewTask from '../Task/NewTask';
import { Project } from '../../entities/Project';
import NoteCard from '../Shared/NoteCard';
import { Task } from '../../entities/Task';
import { Note } from '../../entities/Note';
import {
    fetchProjectBySlug,
    updateProject,
    deleteProject,
    fetchProjects,
} from '../../utils/projectsService';
import {
    createTask,
    deleteTask,
    toggleTaskToday,
} from '../../utils/tasksService';
import {
    updateNote,
    deleteNote as apiDeleteNote,
} from '../../utils/notesService';
import { createNote } from '../../utils/notesService';
import { isAuthError } from '../../utils/authUtils';
import { getAutoSuggestNextActionsEnabled } from '../../utils/profileService';
import AutoSuggestNextActionBox from './AutoSuggestNextActionBox';
import SortFilterButton, { SortOption } from '../Shared/SortFilterButton';
import LoadingSpinner from '../Shared/LoadingSpinner';
import { usePersistedModal } from '../../hooks/usePersistedModal';
import BannerBadge from '../Shared/BannerBadge';

const ProjectDetails: React.FC = () => {
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();

    // Load areas from store (similar to how we handle tags)
    const { areasStore, projectsStore } = useStore();
    const areas = areasStore.areas;

    // Load areas when component mounts
    useEffect(() => {
        if (!areasStore.hasLoaded && !areasStore.isLoading) {
            areasStore.loadAreas();
        }
    }, [areasStore.hasLoaded, areasStore.isLoading, areasStore.loadAreas]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    // Use local state to isolate from global store changes that cause remounting
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);

    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    // Use persisted modal state that survives component remounts
    const {
        isOpen: isModalOpen,
        openModal,
        closeModal,
    } = usePersistedModal(project?.id);
    const editButtonRef = useRef<HTMLButtonElement>(null);

    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

    const [showCompleted, setShowCompleted] = useState(false);
    const [showAutoSuggestForm, setShowAutoSuggestForm] = useState(false);
    const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(false);
    const hasCheckedAutoSuggest = useRef(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');
    const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');

    // Sort options for tasks
    const sortOptions: SortOption[] = [
        { value: 'created_at:desc', label: 'Created at' },
        { value: 'due_date:asc', label: 'Due date' },
        { value: 'priority:desc', label: 'Priority' },
    ];

    // Note modal state
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    // Dispatch global modal events

    useEffect(() => {
        const fetchAutoSuggestSetting = async () => {
            if (!hasCheckedAutoSuggest.current) {
                hasCheckedAutoSuggest.current = true;
                const enabled = await getAutoSuggestNextActionsEnabled();
                setAutoSuggestEnabled(enabled);
            }
        };

        fetchAutoSuggestSetting();
    }, []);

    // Load projects if not already loaded
    useEffect(() => {
        const loadProjectsIfNeeded = async () => {
            if (allProjects.length === 0) {
                try {
                    const projectsData = await fetchProjects();
                    setAllProjects(projectsData);
                } catch (error) {
                    console.error('Failed to fetch projects:', error);
                }
            }
        };
        loadProjectsIfNeeded();
    }, [allProjects.length]);

    // Check if we should show auto-suggest form for projects with no tasks
    useEffect(() => {
        if (
            project &&
            tasks.length === 0 &&
            !loading &&
            !showCompleted &&
            autoSuggestEnabled
        ) {
            setShowAutoSuggestForm(true);
        } else {
            setShowAutoSuggestForm(false);
        }
    }, [project, tasks.length, loading, showCompleted, autoSuggestEnabled]);

    // Load initial sort order from localStorage (URL params removed to prevent conflicts)
    useEffect(() => {
        const sortParam =
            localStorage.getItem('project_order_by') || 'created_at:desc';
        setOrderBy(sortParam);
    }, []);

    // Fetch project data when uidSlug changes
    useEffect(() => {
        if (!uidSlug) return;

        // Skip loading if we already have the project data for this uidSlug
        if (
            project &&
            project.uid &&
            `${project.uid}-${project.name
                ?.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')}` === uidSlug
        ) {
            return;
        }

        const loadProjectData = async () => {
            try {
                // Only show loading if we don't have any project data yet
                if (!project) {
                    setLoading(true);
                }
                setError(false);

                const projectData = await fetchProjectBySlug(uidSlug);
                setProject(projectData);
                setTasks(projectData.tasks || projectData.Tasks || []);

                // Load saved preferences from project data
                if (projectData.task_show_completed !== undefined) {
                    setShowCompleted(projectData.task_show_completed);
                }
                if (projectData.task_sort_order) {
                    setOrderBy(projectData.task_sort_order);
                }
                const fetchedNotes =
                    projectData.notes || projectData.Notes || [];

                // Normalize tags field - backend returns 'Tags' but frontend expects 'tags'
                const normalizedNotes = fetchedNotes.map((note) => {
                    if (note.Tags && !note.tags) {
                        note.tags = note.Tags;
                    }
                    return note;
                });

                setNotes(normalizedNotes);
                setLoading(false);
            } catch {
                setError(true);
                setLoading(false);
            }
        };

        loadProjectData();
    }, [uidSlug]);

    const handleTaskCreate = async (taskName: string) => {
        if (!project) {
            throw new Error('Cannot create task: Project is missing');
        }

        try {
            const newTask = await createTask({
                name: taskName,
                status: 0, // Use numeric status: 0 = not_started
                project_id: project.id,
                completed_at: null,
            });
            setTasks([...tasks, newTask]);

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
        } catch (err: any) {
            // Check if it's an authentication error
            if (isAuthError(err)) {
                return;
            }
            throw err; // Re-throw to allow proper error handling by NewTask component
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        if (!updatedTask.id) {
            return;
        }

        // Only skip API call for specific operations that already have fresh data from the server
        // (like toggleTaskCompletion), not for general modal updates
        const hasUpdatedData =
            updatedTask.parent_child_logic_executed !== undefined;

        if (hasUpdatedData) {
            // Use the provided data directly, preserving existing subtasks if not included
            setTasks(
                tasks.map((task) =>
                    task.id === updatedTask.id
                        ? {
                              ...task,
                              ...updatedTask,
                              // Explicitly preserve subtasks data
                              subtasks:
                                  updatedTask.subtasks ||
                                  updatedTask.Subtasks ||
                                  task.subtasks ||
                                  task.Subtasks ||
                                  [],
                              Subtasks:
                                  updatedTask.subtasks ||
                                  updatedTask.Subtasks ||
                                  task.subtasks ||
                                  task.Subtasks ||
                                  [],
                          }
                        : task
                )
            );
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
                await response.json();
                throw new Error('Failed to update task');
            }

            const savedTask = await response.json();

            // If the task's project was changed/cleared and no longer belongs to this project, remove it
            // Handle both null and undefined project_id values
            const savedTaskProjectId = savedTask.project_id ?? null;
            const currentProjectId = project?.id ?? null;

            if (savedTaskProjectId !== currentProjectId) {
                setTasks(tasks.filter((task) => task.id !== updatedTask.id));
            } else {
                // Otherwise, update the task in place
                setTasks(
                    tasks.map((task) =>
                        task.id === updatedTask.id
                            ? {
                                  ...task,
                                  ...savedTask,
                                  // Explicitly preserve subtasks data
                                  subtasks:
                                      savedTask.subtasks ||
                                      savedTask.Subtasks ||
                                      updatedTask.subtasks ||
                                      updatedTask.Subtasks ||
                                      task.subtasks ||
                                      task.Subtasks ||
                                      [],
                                  Subtasks:
                                      savedTask.subtasks ||
                                      savedTask.Subtasks ||
                                      updatedTask.subtasks ||
                                      updatedTask.Subtasks ||
                                      task.subtasks ||
                                      task.Subtasks ||
                                      [],
                              }
                            : task
                    )
                );
            }
        } catch {
            // Error updating task - silently handled
        }
    };

    const handleTaskDelete = async (taskId: number | undefined) => {
        if (!taskId) {
            return;
        }
        try {
            await deleteTask(taskId);
            setTasks(tasks.filter((task) => task.id !== taskId));
        } catch {
            // Error deleting task - silently handled
        }
    };

    const handleToggleToday = async (taskId: number): Promise<void> => {
        try {
            const updatedTask = await toggleTaskToday(taskId);
            // Update the task in the local state immediately to avoid UI flashing
            setTasks(
                tasks.map((task) =>
                    task.id === taskId
                        ? {
                              ...task,
                              today: updatedTask.today,
                              today_move_count: updatedTask.today_move_count,
                          }
                        : task
                )
            );
        } catch {
            // Optionally refetch data on error to ensure consistency
            if (uidSlug) {
                // Refetch project data on error to ensure consistency
                try {
                    const projectData = await fetchProjectBySlug(uidSlug);
                    setProject(projectData);
                    setTasks(projectData.tasks || projectData.Tasks || []);
                    const fetchedNotes =
                        projectData.notes || projectData.Notes || [];

                    // Normalize tags field - backend returns 'Tags' but frontend expects 'tags'
                    const normalizedNotes = fetchedNotes.map((note) => {
                        if (note.Tags && !note.tags) {
                            note.tags = note.Tags;
                        }
                        return note;
                    });

                    setNotes(normalizedNotes);
                } catch {
                    // Error refetching project data - silently handled
                }
            }
        }
    };

    // Setup native event listener for edit button to avoid React event system conflicts
    useEffect(() => {
        const button = editButtonRef.current;
        if (button) {
            const handleClick = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                openModal();
            };

            button.addEventListener('click', handleClick);
            return () => {
                button.removeEventListener('click', handleClick);
            };
        }
    }, [openModal]);

    const handleSaveProject = async (updatedProject: Project) => {
        if (!updatedProject.uid) {
            return;
        }

        try {
            const savedProject = await updateProject(
                updatedProject.uid,
                updatedProject
            );
            // Merge the saved project with existing project to preserve area data
            setProject((prevProject) => ({
                ...savedProject,
                // Preserve area info if it's missing from the response
                area: savedProject.area || prevProject?.area,
                Area: (savedProject as any).Area || (prevProject as any)?.Area,
            }));
            closeModal();
        } catch {
            // Error saving project - silently handled
        }
    };

    const handleCreateNextAction = async (
        projectId: number,
        actionDescription: string
    ) => {
        try {
            const newTask = await createTask({
                name: actionDescription,
                status: 0, // Use numeric status: 0 = not_started
                project_id: projectId,
                priority: 0, // Use numeric priority: 0 = low
                completed_at: null,
            });

            // Update the tasks list to include the new task
            setTasks([...tasks, newTask]);
            setShowAutoSuggestForm(false);

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
        } catch {
            // Error creating next action - silently handled
        }
    };

    const handleSkipNextAction = () => {
        setShowAutoSuggestForm(false);
    };

    const saveProjectPreferences = async (
        showCompleted: boolean,
        orderBy: string
    ) => {
        if (!project?.id) return;

        try {
            // Save preferences directly via API call
            const response = await fetch(`/api/project/${project.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    task_show_completed: showCompleted,
                    task_sort_order: orderBy,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save project preferences');
            }
        } catch (error) {
            console.error('Error saving project preferences:', error);
        }
    };

    const handleShowCompletedChange = (checked: boolean) => {
        setShowCompleted(checked);

        // Save to project (remove navigation to prevent re-render)
        saveProjectPreferences(checked, orderBy);
    };

    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
        // Save to project
        saveProjectPreferences(showCompleted, newOrderBy);
    };

    const handleDeleteProject = async () => {
        if (!project?.uid) {
            return;
        }

        try {
            await deleteProject(project.uid);

            // Update the global projects store to remove the deleted project
            const currentProjects = projectsStore.projects;
            const updatedProjects = currentProjects.filter(
                (p) => p.uid !== project.uid
            );
            projectsStore.setProjects(updatedProjects);

            navigate('/projects');
        } catch {
            // Error deleting project - silently handled
        }
    };

    // Note handlers
    const handleEditNote = async (note: Note) => {
        try {
            // Fetch the complete note data including tags
            const response = await fetch(`/api/note/${note.uid}`, {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });

            if (response.ok) {
                const fullNote = await response.json();
                setSelectedNote(fullNote);
            } else {
                // Fallback to the original note if fetch fails
                setSelectedNote(note);
            }
        } catch (error) {
            // Fallback to the original note if fetch fails
            console.error('Error fetching note details:', error);
            setSelectedNote(note);
        }
        setIsNoteModalOpen(true);
    };

    const handleDeleteNote = async (noteIdentifier: string) => {
        try {
            await apiDeleteNote(noteIdentifier);
            setNotes(
                notes.filter((n) => {
                    const currentIdentifier =
                        n.uid ??
                        (n.id !== undefined ? String(n.id) : undefined);
                    return currentIdentifier !== noteIdentifier;
                })
            );
            setNoteToDelete(null);
            setIsConfirmDialogOpen(false);
        } catch {
            // Error deleting note - silently handled
        }
    };

    // Create or update note and keep local notes list in sync
    const handleSaveNote = async (noteData: Note) => {
        try {
            let savedNote: Note;
            const noteIdentifier =
                noteData.uid ??
                (noteData.id !== undefined ? String(noteData.id) : null);

            let isUpdate = false;

            if (noteIdentifier) {
                savedNote = await updateNote(noteIdentifier, noteData);
                isUpdate = true;
            } else {
                savedNote = await createNote(noteData);
            }

            // Normalize tags field - backend returns 'Tags' but frontend expects 'tags'
            if ((savedNote as any).Tags && !(savedNote as any).tags) {
                (savedNote as any).tags = (savedNote as any).Tags;
            }

            // If updated note moved to another project, remove it from this list
            // Handle both null and undefined project_id values
            const savedNoteProjectId = savedNote.project_id ?? null;
            const currentProjectId = project?.id ?? null;

            if (savedNote.id && savedNoteProjectId !== currentProjectId) {
                setNotes(notes.filter((n) => n.id !== savedNote.id));
            } else if (isUpdate) {
                const savedIdentifier =
                    savedNote.uid ??
                    (savedNote.id !== undefined ? String(savedNote.id) : null);

                setNotes(
                    notes.map((n) => {
                        const currentIdentifier =
                            n.uid ??
                            (n.id !== undefined ? String(n.id) : undefined);

                        return currentIdentifier === savedIdentifier
                            ? savedNote
                            : n;
                    })
                );
            } else {
                setNotes([savedNote, ...notes]);
            }

            setIsNoteModalOpen(false);
            setSelectedNote(null);
        } catch {
            // Error saving note - silently handled
        }
    };

    // Filter and sort tasks (backend filtering/sorting not working reliably)
    const displayTasks = useMemo(() => {
        // First, filter tasks based on completed state
        let filteredTasks;
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
            // Show only non-completed tasks (not_started=0, in_progress=1)
            filteredTasks = tasks.filter(
                (task) =>
                    task.status === 'not_started' ||
                    task.status === 'in_progress' ||
                    task.status === 0 ||
                    task.status === 1
            );
        }

        // Then, sort the filtered tasks
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
                    // Convert priority to numeric for sorting (high=2, medium=1, low=0)
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
    }, [tasks, showCompleted, orderBy]);

    // Function to get the appropriate icon for project state
    const getStateIcon = (state: string) => {
        switch (state) {
            case 'idea':
                return (
                    <LightBulbIcon className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />
                );
            case 'planned':
                return (
                    <ClipboardDocumentListIcon className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />
                );
            case 'in_progress':
                return (
                    <PlayIcon className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                );
            case 'blocked':
                return (
                    <ExclamationTriangleIcon className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                );
            case 'completed':
                return (
                    <CheckCircleIcon className="h-3 w-3 text-gray-500 flex-shrink-0 mt-0.5" />
                );
            default:
                return (
                    <PlayIcon className="h-3 w-3 text-white/70 flex-shrink-0 mt-0.5" />
                );
        }
    };

    if (loading) {
        return <LoadingSpinner message="Loading project details..." />;
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    Failed to load project details.
                </div>
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

    return (
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Project Banner - Unified for both with and without images */}
                <div className="mb-6 rounded-lg overflow-hidden relative group">
                    {/* Background - Image or Gradient */}
                    {project.image_url ? (
                        <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-full h-64 object-cover"
                        />
                    ) : (
                        <div className="w-full h-64 bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700"></div>
                    )}

                    {/* Title Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
                        <div className="text-center px-4">
                            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">
                                {project.name}
                            </h1>
                            {project.description && (
                                <p className="text-lg md:text-xl text-white/90 mt-2 font-light drop-shadow-md max-w-2xl mx-auto">
                                    {project.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* State, Tags and Area Display - Bottom Left */}
                    <div className="absolute bottom-2 left-2 right-14 flex items-center flex-wrap gap-2">
                        {/* Project State Display */}
                        {project.state && (
                            <BannerBadge>
                                {getStateIcon(project.state)}
                                <span className="text-xs text-white/90 font-medium">
                                    {t(`projects.states.${project.state}`)}
                                </span>
                            </BannerBadge>
                        )}

                        {/* Tags Display */}
                        {project.tags && project.tags.length > 0 && (
                            <BannerBadge>
                                <TagIcon className="h-3 w-3 text-white/70 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-white/90 font-medium">
                                    {project.tags.map((tag, index) => (
                                        <React.Fragment
                                            key={tag.uid || tag.id || index}
                                        >
                                            <button
                                                onClick={() => {
                                                    // Navigate to tag details page
                                                    if (tag.uid) {
                                                        const slug = tag.name
                                                            .toLowerCase()
                                                            .replace(
                                                                /[^a-z0-9]+/g,
                                                                '-'
                                                            )
                                                            .replace(
                                                                /^-|-$/g,
                                                                ''
                                                            );
                                                        navigate(
                                                            `/tag/${tag.uid}-${slug}`
                                                        );
                                                    } else {
                                                        navigate(
                                                            `/tag/${encodeURIComponent(tag.name)}`
                                                        );
                                                    }
                                                }}
                                                className="hover:text-blue-200 transition-colors cursor-pointer"
                                            >
                                                {tag.name}
                                            </button>
                                            {index <
                                                (project.tags?.length || 0) -
                                                    1 && (
                                                <span className="text-white/60">
                                                    ,{' '}
                                                </span>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </span>
                            </BannerBadge>
                        )}

                        {/* Area Display */}
                        {(project.area || (project as any).Area) && (
                            <BannerBadge>
                                <Squares2X2Icon className="h-3 w-3 text-white/70 flex-shrink-0 mt-0.5" />
                                <button
                                    onClick={() => {
                                        // Use the correct area property (Area or area)
                                        const projectArea =
                                            project.area ||
                                            (project as any).Area;

                                        // Find the area in the areas store to get the uid
                                        const area = areas.find(
                                            (a) => a.id === projectArea.id
                                        );
                                        const areaUid = area?.uid;

                                        if (!areaUid) {
                                            console.warn(
                                                'Area uid not found for area id:',
                                                projectArea.id
                                            );
                                            return;
                                        }

                                        // Navigate to projects filtered by this area (same as Areas page)
                                        const areaSlug = projectArea.name
                                            .toLowerCase()
                                            .replace(/[^a-z0-9]+/g, '-')
                                            .replace(/^-|-$/g, '');
                                        navigate(
                                            `/projects?area=${areaUid}-${areaSlug}`
                                        );
                                    }}
                                    className="text-xs text-white/90 hover:text-blue-200 transition-colors cursor-pointer font-medium"
                                >
                                    {
                                        (project.area || (project as any).Area)
                                            ?.name
                                    }
                                </button>
                            </BannerBadge>
                        )}

                        {/* Shared Badge */}
                        {project.is_shared && (
                            <BannerBadge>
                                <ShareIcon className="h-3 w-3 text-green-500 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-white/90 font-medium">
                                    {t('projects.shared', 'Shared')}
                                </span>
                            </BannerBadge>
                        )}
                    </div>

                    {/* Edit/Delete Buttons - Bottom Right */}
                    <div className="absolute bottom-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                            ref={editButtonRef}
                            type="button"
                            className="p-2 bg-black bg-opacity-50 text-blue-400 hover:text-blue-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsConfirmDialogOpen(true);
                            }}
                            className="p-2 bg-black bg-opacity-50 text-red-400 hover:text-red-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Header with Tab Links and Controls */}
                <div className="mb-4">
                    {/* Mobile Layout */}
                    <div className="sm:hidden">
                        <div className="flex items-center justify-between mb-3">
                            {/* Tab Navigation Links */}
                            <div className="flex items-center space-x-6">
                                <button
                                    onClick={() => setActiveTab('tasks')}
                                    className={`flex items-center py-2 text-sm font-medium transition-colors ${
                                        activeTab === 'tasks'
                                            ? 'text-gray-900 dark:text-gray-100'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <span>{t('sidebar.tasks', 'Tasks')}</span>
                                    <span
                                        className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                            displayTasks.length > 0
                                                ? 'bg-gray-200 dark:bg-gray-600'
                                                : 'bg-transparent'
                                        }`}
                                        style={{
                                            minWidth: '20px',
                                            visibility:
                                                displayTasks.length > 0
                                                    ? 'visible'
                                                    : 'hidden',
                                        }}
                                    >
                                        {displayTasks.length > 0
                                            ? displayTasks.length
                                            : '0'}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setActiveTab('notes')}
                                    className={`flex items-center py-2 text-sm font-medium transition-colors ${
                                        activeTab === 'notes'
                                            ? 'text-gray-900 dark:text-gray-100'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                    }`}
                                >
                                    <span>{t('sidebar.notes', 'Notes')}</span>
                                    <span
                                        className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                                            notes.length > 0
                                                ? 'bg-gray-200 dark:bg-gray-600'
                                                : 'bg-transparent'
                                        }`}
                                        style={{
                                            minWidth: '20px',
                                            visibility:
                                                notes.length > 0
                                                    ? 'visible'
                                                    : 'hidden',
                                        }}
                                    >
                                        {notes.length > 0 ? notes.length : '0'}
                                    </span>
                                </button>
                            </div>

                            {/* Inline Controls - Always visible for tasks tab */}
                            {activeTab === 'tasks' && (
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                    {/* Show Completed Toggle */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                            Show completed
                                        </span>
                                        <button
                                            onClick={() =>
                                                handleShowCompletedChange(
                                                    !showCompleted
                                                )
                                            }
                                            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                                                showCompleted
                                                    ? 'bg-blue-600'
                                                    : 'bg-gray-200 dark:bg-gray-600'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                    showCompleted
                                                        ? 'translate-x-3.5'
                                                        : 'translate-x-0.5'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Sort Filter */}
                                    <SortFilterButton
                                        options={sortOptions}
                                        value={orderBy}
                                        onChange={handleSortChange}
                                        size="mobile"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden sm:flex items-center justify-between min-h-[2.5rem]">
                        {/* Tab Navigation Links */}
                        <div className="flex items-center space-x-6">
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                                    activeTab === 'tasks'
                                        ? 'text-gray-900 dark:text-gray-100'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <span>{t('sidebar.tasks', 'Tasks')}</span>
                                {displayTasks.length > 0 && (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                                        {displayTasks.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('notes')}
                                className={`flex items-center space-x-2 text-sm font-medium transition-colors ${
                                    activeTab === 'notes'
                                        ? 'text-gray-900 dark:text-gray-100'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <span>{t('sidebar.notes', 'Notes')}</span>
                                {notes.length > 0 && (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-600 rounded-full">
                                        {notes.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Inline Controls - Always visible for tasks tab */}
                        {activeTab === 'tasks' && (
                            <div className="flex items-center gap-4">
                                {/* Show Completed Toggle */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                        Show completed
                                    </span>
                                    <button
                                        onClick={() =>
                                            handleShowCompletedChange(
                                                !showCompleted
                                            )
                                        }
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
                                    </button>
                                </div>

                                {/* Sort Filter */}
                                <SortFilterButton
                                    options={sortOptions}
                                    value={orderBy}
                                    onChange={handleSortChange}
                                    size="desktop"
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Auto-suggest form for tasks with no items */}
                {activeTab === 'tasks' && showAutoSuggestForm && (
                    <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0 mb-6">
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
                        />
                    </div>
                )}

                {/* Tasks Tab Content */}
                {activeTab === 'tasks' && (
                    <>
                        <div
                            className={`transition-all duration-300 ease-in-out overflow-hidden mb-1.5 ${
                                !showAutoSuggestForm
                                    ? 'opacity-100 max-h-96 transform translate-y-0'
                                    : 'opacity-0 max-h-0 transform -translate-y-2'
                            }`}
                        >
                            <NewTask onTaskCreate={handleTaskCreate} />
                        </div>

                        <div className="transition-all duration-300 ease-in-out overflow-visible">
                            {displayTasks.length > 0 ? (
                                <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0 overflow-visible">
                                    <TaskList
                                        tasks={displayTasks}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskDelete={handleTaskDelete}
                                        projects={allProjects}
                                        hideProjectName={true}
                                        onToggleToday={handleToggleToday}
                                        showCompletedTasks={showCompleted}
                                    />
                                </div>
                            ) : (
                                <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                                    <p className="text-gray-500 dark:text-gray-400">
                                        {showCompleted
                                            ? t(
                                                  'project.noCompletedTasks',
                                                  'No completed tasks.'
                                              )
                                            : t('project.noTasks', 'No tasks.')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Notes Content */}
                {activeTab === 'notes' && (
                    <div className="transition-all duration-300 ease-in-out">
                        {notes.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {notes.map((note) => (
                                    <NoteCard
                                        key={note.uid}
                                        note={note}
                                        onEdit={handleEditNote}
                                        onDelete={(note) => {
                                            setNoteToDelete(note);
                                            setIsConfirmDialogOpen(true);
                                        }}
                                        showActions={true}
                                        showProject={false}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-gray-500 dark:text-gray-400">
                                <p>
                                    {t(
                                        'project.noNotes',
                                        'No notes for this project.'
                                    )}
                                </p>
                                <button
                                    type="button"
                                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                    onClick={() => {
                                        if (!project?.id || !project.name)
                                            return;
                                        setSelectedNote({
                                            title: '',
                                            content: '',
                                            tags: [],
                                            project_id: project.id,
                                            project: {
                                                id: project.id,
                                                name: project.name,
                                                uid: project.uid,
                                            },
                                            project_uid: project.uid,
                                        });
                                        setIsNoteModalOpen(true);
                                    }}
                                >
                                    <PlusCircleIcon className="h-5 w-5" />
                                    {t('noteCreation', 'Create New Note')}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <ProjectModal
                    isOpen={isModalOpen}
                    onClose={closeModal}
                    onSave={handleSaveProject}
                    project={project}
                    areas={areas}
                />

                {/* NoteModal */}
                <NoteModal
                    isOpen={isNoteModalOpen}
                    onClose={() => {
                        setIsNoteModalOpen(false);
                        setSelectedNote(null);
                    }}
                    onSave={handleSaveNote}
                    note={selectedNote}
                    projects={allProjects}
                />

                {isConfirmDialogOpen && noteToDelete && (
                    <ConfirmDialog
                        title="Delete Note"
                        message={`Are you sure you want to delete the note "${noteToDelete.title}"?`}
                        onConfirm={() => {
                            const identifier =
                                noteToDelete?.uid ??
                                (noteToDelete?.id !== undefined
                                    ? String(noteToDelete.id)
                                    : null);

                            if (identifier) {
                                handleDeleteNote(identifier);
                            }
                        }}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setNoteToDelete(null);
                        }}
                    />
                )}
                {isConfirmDialogOpen && !noteToDelete && (
                    <ConfirmDialog
                        title={t(
                            'modals.deleteProject.title',
                            'Delete Project'
                        )}
                        message={t(
                            'modals.deleteProject.message',
                            'Deleting this project will remove the project only. All items inside will be retained but will no longer belong to any project. Continue?'
                        )}
                        onConfirm={handleDeleteProject}
                        onCancel={() => setIsConfirmDialogOpen(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default ProjectDetails;
