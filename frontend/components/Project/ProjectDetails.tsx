import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getCsrfToken } from '../../utils/csrfService';
import {
    MagnifyingGlassIcon,
    CheckIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { useToast } from '../Shared/ToastContext';
import ProjectAIInsights, {
    ProjectAIInsightsHandle,
} from '../AI/ProjectAIInsights';
import ConfirmDialog from '../Shared/ConfirmDialog';
import NoteSidePanel from '../Note/NoteSidePanel';
import { deleteNote as apiDeleteNote } from '../../utils/notesService';
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
    deleteTask,
    fetchTaskOrder,
    saveTaskOrder,
} from '../../utils/tasksService';
import { mergeVisibleOrder } from '../Shared/sortableList';
import IconSortDropdown from '../Shared/IconSortDropdown';
import LoadingSpinner from '../Shared/LoadingSpinner';
import { getApiPath } from '../../config/paths';
import ProjectHero from './ProjectHero';
import NewItemButton from '../Shared/NewItemButton';
import { onCaptureSaved, openCapture } from '../../utils/captureUi';
import BannerEditModal from './BannerEditModal';
import ProjectShareModal from './ProjectShareModal';
import ProjectTasksSection from './ProjectTasksSection';
import ProjectOverviewRail from './ProjectOverviewRail';
import ProjectAttachmentsWidget from './ProjectAttachmentsWidget';
import { ownerAttachmentsApi } from '../../utils/attachmentsService';
import { useProjectMetrics } from './useProjectMetrics';
import {
    matchesTaskStatusFilter,
    TaskStatusFilter,
} from '../../constants/taskStatus';
import { saveProjectAsTemplate } from '../../utils/templatesService';

