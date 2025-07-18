import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Shared/ToastContext';
import {
    PencilSquareIcon,
    TrashIcon,
    FolderIcon,
    ChevronDownIcon,
    BarsArrowUpIcon,
} from '@heroicons/react/24/outline';
import TaskList from '../Task/TaskList';
import ProjectModal from '../Project/ProjectModal';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from '../Note/NoteModal';
import { useStore } from '../../store/useStore';
import NewTask from '../Task/NewTask';
import { Project } from '../../entities/Project';
import NoteCard from '../Shared/NoteCard';
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
import {
    updateNote,
    deleteNote as apiDeleteNote,
} from '../../utils/notesService';
import { isAuthError } from '../../utils/authUtils';
// import { getAutoSuggestNextActionsEnabled } from '../../utils/profileService';
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
    const location = useLocation();
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();

    // Using local state to avoid infinite loops
    const areas = useStore((state) => state.areasStore.areas);
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showAutoSuggestForm, setShowAutoSuggestForm] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
    const [orderBy, setOrderBy] = useState<string>('created_at:desc');
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Note modal state
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);

    // Dispatch global modal events


    // Temporarily disable auto-suggest to isolate profile request issue
    // TODO: Re-enable after fixing profile request issue
    // useEffect(() => {
    //     const fetchAutoSuggestSetting = async () => {
    //         if (!hasCheckedAutoSuggest.current) {
    //             hasCheckedAutoSuggest.current = true;
    //             const enabled = await getAutoSuggestNextActionsEnabled();
    //             setAutoSuggestEnabled(enabled);
    //         }
    //     };
        
    //     fetchAutoSuggestSetting();
    // }, []);

    // Check if we should show auto-suggest form for projects with no tasks
    useEffect(() => {
        // Temporarily disable auto-suggest functionality
        setShowAutoSuggestForm(false);
        // if (project && tasks.length === 0 && !loading && !showCompleted && autoSuggestEnabled) {
        //     setShowAutoSuggestForm(true);
        // } else {
        //     setShowAutoSuggestForm(false);
        // }
    }, [project, tasks.length, loading, showCompleted]);

    // Load sort order and show completed from URL parameters
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const sortParam = urlParams.get('sort') || localStorage.getItem('project_order_by') || 'created_at:desc';
        const showCompletedParam = urlParams.get('completed') === 'true';
        
        setOrderBy(sortParam);
        setShowCompleted(showCompletedParam);
    }, [location.search]);

    // Fetch project data when id or URL parameters change
    useEffect(() => {
        if (!id) return;
        
        const loadProjectData = async () => {
            try {
                // Only show loading if we don't have any project data yet
                if (!project) {
                    setLoading(true);
                }
                setError(false);
                
                const urlParams = new URLSearchParams(location.search);
                const sortParam = urlParams.get('sort') || localStorage.getItem('project_order_by') || 'created_at:desc';
                                
                console.log(`Fetching ONLY project ${id} with fetchProjectById`);
                const projectData = await fetchProjectById(id, {
                    sort: sortParam
                    // Remove completed parameter since backend filtering isn't working
                });
                console.log('ProjectDetails received project data:', projectData);
                
                
                setProject(projectData);
                setTasks(projectData.tasks || projectData.Tasks || []);
                const fetchedNotes = projectData.notes || projectData.Notes || [];
                
                // Normalize tags field - backend returns 'Tags' but frontend expects 'tags'
                const normalizedNotes = fetchedNotes.map(note => {
                    if (note.Tags && !note.tags) {
                        note.tags = note.Tags;
                    }
                    return note;
                });
                
                setNotes(normalizedNotes);
                setLoading(false);
            } catch (error) {
                setError(true);
                setLoading(false);
            }
        };
        
        loadProjectData();
    }, [id, location.search]);

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
            throw new Error('Cannot create task: Project is missing');
        }

        try {
            const newTask = await createTask({
                name: taskName,
                status: 'not_started',
                project_id: project.id,
            });
            setTasks([...tasks, newTask]);

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
                throw new Error('Failed to update task');
            }

            const savedTask = await response.json();
            setTasks(
                tasks.map((task) =>
                    task.id === updatedTask.id ? savedTask : task
                )
            );
        } catch (err) {
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
        } catch (err) {
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
        } catch (error) {
            // Optionally refetch data on error to ensure consistency
            if (id) {
                const urlParams = new URLSearchParams(location.search);
                const sortParam = urlParams.get('sort') || 'created_at:desc';
                
                // Refetch project data on error to ensure consistency
                try {
                    const projectData = await fetchProjectById(id, {
                        sort: sortParam
                        // Remove completed parameter since backend filtering isn't working
                    });
                    setProject(projectData);
                    setTasks(projectData.tasks || projectData.Tasks || []);
                    const fetchedNotes = projectData.notes || projectData.Notes || [];
                    
                    // Normalize tags field - backend returns 'Tags' but frontend expects 'tags'
                    const normalizedNotes = fetchedNotes.map(note => {
                        if (note.Tags && !note.tags) {
                            note.tags = note.Tags;
                        }
                        return note;
                    });
                    
                    setNotes(normalizedNotes);
                } catch (fetchError) {
                    // Error refetching project data - silently handled
                }
            }
        }
    };

    const handleEditProject = () => {
        setIsModalOpen(true);
    };

    const handleSaveProject = async (updatedProject: Project) => {
        if (!updatedProject.id) {
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
                status: 'not_started',
                project_id: projectId,
                priority: 'medium',
            });

            // Update the tasks list to include the new task
            setTasks([...tasks, newTask]);
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
            // Error creating next action - silently handled
        }
    };

    const handleSkipNextAction = () => {
        setShowAutoSuggestForm(false);
    };

    const handleSortChange = (order: string) => {
        setOrderBy(order);
        localStorage.setItem('project_order_by', order);
        setDropdownOpen(false);
        
        // Update URL parameters
        const urlParams = new URLSearchParams(location.search);
        urlParams.set('sort', order);
        navigate(`${location.pathname}?${urlParams.toString()}`, { replace: true });
    };

    const handleShowCompletedChange = (checked: boolean) => {
        setShowCompleted(checked);
        
        // Update URL parameters
        const urlParams = new URLSearchParams(location.search);
        if (checked) {
            urlParams.set('completed', 'true');
        } else {
            urlParams.delete('completed');
        }
        navigate(`${location.pathname}?${urlParams.toString()}`, { replace: true });
    };

    const capitalize = (str: string) =>
        str.charAt(0).toUpperCase() + str.slice(1);

    const handleDeleteProject = async () => {
        if (!project?.id) {
            return;
        }

        try {
            await deleteProject(project.id);
            navigate('/projects');
        } catch (err) {
            // Error deleting project - silently handled
        }
    };

    // Note handlers
    const handleEditNote = (note: Note) => {
        setSelectedNote(note);
        setIsNoteModalOpen(true);
    };

    const handleDeleteNote = async (noteId: number) => {
        try {
            await apiDeleteNote(noteId);
            setNotes(notes.filter(n => n.id !== noteId));
            setNoteToDelete(null);
            setIsConfirmDialogOpen(false);
        } catch (err) {
            // Error deleting note - silently handled
        }
    };

    const handleUpdateNote = async (noteData: Partial<Note>) => {
        try {
            if (selectedNote?.id) {
                const updatedNote = await updateNote(selectedNote.id, noteData as Note);
                
                // Normalize tags field - backend returns 'Tags' but frontend expects 'tags'
                if (updatedNote.Tags && !updatedNote.tags) {
                    updatedNote.tags = updatedNote.Tags;
                }
                
                setNotes(notes.map(n => n.id === selectedNote.id ? updatedNote : n));
                setIsNoteModalOpen(false);
                setSelectedNote(null);
            }
        } catch (err) {
            // Error updating note - silently handled
        }
    };

    // Filter and sort tasks (backend filtering/sorting not working reliably)
    const displayTasks = useMemo(() => {
        
        // First, filter tasks based on completed state
        let filteredTasks;
        if (showCompleted) {
            // Show only completed tasks (done=2 or archived=3)
            filteredTasks = tasks.filter(task => 
                task.status === 'done' || task.status === 'archived' || 
                task.status === 2 || task.status === 3
            );
        } else {
            // Show only non-completed tasks (not_started=0, in_progress=1)
            filteredTasks = tasks.filter(task => 
                task.status === 'not_started' || task.status === 'in_progress' ||
                task.status === 0 || task.status === 1
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
                    const priorityMap = { 'high': 2, 'medium': 1, 'low': 0 };
                    valueA = typeof a.priority === 'string' ? priorityMap[a.priority] || 0 : (a.priority || 0);
                    valueB = typeof b.priority === 'string' ? priorityMap[b.priority] || 0 : (b.priority || 0);
                    break;
                }
                case 'status':
                    valueA = typeof a.status === 'string' ? a.status : a.status || 0;
                    valueB = typeof b.status === 'string' ? b.status : b.status || 0;
                    break;
                case 'created_at':
                default:
                    valueA = a.created_at ? new Date(a.created_at).getTime() : 0;
                    valueB = b.created_at ? new Date(b.created_at).getTime() : 0;
                    break;
            }
            
            if (valueA < valueB) return isAsc ? -1 : 1;
            if (valueA > valueB) return isAsc ? 1 : -1;
            return 0;
        });
        
        
        return sortedTasks;
    }, [tasks, showCompleted, orderBy]);

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
                <div className="text-red-500 text-lg">Failed to load project details.</div>
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
                {/* Project Banner Image */}
                {project.image_url && (
                    <div className="mb-6 rounded-lg overflow-hidden relative group">
                        <img
                            src={project.image_url}
                            alt={project.name}
                            className="w-full h-64 object-cover"
                        />
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
                        {/* Edit/Delete Buttons on Image - Show only on hover */}
                        <div className="absolute bottom-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <button
                                onClick={handleEditProject}
                                className="p-2 bg-black bg-opacity-50 text-blue-400 hover:text-blue-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                            >
                                <PencilSquareIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setIsConfirmDialogOpen(true)}
                                className="p-2 bg-black bg-opacity-50 text-red-400 hover:text-red-300 hover:bg-opacity-70 rounded-full transition-all duration-200 backdrop-blur-sm"
                            >
                                <TrashIcon className="h-5 w-5" />
                            </button>
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
                    <div className="mb-4">
                        {/* Mobile Layout */}
                        <div className="sm:hidden">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                        {t('sidebar.tasks', 'Tasks')}
                                    </h3>
                                </div>
                                <div className="flex flex-col items-end space-y-2">
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
                                                    handleShowCompletedChange(
                                                        e.target.checked
                                                    )
                                                }
                                                className="sr-only"
                                            />
                                            <div
                                                className={`w-10 h-5 rounded-full transition-all duration-300 ease-in-out ${
                                                    showCompleted
                                                        ? 'bg-blue-500 shadow-lg'
                                                        : 'bg-gray-300 dark:bg-gray-600'
                                                }`}
                                            >
                                                <div
                                                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all duration-300 ease-in-out ${
                                                        showCompleted
                                                            ? 'translate-x-5 scale-110'
                                                            : 'translate-x-0.5 scale-100'
                                                    } translate-y-0.5`}
                                                ></div>
                                            </div>
                                        </div>
                                    </label>
                                    {/* Sort Dropdown */}
                                    <div
                                        className="relative inline-block text-left"
                                        ref={dropdownRef}
                                    >
                                        <button
                                            type="button"
                                            className="inline-flex justify-center w-40 rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-2 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                                            id="menu-button"
                                            aria-expanded={dropdownOpen}
                                            aria-haspopup="true"
                                            onClick={() =>
                                                setDropdownOpen(!dropdownOpen)
                                            }
                                        >
                                            <BarsArrowUpIcon className="h-5 w-5 text-gray-500" />
                                            <ChevronDownIcon className="h-4 w-4 ml-1 text-gray-500 dark:text-gray-300" />
                                        </button>

                                        {dropdownOpen && (
                                            <div
                                                className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50"
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
                                                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left transition-colors"
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
                        </div>
                        
                        {/* Desktop Layout */}
                        <div className="hidden sm:flex items-center justify-between">
                            <div className="flex items-center">
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    {t('sidebar.tasks', 'Tasks')}
                                </h3>
                            </div>
                            <div className="flex items-center space-x-3">
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
                                                    handleShowCompletedChange(
                                                        e.target.checked
                                                    )
                                                }
                                                className="sr-only"
                                            />
                                            <div
                                                className={`w-10 h-5 rounded-full transition-all duration-300 ease-in-out ${
                                                    showCompleted
                                                        ? 'bg-blue-500 shadow-lg'
                                                        : 'bg-gray-300 dark:bg-gray-600'
                                                }`}
                                            >
                                                <div
                                                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-all duration-300 ease-in-out ${
                                                        showCompleted
                                                            ? 'translate-x-5 scale-110'
                                                            : 'translate-x-0.5 scale-100'
                                                    } translate-y-0.5`}
                                                ></div>
                                            </div>
                                        </div>
                                </label>

                                {/* Sort Dropdown */}
                                <div
                                    className="relative inline-block text-left"
                                    ref={dropdownRef}
                                >
                                    <button
                                        type="button"
                                        className="inline-flex justify-center w-40 rounded-md border border-gray-300 dark:border-gray-700 shadow-sm px-2 py-2 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none"
                                        id="menu-button-desktop"
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
                                            className="origin-top-right absolute right-0 mt-2 w-40 rounded-md shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none z-50"
                                            role="menu"
                                            aria-orientation="vertical"
                                            aria-labelledby="menu-button-desktop"
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
                                                        className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 w-full text-left transition-colors"
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
                    </div>
                )}

                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    !showAutoSuggestForm && !showCompleted
                        ? 'opacity-100 max-h-96 transform translate-y-0'
                        : 'opacity-0 max-h-0 transform -translate-y-2'
                }`}>
                    <NewTask onTaskCreate={handleTaskCreate} />
                </div>

                <div className="transition-all duration-300 ease-in-out">
                    {displayTasks.length > 0 ? (
                        <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                            <TaskList
                                key={`${showCompleted}-${displayTasks.length}`}
                                tasks={displayTasks}
                                onTaskUpdate={handleTaskUpdate}
                                onTaskDelete={handleTaskDelete}
                                projects={project ? [project] : []}
                                hideProjectName={true}
                                onToggleToday={handleToggleToday}
                            />
                        </div>
                    ) : showAutoSuggestForm ? (
                        <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
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
                        </div>
                    ) : (
                        <div className="transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
                            <p className="text-gray-500 dark:text-gray-400">
                                {showCompleted
                                    ? t('project.noCompletedTasks', 'No completed tasks.')
                                    : t('project.noTasks', 'No tasks.')
                                }
                            </p>
                        </div>
                    )}
                </div>

                {/* Notes Section */}
                <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                        {t('sidebar.notes', 'Notes')}
                    </h3>

                    {notes.length > 0 ? (
                        <div className="space-y-1">
                            {notes.map((note) => (
                                <NoteCard
                                    key={note.id}
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

                {/* NoteModal */}
                {isNoteModalOpen && (
                    <NoteModal
                        isOpen={isNoteModalOpen}
                        onClose={() => {
                            setIsNoteModalOpen(false);
                            setSelectedNote(null);
                        }}
                        onSave={handleUpdateNote}
                        note={selectedNote}
                        projects={[]}
                    />
                )}

                {isConfirmDialogOpen && noteToDelete && (
                    <ConfirmDialog
                        title="Delete Note"
                        message={`Are you sure you want to delete the note "${noteToDelete.title}"?`}
                        onConfirm={() => handleDeleteNote(noteToDelete.id!)}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setNoteToDelete(null);
                        }}
                    />
                )}
                {isConfirmDialogOpen && !noteToDelete && (
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
