import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    MagnifyingGlassIcon,
    LightBulbIcon,
    ClipboardDocumentListIcon,
    PlayIcon,
    ExclamationTriangleIcon,
    CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ProjectModal from './ProjectModal';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteModal from '../Note/NoteModal';
import { useStore } from '../../store/useStore';
import { Project } from '../../entities/Project';
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
import IconSortDropdown from '../Shared/IconSortDropdown';
import LoadingSpinner from '../Shared/LoadingSpinner';
import { usePersistedModal } from '../../hooks/usePersistedModal';
import { getApiPath } from '../../config/paths';
import AutoSuggestNextActionBox from './AutoSuggestNextActionBox';
import ProjectInsightsPanel from './ProjectInsightsPanel';
import ProjectBanner from './ProjectBanner';
import ProjectTasksSection from './ProjectTasksSection';
import ProjectNotesSection from './ProjectNotesSection';
import { useProjectMetrics } from './useProjectMetrics';

const ProjectDetails: React.FC = () => {
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showSuccessToast } = useToast();
    const { areasStore, projectsStore } = useStore();
    const areas = areasStore.areas;
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
    const [showCompleted, setShowCompleted] = useState(false);
    const [showAutoSuggestForm, setShowAutoSuggestForm] = useState(false);
    const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(false);
    const hasCheckedAutoSuggest = useRef(false);
    const [orderBy, setOrderBy] = useState<string>('status:inProgressFirst');
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const {
        isOpen: isModalOpen,
        openModal,
        closeModal,
    } = usePersistedModal(project?.id);
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const sortOptions = useMemo(
        () => [
            { value: 'status:inProgressFirst', label: t('tasks.status', 'Status') },
            { value: 'created_at:desc', label: 'Created at' },
            { value: 'due_date:asc', label: 'Due date' },
            { value: 'priority:desc', label: 'Priority' },
        ],
        [t]
    );

    useEffect(() => {
        if (!areasStore.hasLoaded && !areasStore.isLoading) {
            areasStore.loadAreas();
        }
    }, [areasStore]);

    useEffect(() => {
        if (!hasCheckedAutoSuggest.current) {
            hasCheckedAutoSuggest.current = true;
            getAutoSuggestNextActionsEnabled().then(setAutoSuggestEnabled);
        }
    }, []);

    useEffect(() => {
        if (allProjects.length === 0) {
            fetchProjects().then(setAllProjects).catch(() => undefined);
        }
    }, [allProjects.length]);

    useEffect(() => {
        const storedSort = localStorage.getItem('project_order_by');
        const defaultSort = 'status:inProgressFirst';
        if (!storedSort || storedSort === 'created_at:desc') {
            setOrderBy(defaultSort);
            localStorage.setItem('project_order_by', defaultSort);
        } else {
            setOrderBy(storedSort);
        }
        const savedShowCompleted = localStorage.getItem('project_show_completed');
        if (savedShowCompleted !== null) {
            setShowCompleted(JSON.parse(savedShowCompleted));
        }
    }, []);

    useEffect(() => {
        if (!uidSlug) return;
        const loadProjectData = async () => {
            try {
                if (!project) setLoading(true);
                setError(false);
                const projectData = await fetchProjectBySlug(uidSlug);
                setProject(projectData);
                setTasks(projectData.tasks || projectData.Tasks || []);
                const savedShowCompleted = localStorage.getItem('project_show_completed');
                if (savedShowCompleted === null && projectData.task_show_completed !== undefined) {
                    setShowCompleted(projectData.task_show_completed);
                }
                const savedSort = localStorage.getItem('project_order_by');
                if (!savedSort && projectData.task_sort_order) {
                    setOrderBy(projectData.task_sort_order);
                }
                const fetchedNotes = projectData.notes || projectData.Notes || [];
                setNotes(
                    fetchedNotes.map((note) => {
                        if (note.Tags && !note.tags) note.tags = note.Tags;
                        return note;
                    })
                );
                setLoading(false);
            } catch {
                setError(true);
                setLoading(false);
            }
        };
        loadProjectData();
    }, [uidSlug]);

    useEffect(() => {
        const button = editButtonRef.current;
        if (!button) return;
        const handleClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            openModal();
        };
        button.addEventListener('click', handleClick);
        return () => button.removeEventListener('click', handleClick);
    }, [openModal]);

    useEffect(() => {
        if (project && tasks.length === 0 && !loading && !showCompleted && autoSuggestEnabled) {
            setShowAutoSuggestForm(true);
        } else {
            setShowAutoSuggestForm(false);
        }
    }, [project, tasks.length, loading, showCompleted, autoSuggestEnabled]);

    const handleTaskCreate = async (taskName: string) => {
        if (!project) throw new Error('Cannot create task: Project is missing');
        const newTask = await createTask({
            name: taskName,
            status: 0,
            project_id: project.id,
            completed_at: null,
        });
        setTasks([...tasks, newTask]);
        const taskLink = (
            <span>
                {t('task.created', 'Task')}{' '}
                <a href={`/task/${newTask.uid}`} className="text-green-200 underline hover:text-green-100">
                    {newTask.name}
                </a>{' '}
                {t('task.createdSuccessfully', 'created successfully!')}
            </span>
        );
        showSuccessToast(taskLink);
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        if (!updatedTask.id) return;
        const hasUpdatedData = updatedTask.parent_child_logic_executed !== undefined;
        if (hasUpdatedData) {
            setTasks((prev) =>
                prev.map((task) =>
                    task.id === updatedTask.id
                        ? {
                              ...task,
                              ...updatedTask,
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
        const response = await fetch(getApiPath(`task/${updatedTask.id}`), {
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
        const savedTaskProjectId = savedTask.project_id ?? null;
        const currentProjectId = project?.id ?? null;
        if (savedTaskProjectId !== currentProjectId) {
            setTasks(tasks.filter((task) => task.id !== updatedTask.id));
        } else {
            setTasks((prev) =>
                prev.map((task) =>
                    task.id === updatedTask.id
                        ? {
                              ...task,
                              ...savedTask,
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
    };

    const handleTaskDelete = async (taskId: number | undefined) => {
        if (!taskId) return;
        await deleteTask(taskId);
        setTasks(tasks.filter((task) => task.id !== taskId));
    };

    const handleTaskCompletionToggle = (updatedTask: Task) => {
        if (!updatedTask.id) return;
        setTasks((prev) =>
            prev.map((task) =>
                task.id === updatedTask.id
                    ? {
                          ...task,
                          ...updatedTask,
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
    };

    const handleToggleToday = async (taskId: number, task?: Task) => {
        try {
            const updatedTask = await toggleTaskToday(taskId, task);
            setTasks((prev) =>
                prev.map((t) =>
                    t.id === taskId
                        ? { ...t, today: updatedTask.today, today_move_count: updatedTask.today_move_count }
                        : t
                )
            );
        } catch {
            if (!uidSlug) return;
            try {
                const projectData = await fetchProjectBySlug(uidSlug);
                setProject(projectData);
                setTasks(projectData.tasks || projectData.Tasks || []);
                const fetchedNotes = projectData.notes || projectData.Notes || [];
                setNotes(
                    fetchedNotes.map((note) => {
                        if (note.Tags && !note.tags) note.tags = note.Tags;
                        return note;
                    })
                );
            } catch {
                // silent
            }
        }
    };

    const handleSaveProject = async (updatedProject: Project) => {
        if (!updatedProject.uid) return;
        const savedProject = await updateProject(updatedProject.uid, updatedProject);
        setProject((prev) => ({
            ...savedProject,
            area: savedProject.area || prev?.area,
            Area: (savedProject as any).Area || (prev as any)?.Area,
        }));
        closeModal();
    };

    const handleCreateNextAction = async (projectId: number, actionDescription: string) => {
        const newTask = await createTask({
            name: actionDescription,
            status: 0,
            project_id: projectId,
            priority: 0,
            completed_at: null,
        });
        setTasks([...tasks, newTask]);
        setShowAutoSuggestForm(false);
        const taskLink = (
            <span>
                {t('task.created', 'Task')}{' '}
                <a href={`/task/${newTask.uid}`} className="text-green-200 underline hover:text-green-100">
                    {newTask.name}
                </a>{' '}
                {t('task.createdSuccessfully', 'created successfully!')}
            </span>
        );
        showSuccessToast(taskLink);
    };

    const handleSkipNextAction = () => setShowAutoSuggestForm(false);

    const saveProjectPreferences = async (showCompletedValue: boolean, orderValue: string) => {
        if (!project?.id) return;
        try {
            const response = await fetch(getApiPath(`project/${project.id}`), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    task_show_completed: showCompletedValue,
                    task_sort_order: orderValue,
                }),
            });
            if (!response.ok) throw new Error('Failed to save project preferences');
        } catch (err) {
            console.error('Error saving project preferences:', err);
        }
    };

    const handleShowCompletedChange = (checked: boolean) => {
        setShowCompleted(checked);
        localStorage.setItem('project_show_completed', JSON.stringify(checked));
        saveProjectPreferences(checked, orderBy);
    };

    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
        localStorage.setItem('project_order_by', newOrderBy);
        saveProjectPreferences(showCompleted, newOrderBy);
    };

    const handleDeleteProject = async () => {
        if (!project?.uid) return;
        await deleteProject(project.uid);
        const updatedProjects = projectsStore.projects.filter((p) => p.uid !== project.uid);
        projectsStore.setProjects(updatedProjects);
        navigate('/projects');
    };

    const handleEditNote = async (note: Note) => {
        try {
            const response = await fetch(getApiPath(`note/${note.uid}`), {
                credentials: 'include',
                headers: { Accept: 'application/json' },
            });
            if (response.ok) {
                const fullNote = await response.json();
                setSelectedNote(fullNote);
            } else {
                setSelectedNote(note);
            }
        } catch (error) {
            console.error('Error fetching note details:', error);
            setSelectedNote(note);
        }
        setIsNoteModalOpen(true);
    };

    const handleDeleteNote = async (noteIdentifier: string) => {
        await apiDeleteNote(noteIdentifier);
        setNotes(
            notes.filter((n) => {
                const currentIdentifier = n.uid ?? (n.id !== undefined ? String(n.id) : undefined);
                return currentIdentifier !== noteIdentifier;
            })
        );
        const globalNotes = useStore.getState().notesStore.notes;
        useStore
            .getState()
            .notesStore.setNotes(
                globalNotes.filter((note) => {
                    const currentIdentifier = note.uid ?? (note.id !== undefined ? String(note.id) : undefined);
                    return currentIdentifier !== noteIdentifier;
                })
            );
        setNoteToDelete(null);
        setIsConfirmDialogOpen(false);
    };

    const handleSaveNote = async (noteData: Note) => {
        try {
            let savedNote: Note;
            const noteIdentifier = noteData.uid ?? (noteData.id !== undefined ? String(noteData.id) : null);
            let isUpdate = false;
            if (noteIdentifier) {
                savedNote = await updateNote(noteIdentifier, noteData);
                isUpdate = true;
            } else {
                savedNote = await createNote(noteData);
            }
            if ((savedNote as any).Tags && !(savedNote as any).tags) {
                (savedNote as any).tags = (savedNote as any).Tags;
            }
            const savedNoteProjectId = savedNote.project_id ?? null;
            const currentProjectId = project?.id ?? null;
            if (savedNote.id && savedNoteProjectId !== currentProjectId) {
                setNotes(notes.filter((n) => n.id !== savedNote.id));
                const globalNotes = useStore.getState().notesStore.notes;
                useStore
                    .getState()
                    .notesStore.setNotes(globalNotes.map((note) => (note.uid === savedNote.uid ? savedNote : note)));
            } else if (isUpdate) {
                const savedIdentifier = savedNote.uid ?? (savedNote.id !== undefined ? String(savedNote.id) : null);
                setNotes(
                    notes.map((n) => {
                        const currentIdentifier = n.uid ?? (n.id !== undefined ? String(n.id) : undefined);
                        return currentIdentifier === savedIdentifier ? savedNote : n;
                    })
                );
                const globalNotes = useStore.getState().notesStore.notes;
                useStore
                    .getState()
                    .notesStore.setNotes(globalNotes.map((note) => (note.uid === savedNote.uid ? savedNote : note)));
            } else {
                setNotes([savedNote, ...notes]);
                const globalNotes = useStore.getState().notesStore.notes;
                useStore.getState().notesStore.setNotes([savedNote, ...globalNotes]);
            }
            setIsNoteModalOpen(false);
            setSelectedNote(null);
        } catch {
            // silent
        }
    };

    const displayTasks = useMemo(() => {
        let filteredTasks;
        if (showCompleted) {
            filteredTasks = tasks.filter(
                (task) =>
                    task.status === 'done' ||
                    task.status === 'archived' ||
                    task.status === 2 ||
                    task.status === 3
            );
        } else {
            filteredTasks = tasks.filter(
                (task) =>
                    task.status === 'not_started' ||
                    task.status === 'in_progress' ||
                    task.status === 0 ||
                    task.status === 1
            );
        }
        if (taskSearchQuery.trim()) {
            const query = taskSearchQuery.toLowerCase();
            filteredTasks = filteredTasks.filter(
                (task) =>
                    task.name.toLowerCase().includes(query) ||
                    task.original_name?.toLowerCase().includes(query) ||
                    task.note?.toLowerCase().includes(query)
            );
        }
        const getStatusRank = (status: Task['status']) => {
            if (status === 'in_progress' || status === 1) return 0;
            if (status === 'not_started' || status === 0) return 1;
            if (status === 'waiting' || status === 4) return 2;
            if (status === 'done' || status === 2) return 3;
            if (status === 'archived' || status === 3) return 4;
            return 5;
        };
        return [...filteredTasks].sort((a, b) => {
            if (orderBy === 'status:inProgressFirst') {
                const rankA = getStatusRank(a.status);
                const rankB = getStatusRank(b.status);
                if (rankA !== rankB) return rankA - rankB;
                const dueA = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                const dueB = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
                if (dueA !== dueB) return dueA - dueB;
                return (a.id || 0) - (b.id || 0);
            }
            const [field, direction] = orderBy.split(':');
            const isAsc = direction === 'asc';
            const compare = (valueA: any, valueB: any) => {
                if (valueA < valueB) return isAsc ? -1 : 1;
                if (valueA > valueB) return isAsc ? 1 : -1;
                return 0;
            };
            switch (field) {
                case 'name':
                    return compare(a.name?.toLowerCase() || '', b.name?.toLowerCase() || '');
                case 'due_date':
                    return compare(
                        a.due_date ? new Date(a.due_date).getTime() : 0,
                        b.due_date ? new Date(b.due_date).getTime() : 0
                    );
                case 'priority': {
                    const priorityMap = { high: 2, medium: 1, low: 0 };
                    const valueA = typeof a.priority === 'string' ? priorityMap[a.priority] || 0 : a.priority || 0;
                    const valueB = typeof b.priority === 'string' ? priorityMap[b.priority] || 0 : b.priority || 0;
                    return compare(valueA, valueB);
                }
                case 'status':
                    return compare(
                        typeof a.status === 'string' ? a.status : a.status || 0,
                        typeof b.status === 'string' ? b.status : b.status || 0
                    );
                case 'created_at':
                default:
                    return compare(
                        a.created_at ? new Date(a.created_at).getTime() : 0,
                        b.created_at ? new Date(b.created_at).getTime() : 0
                    );
            }
        });
    }, [tasks, showCompleted, orderBy, taskSearchQuery]);

    const {
        taskStats,
        completionGradient,
        dueBuckets,
        dueHighlights,
        nextBestAction,
        getDueDescriptor,
        handleStartNextAction,
        completionTrend,
        upcomingDueTrend,
        createdTrend,
        upcomingInsights,
        eisenhower,
        weeklyPace,
        monthlyCompleted,
    } = useProjectMetrics(tasks, handleTaskUpdate, t);

    const getStateIcon = (state: string) => {
        switch (state) {
            case 'idea':
                return <LightBulbIcon className="h-3 w-3 text-yellow-500 flex-shrink-0 mt-0.5" />;
            case 'planned':
                return <ClipboardDocumentListIcon className="h-3 w-3 text-blue-500 flex-shrink-0 mt-0.5" />;
            case 'in_progress':
                return <PlayIcon className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />;
            case 'blocked':
                return <ExclamationTriangleIcon className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />;
            case 'completed':
                return <CheckCircleIcon className="h-3 w-3 text-gray-500 flex-shrink-0 mt-0.5" />;
            default:
                return <PlayIcon className="h-3 w-3 text-white/70 flex-shrink-0 mt-0.5" />;
        }
    };

    if (loading) return <LoadingSpinner message="Loading project details..." />;
    if (error)
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">Failed to load project details.</div>
            </div>
        );
    if (!project)
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">Project not found.</div>
            </div>
        );

    const renderShowCompletedToggle = () => (
        <button
            type="button"
            onClick={() => handleShowCompletedChange(!showCompleted)}
            className="w-full flex items-center justify-between text-sm text-gray-700 dark:text-gray-300"
            aria-pressed={showCompleted}
        >
            <span>{t('common.showCompleted', 'Show completed')}</span>
            <span
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    showCompleted ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showCompleted ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                />
            </span>
        </button>
    );

    return (
        <div className="w-full pb-12">
            <ProjectBanner
                project={project}
                areas={areas}
                t={t}
                getStateIcon={getStateIcon}
                onDeleteClick={() => {
                    setNoteToDelete(null);
                    setIsConfirmDialogOpen(true);
                }}
                editButtonRef={editButtonRef}
            />

            <div className="w-full px-4 sm:px-6 lg:px-10">
                <div className="w-full">
                    <div className="mb-4">
                        <div className="hidden sm:flex items-center justify-between min-h-[2.5rem]">
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

                            {activeTab === 'tasks' && (
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setIsSearchExpanded((v) => !v)}
                                        className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-lg p-2 ${
                                            isSearchExpanded
                                                ? 'bg-blue-50/70 dark:bg-blue-900/20'
                                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                        aria-expanded={isSearchExpanded}
                                        aria-label={
                                            isSearchExpanded ? 'Collapse search panel' : 'Show search input'
                                        }
                                    >
                                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                                    </button>
                                    <IconSortDropdown
                                        options={sortOptions}
                                        value={orderBy}
                                        onChange={handleSortChange}
                                        ariaLabel={t('projects.sortTasks', 'Sort tasks')}
                                        title={t('projects.sortTasks', 'Sort tasks')}
                                        dropdownLabel={t('tasks.sortBy', 'Sort by')}
                                        extraContent={renderShowCompletedToggle()}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {activeTab === 'tasks' && (
                        <>
                            <div
                                className={`transition-all duration-300 ease-in-out ${
                                    isSearchExpanded ? 'max-h-24 opacity-100 mb-4' : 'max-h-0 opacity-0 mb-0'
                                } overflow-hidden`}
                            >
                                <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm px-4 py-3">
                                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                                    <input
                                        type="text"
                                        placeholder={t('tasks.searchPlaceholder', 'Search tasks...')}
                                        value={taskSearchQuery}
                                        onChange={(e) => setTaskSearchQuery(e.target.value)}
                                        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                                <ProjectTasksSection
                                    project={project}
                                    displayTasks={displayTasks}
                                    showAutoSuggestForm={showAutoSuggestForm}
                                    onAddNextAction={handleCreateNextAction}
                                    onDismissNextAction={handleSkipNextAction}
                                    onTaskCreate={handleTaskCreate}
                                    onTaskUpdate={handleTaskUpdate}
                                    onTaskCompletionToggle={handleTaskCompletionToggle}
                                    onTaskDelete={handleTaskDelete}
                                    onToggleToday={handleToggleToday}
                                    allProjects={allProjects}
                                    showCompleted={showCompleted}
                                    taskSearchQuery={taskSearchQuery}
                                    t={t}
                                />

                                <ProjectInsightsPanel
                                    taskStats={taskStats}
                                    completionGradient={completionGradient}
                                    dueBuckets={dueBuckets}
                                    dueHighlights={dueHighlights}
                                    nextBestAction={nextBestAction}
                                    getDueDescriptor={getDueDescriptor}
                                    onStartNextAction={handleStartNextAction}
                                    t={t}
                                    completionTrend={completionTrend}
                                    upcomingDueTrend={upcomingDueTrend}
                                    createdTrend={createdTrend}
                                    upcomingInsights={upcomingInsights}
                                    eisenhower={eisenhower}
                                    weeklyPace={weeklyPace}
                                    monthlyCompleted={monthlyCompleted}
                                />
                            </div>
                        </>
                    )}

                    {activeTab === 'notes' && project && (
                        <ProjectNotesSection
                            project={project}
                            notes={notes}
                            t={t}
                            onCreateNote={() => {
                                setSelectedNote({
                                    title: '',
                                    content: '',
                                    tags: [],
                                    project_id: project.id,
                                    project: { id: project.id, name: project.name, uid: project.uid },
                                    project_uid: project.uid,
                                });
                                setIsNoteModalOpen(true);
                            }}
                            onEditNote={handleEditNote}
                            onDeleteNote={(note) => {
                                setNoteToDelete(note);
                                setIsConfirmDialogOpen(true);
                            }}
                        />
                    )}

                    <ProjectModal
                        isOpen={isModalOpen}
                        onClose={closeModal}
                        onSave={handleSaveProject}
                        project={project}
                        areas={areas}
                    />

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
                                    (noteToDelete?.id !== undefined ? String(noteToDelete.id) : null);
                                if (identifier) handleDeleteNote(identifier);
                            }}
                            onCancel={() => {
                                setIsConfirmDialogOpen(false);
                                setNoteToDelete(null);
                            }}
                        />
                    )}
                    {isConfirmDialogOpen && !noteToDelete && (
                        <ConfirmDialog
                            title={t('modals.deleteProject.title', 'Delete Project')}
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
        </div>
    );
};

export default ProjectDetails;