const ProjectDetails: React.FC = () => {
    const { uidSlug } = useParams<{ uidSlug: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();
    const { areasStore, projectsStore, userSettingsStore } = useStore();
    const areas = areasStore.areas;
    const templatesEnabled = userSettingsStore.templatesEnabled;
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [project, setProject] = useState<Project | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notes, setNotes] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);
    const [isTemplateConfirmOpen, setIsTemplateConfirmOpen] = useState(false);
    const [previewNote, setPreviewNote] = useState<Note | null>(null);
    const [isBannerEditModalOpen, setIsBannerEditModalOpen] = useState(false);
    const attachmentsApi = useMemo(
        () =>
            project?.uid ? ownerAttachmentsApi('project', project.uid) : null,
        [project?.uid]
    );

    const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>(
        () => {
            const saved = localStorage.getItem('project_task_status_filter');
            return (saved as TaskStatusFilter) || 'active';
        }
    );
    const [orderBy, setOrderBy] = useState<string>('status:inProgressFirst');
    // Task uids in the user's manual order for this project.
    const [taskOrder, setTaskOrder] = useState<string[]>([]);
    const [taskSearchQuery, setTaskSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [aiInsightsActive, setAiInsightsActive] = useState(false);
    const aiInsightsRef = useRef<ProjectAIInsightsHandle>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const sortOptions = useMemo(
        () => [
            {
                value: 'status:inProgressFirst',
                label: t('sort.status', 'Status'),
            },
            {
                value: 'created_at:desc',
                label: t('sort.created_at', 'Created At'),
            },
            { value: 'due_date:asc', label: t('sort.due_date', 'Due Date') },
            { value: 'priority:desc', label: t('sort.priority', 'Priority') },
            { value: 'custom:asc', label: t('sort.custom', 'Custom') },
        ],
        [t]
    );

    useEffect(() => {
        if (!areasStore.hasLoaded && !areasStore.isLoading) {
            areasStore.loadAreas();
        }
    }, [areasStore]);

    useEffect(() => {
        if (allProjects.length === 0) {
            fetchProjects()
                .then(setAllProjects)
                .catch(() => undefined);
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
    }, []);

    // Bumped after something is captured, so new tasks and notes show up
    const [reloadKey, setReloadKey] = useState(0);
    useEffect(
        () =>
            onCaptureSaved(() => {
                setReloadKey((key) => key + 1);
            }),
        []
    );

    useEffect(() => {
        if (!uidSlug) return;
        const loadProjectData = async () => {
            try {
                if (!project) setLoading(true);
                setError(false);
                const projectData = await fetchProjectBySlug(uidSlug);
                setProject(projectData);
                setTasks(projectData.tasks || projectData.Tasks || []);
                if (projectData.uid) {
                    fetchTaskOrder({
                        scope: 'project',
                        project_uid: projectData.uid,
                    })
                        .then(setTaskOrder)
                        .catch(() => setTaskOrder([]));
                }
                const savedSort = localStorage.getItem('project_order_by');
                if (!savedSort && projectData.task_sort_order) {
                    setOrderBy(projectData.task_sort_order);
                }
                const fetchedNotes =
                    projectData.notes || projectData.Notes || [];
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
    }, [uidSlug, reloadKey]);

    const handleTaskUpdate = async (updatedTask: Task) => {
        if (!updatedTask.id) return;
        const hasUpdatedData =
            updatedTask.parent_child_logic_executed !== undefined;
        if (hasUpdatedData) {
            setTasks((prev) =>
                prev.map((task) =>
                    task.id === updatedTask.id
                        ? {
                              ...task,
                              ...updatedTask,
                              subtasks:
                                  updatedTask.subtasks || task.subtasks || [],
                          }
                        : task
                )
            );
            return;
        }
        const response = await fetch(getApiPath(`task/${updatedTask.uid}`), {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'x-csrf-token': await getCsrfToken(),
            },
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
                                  updatedTask.subtasks ||
                                  task.subtasks ||
                                  [],
                          }
                        : task
                )
            );
        }
    };

    const handleTaskDelete = async (taskUid: string | undefined) => {
        if (!taskUid) return;
        await deleteTask(taskUid);
        setTasks(tasks.filter((task) => task.uid !== taskUid));
    };

    const handleTaskCompletionToggle = (updatedTask: Task) => {
        if (!updatedTask.id) return;
        setTasks((prev) =>
            prev.map((task) =>
                task.id === updatedTask.id
                    ? {
                          ...task,
                          ...updatedTask,
                          subtasks: updatedTask.subtasks || task.subtasks || [],
                      }
                    : task
            )
        );
    };

    // Each field on the page saves on its own, so the page only patches what
    // changed and keeps the associations the response does not carry.
    const handleUpdateProject = async (patch: Partial<Project>) => {
        if (!project?.uid) return;
        try {
            const savedProject = await updateProject(project.uid, patch);
            setProject((prev) => ({
                ...prev,
                ...savedProject,
                area: savedProject.area || prev?.area,
                Area: (savedProject as any).Area || (prev as any)?.Area,
            }));
            projectsStore.setProjects(
                projectsStore.projects.map((p) =>
                    p.uid === savedProject.uid ? { ...p, ...savedProject } : p
                )
            );
        } catch (err) {
            showErrorToast(
                t('errors.projectSaveFailed', 'Failed to save project')
            );
            throw err;
        }
    };

    const handleEditBannerClick = () => {
        setIsBannerEditModalOpen(true);
    };

    const handleSaveAsTemplate = () => {
        setIsTemplateConfirmOpen(true);
    };

    const handleConfirmSaveAsTemplate = async () => {
        if (!project?.uid) return;
        try {
            await saveProjectAsTemplate(project.uid, { name: project.name });
            showSuccessToast(
                t('projects.savedAsTemplate', '"{{name}}" saved as template.', {
                    name: project.name,
                })
            );
        } catch {
            showErrorToast(
                t(
                    'projects.saveAsTemplateError',
                    'Failed to save project as template.'
                )
            );
        } finally {
            setIsTemplateConfirmOpen(false);
        }
    };

    const handleTogglePin = async () => {
        if (!project?.uid) return;
        const newValue = !project.pin_to_sidebar;
        const updatedProject = await updateProject(project.uid, {
            ...project,
            pin_to_sidebar: newValue,
        });
        setProject((prev) => ({ ...prev, ...updatedProject }));
        const currentProjects = projectsStore.projects;
        projectsStore.setProjects(
            currentProjects.map((p) =>
                p.uid === project.uid ? { ...p, pin_to_sidebar: newValue } : p
            )
        );
    };

    const handleSaveBanner = async (imageUrl: string) => {
        if (!project || !project.uid) return;

        const updatedProject = await updateProject(project.uid, {
            ...project,
            image_url: imageUrl,
        });

        setProject((prev) => ({
            ...updatedProject,
            area: updatedProject.area || prev?.area,
            Area: (updatedProject as any).Area || (prev as any)?.Area,
        }));

        // Update the global projects store
        const currentProjects = projectsStore.projects;
        const updatedProjects = currentProjects.map((p) =>
            p.id === updatedProject.id ? { ...p, image_url: imageUrl } : p
        );
        projectsStore.setProjects(updatedProjects);

        showSuccessToast(
            t('success.bannerUpdated', 'Banner updated successfully!')
        );
    };

    const handleTaskStatusFilterChange = (status: TaskStatusFilter) => {
        setTaskStatusFilter(status);
        localStorage.setItem('project_task_status_filter', status);
    };

    const handleSortChange = (newOrderBy: string) => {
        setOrderBy(newOrderBy);
        localStorage.setItem('project_order_by', newOrderBy);
    };

    const handleDeleteProject = async () => {
        if (!project?.uid) return;
        await deleteProject(project.uid);
        const updatedProjects = projectsStore.projects.filter(
            (p) => p.uid !== project.uid
        );
        projectsStore.setProjects(updatedProjects);
        navigate('/projects');
    };

    // Opens the capture box on a task or note with this project filled in
    const openCaptureForProject = (target: 'task' | 'note' = 'task') => {
        if (!project) return;
        const token = /\s/.test(project.name)
            ? `+"${project.name}"`
            : `+${project.name}`;
        openCapture(target, null, `${token} `);
    };

    const handleDeleteNote = async (noteIdentifier: string) => {
        await apiDeleteNote(noteIdentifier);
        setNotes(
            notes.filter((n) => {
                const currentIdentifier =
                    n.uid ?? (n.id !== undefined ? String(n.id) : undefined);
                return currentIdentifier !== noteIdentifier;
            })
        );
        const globalNotes = useStore.getState().notesStore.notes;
        useStore.getState().notesStore.setNotes(
            globalNotes.filter((note) => {
                const currentIdentifier =
                    note.uid ??
                    (note.id !== undefined ? String(note.id) : undefined);
                return currentIdentifier !== noteIdentifier;
            })
        );
        setNoteToDelete(null);
        setIsConfirmDialogOpen(false);
    };

    // Unplaced tasks (never dragged) come first, newest first.
    const taskPositions = useMemo(
        () => new Map(taskOrder.map((uid, index) => [uid, index])),
        [taskOrder]
    );

    const compareTasks = useCallback(
        (a: Task, b: Task) => {
            if (orderBy.startsWith('custom:')) {
                const posA = a.uid ? taskPositions.get(a.uid) : undefined;
                const posB = b.uid ? taskPositions.get(b.uid) : undefined;
                if (posA === undefined || posB === undefined) {
                    if (posA !== posB) return posA === undefined ? -1 : 1;
                    return (
                        new Date(b.created_at || 0).getTime() -
                        new Date(a.created_at || 0).getTime()
                    );
                }
                return posA - posB;
            }
            const getStatusRank = (status: Task['status']) => {
                if (status === 'in_progress' || status === 1) return 0;
                if (status === 'not_started' || status === 0) return 1;
                if (status === 'planned' || status === 6) return 2;
                if (status === 'waiting' || status === 4) return 3;
                if (status === 'done' || status === 2) return 4;
                if (status === 'archived' || status === 3) return 5;
                return 6;
            };
            if (orderBy === 'status:inProgressFirst') {
                const rankA = getStatusRank(a.status);
                const rankB = getStatusRank(b.status);
                if (rankA !== rankB) return rankA - rankB;
                const dueA = a.due_date
                    ? new Date(a.due_date).getTime()
                    : Number.MAX_SAFE_INTEGER;
                const dueB = b.due_date
                    ? new Date(b.due_date).getTime()
                    : Number.MAX_SAFE_INTEGER;
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
                    return compare(
                        a.name?.toLowerCase() || '',
                        b.name?.toLowerCase() || ''
                    );
                case 'due_date':
                    return compare(
                        a.due_date ? new Date(a.due_date).getTime() : 0,
                        b.due_date ? new Date(b.due_date).getTime() : 0
                    );
                case 'priority': {
                    const priorityMap = { high: 2, medium: 1, low: 0 };
                    const valueA =
                        typeof a.priority === 'string'
                            ? priorityMap[a.priority] || 0
                            : a.priority || 0;
                    const valueB =
                        typeof b.priority === 'string'
                            ? priorityMap[b.priority] || 0
                            : b.priority || 0;
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
        },
        [orderBy, taskPositions]
    );

    // Dragging a task saves a manual order and switches the list to it,
    // starting from the order on screen.
    const handleTaskReorder = async (orderedUids: string[]) => {
        if (!project?.uid) return;
        const fullOrder = tasks
            .filter((task) => task.uid)
            .sort(compareTasks)
            .map((task) => task.uid as string);
        const newOrder = mergeVisibleOrder(fullOrder, orderedUids);
        const prevOrder = taskOrder;
        const prevOrderBy = orderBy;
        setTaskOrder(newOrder);
        if (!orderBy.startsWith('custom:')) handleSortChange('custom:asc');
        try {
            await saveTaskOrder(
                { scope: 'project', project_uid: project.uid },
                newOrder
            );
        } catch (error) {
            console.error('Error saving task order:', error);
            setTaskOrder(prevOrder);
            handleSortChange(prevOrderBy);
            showErrorToast(
                t('tasks.reorderError', 'Failed to save task order')
            );
        }
    };

    const displayTasks = useMemo(() => {
        let filteredTasks = tasks.filter((task) =>
            matchesTaskStatusFilter(task.status, taskStatusFilter)
        );
        if (taskSearchQuery.trim()) {
            const query = taskSearchQuery.toLowerCase();
            filteredTasks = filteredTasks.filter(
                (task) =>
                    task.name.toLowerCase().includes(query) ||
                    task.original_name?.toLowerCase().includes(query) ||
                    task.note?.toLowerCase().includes(query)
            );
        }
        return [...filteredTasks].sort(compareTasks);
    }, [tasks, taskStatusFilter, taskSearchQuery, compareTasks]);

    const { taskStats } = useProjectMetrics(
        tasks,
        handleTaskUpdate,
        t,
        showSuccessToast
    );

    if (loading) return <LoadingSpinner message="Loading project details..." />;
    if (error)
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">
                    Failed to load project details.
                </div>
            </div>
        );
    if (!project)
        return (
            <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
                <div className="text-red-500 text-lg">Project not found.</div>
            </div>
        );

    const renderStatusFilter = () => (
        <div className="space-y-3">
            <div>
                <div className="px-3 py-2 text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 border-t border-b border-gray-200 dark:border-gray-700">
                    {t('tasks.show', 'Show')}
                </div>
                <div className="py-1 space-y-1">
                    {[
                        { key: 'active', label: t('tasks.open', 'Open') },
                        { key: 'all', label: t('tasks.all', 'All') },
                        {
                            key: 'completed',
                            label: t('tasks.completed', 'Completed'),
                        },
                    ].map((opt) => {
                        const isActive = taskStatusFilter === opt.key;
                        return (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() =>
                                    handleTaskStatusFilterChange(
                                        opt.key as TaskStatusFilter
                                    )
                                }
                                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                    isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span>{opt.label}</span>
                                {isActive && <CheckIcon className="h-4 w-4" />}
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
                            label: t('tasks.ascending', 'Ascending'),
                        },
                        {
                            key: 'desc',
                            label: t('tasks.descending', 'Descending'),
                        },
                    ].map((dir) => {
                        const currentDirection = orderBy.split(':')[1] || 'asc';
                        const isActive = currentDirection === dir.key;
                        return (
                            <button
                                key={dir.key}
                                onClick={() => {
                                    const [field] = orderBy.split(':');
                                    const newOrderBy = `${field}:${dir.key}`;
                                    handleSortChange(newOrderBy);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                                    isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            >
                                <span>{dir.label}</span>
                                {isActive && <CheckIcon className="h-4 w-4" />}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    return (
        <div className="w-full px-2 sm:px-4 lg:px-6 pt-4 pb-12">
            <ProjectHero
                project={project}
                areas={areas}
                t={t}
                doneCount={taskStats.completed}
                totalCount={taskStats.total}
                onUpdate={handleUpdateProject}
                onDeleteClick={() => {
                    setNoteToDelete(null);
                    setIsConfirmDialogOpen(true);
                }}
                onShareClick={() => setIsShareModalOpen(true)}
                onSaveAsTemplate={
                    templatesEnabled ? handleSaveAsTemplate : undefined
                }
                onEditBannerClick={handleEditBannerClick}
                onTogglePin={handleTogglePin}
            />

            <div className="w-full">
                <div className="w-full">
                    <div className="mb-4">
                        <div className="flex items-center justify-between min-h-[2.5rem]">
                            <div className="flex items-center gap-4 sm:gap-6 self-stretch pl-2 sm:pl-3">
                                <span className="relative flex items-center self-stretch py-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 after:absolute after:bottom-0 after:left-px after:right-px after:h-0.5 after:rounded-full after:bg-gray-900 dark:after:bg-gray-100">
                                    {t('tasks.title', 'Tasks')}
                                </span>
                            </div>

                            {
                                <div className="flex items-center justify-end gap-2 sm:gap-4">
                                    <NewItemButton
                                        label={t('capture.add', 'Add')}
                                        onClick={() => openCaptureForProject()}
                                        testId="project-add-button"
                                    />
                                    <button
                                        onClick={() =>
                                            aiInsightsRef.current?.activate()
                                        }
                                        className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset rounded-lg p-1.5 sm:p-2 ${
                                            aiInsightsActive
                                                ? 'bg-indigo-100 dark:bg-indigo-900/40'
                                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                        }`}
                                        aria-pressed={aiInsightsActive}
                                        aria-label={t(
                                            'aiAssistant.projectInsightsTitle',
                                            'AI Insights'
                                        )}
                                        title={t(
                                            'aiAssistant.projectInsightsTitle',
                                            'AI Insights'
                                        )}
                                    >
                                        <SparklesIcon
                                            className={`h-4 w-4 sm:h-5 sm:w-5 ${
                                                aiInsightsActive
                                                    ? 'text-indigo-600 dark:text-indigo-300'
                                                    : 'text-gray-600 dark:text-gray-200'
                                            }`}
                                        />
                                    </button>
                                    <button
                                        onClick={() =>
                                            setIsSearchExpanded((v) => !v)
                                        }
                                        className={`flex items-center transition-all duration-300 focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset rounded-lg p-1.5 sm:p-2 ${
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
                                    >
                                        <MagnifyingGlassIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-200" />
                                    </button>
                                    <IconSortDropdown
                                        options={sortOptions}
                                        value={orderBy}
                                        onChange={handleSortChange}
                                        ariaLabel={t(
                                            'projects.sortTasks',
                                            'Sort tasks'
                                        )}
                                        title={t(
                                            'projects.sortTasks',
                                            'Sort tasks'
                                        )}
                                        dropdownLabel={t(
                                            'tasks.sortBy',
                                            'Sort by'
                                        )}
                                        footerContent={renderStatusFilter()}
                                    />
                                </div>
                            }
                        </div>
                    </div>

                    {
                        <>
                            <div className="mb-6">
                                <ProjectAIInsights
                                    ref={aiInsightsRef}
                                    project={project}
                                    taskStats={taskStats}
                                    onActiveChange={setAiInsightsActive}
                                />
                            </div>

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
                                        onChange={(e) =>
                                            setTaskSearchQuery(e.target.value)
                                        }
                                        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
                                <div className="min-w-0 space-y-4">
                                    <ProjectTasksSection
                                        displayTasks={displayTasks}
                                        onTaskUpdate={handleTaskUpdate}
                                        onTaskCompletionToggle={
                                            handleTaskCompletionToggle
                                        }
                                        onTaskDelete={handleTaskDelete}
                                        onToggleToday={undefined}
                                        allProjects={allProjects}
                                        showCompleted={
                                            taskStatusFilter !== 'active'
                                        }
                                        taskSearchQuery={taskSearchQuery}
                                        onTaskReorder={handleTaskReorder}
                                        t={t}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <ProjectOverviewRail
                                        project={project}
                                        areas={areas}
                                        notes={notes}
                                        t={t}
                                        onUpdate={handleUpdateProject}
                                        onShareClick={() =>
                                            setIsShareModalOpen(true)
                                        }
                                        onCreateNote={() =>
                                            openCaptureForProject('note')
                                        }
                                        onOpenNote={setPreviewNote}
                                    />
                                    {attachmentsApi && (
                                        <ProjectAttachmentsWidget
                                            api={attachmentsApi}
                                            t={t}
                                        />
                                    )}
                                </div>
                            </div>
                        </>
                    }

                    {previewNote && (
                        <NoteSidePanel
                            note={previewNote}
                            onClose={() => setPreviewNote(null)}
                            onSaved={(saved) => {
                                const savedProjectUid =
                                    saved.project_uid ??
                                    saved.project?.uid ??
                                    saved.Project?.uid;
                                setNotes((prev) =>
                                    savedProjectUid &&
                                    savedProjectUid !== project.uid
                                        ? // Moved to another project
                                          prev.filter(
                                              (n) => n.uid !== saved.uid
                                          )
                                        : prev.map((n) =>
                                              n.uid === saved.uid
                                                  ? { ...n, ...saved }
                                                  : n
                                          )
                                );
                                const { notesStore } = useStore.getState();
                                notesStore.setNotes(
                                    notesStore.notes.map((n) =>
                                        n.uid === saved.uid ? saved : n
                                    )
                                );
                            }}
                            onDelete={(note) => {
                                setPreviewNote(null);
                                setNoteToDelete(note);
                                setIsConfirmDialogOpen(true);
                            }}
                        />
                    )}

                    <BannerEditModal
                        isOpen={isBannerEditModalOpen}
                        onClose={() => setIsBannerEditModalOpen(false)}
                        onSave={handleSaveBanner}
                        currentImageUrl={project.image_url}
                    />

                    {isShareModalOpen && (
                        <ProjectShareModal
                            isOpen={isShareModalOpen}
                            onClose={() => setIsShareModalOpen(false)}
                            project={project}
                        />
                    )}

                    {isConfirmDialogOpen && noteToDelete && (
                        <ConfirmDialog
                            title={t('modals.deleteNote.title')}
                            message={`Are you sure you want to delete the note "${noteToDelete.title}"?`}
                            onConfirm={() => {
                                const identifier =
                                    noteToDelete?.uid ??
                                    (noteToDelete?.id !== undefined
                                        ? String(noteToDelete.id)
                                        : null);
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
                    {isTemplateConfirmOpen && (
                        <ConfirmDialog
                            title={t(
                                'modals.saveAsTemplate.title',
                                'Save as Template'
                            )}
                            message={t(
                                'modals.saveAsTemplate.message',
                                'Save "{{name}}" as a template? This will create a reusable template based on this project.',
                                { name: project?.name }
                            )}
                            onConfirm={handleConfirmSaveAsTemplate}
                            onCancel={() => setIsTemplateConfirmOpen(false)}
                            confirmButtonText={t('common.save', 'Save')}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectDetails;
