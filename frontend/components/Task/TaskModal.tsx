import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PriorityType, Task } from '../../entities/Task';
import ConfirmDialog from '../Shared/ConfirmDialog';
import DiscardChangesDialog from '../Shared/DiscardChangesDialog';
import { useToast } from '../Shared/ToastContext';
import { Project } from '../../entities/Project';
import { useStore } from '../../store/useStore';
import { fetchTaskByUid } from '../../utils/tasksService';
import {
    analyzeTaskName,
    TaskAnalysis,
} from '../../utils/taskIntelligenceService';
import { useTranslation } from 'react-i18next';
import { getTaskIntelligenceEnabled } from '../../utils/profileService';
// Import form sections
import TaskTitleSection from './TaskForm/TaskTitleSection';
import TaskContentSection from './TaskForm/TaskContentSection';
import TaskTagsSection from './TaskForm/TaskTagsSection';
import TaskProjectSection from './TaskForm/TaskProjectSection';
import TaskRecurrenceSection from './TaskForm/TaskRecurrenceSection';
import TaskSubtasksSection from './TaskForm/TaskSubtasksSection';
import TaskPrioritySection from './TaskForm/TaskPrioritySection';
import TaskDueDateSection from './TaskForm/TaskDueDateSection';
import TaskDeferUntilSection from './TaskForm/TaskDeferUntilSection';
import TaskSectionToggle from './TaskForm/TaskSectionToggle';
import TaskModalActions from './TaskForm/TaskModalActions';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task;
    onSave: (task: Task) => void;
    onDelete: (taskUid: string) => Promise<void>;
    projects: Project[];
    onCreateProject: (name: string) => Promise<Project>;
    onEditParentTask?: (parentTask: Task) => void;
    autoFocusSubtasks?: boolean;
    showToast?: boolean;
    initialSubtasks?: Task[];
}

const TaskModal: React.FC<TaskModalProps> = ({
    isOpen,
    onClose,
    task,
    onSave,
    onDelete,
    projects,
    onCreateProject,
    onEditParentTask,
    autoFocusSubtasks,
    showToast = true,
    initialSubtasks = [],
}) => {
    const { tagsStore } = useStore();
    // Avoid calling getTags() during component initialization to prevent remounting
    const availableTags = tagsStore.tags;
    const { addNewTags } = tagsStore;
    const [formData, setFormData] = useState<Task>(task);
    const [tags, setTags] = useState<string[]>(
        task.tags?.map((tag) => tag.name) || []
    );
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [newProjectName, setNewProjectName] = useState<string>('');

    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [isClosing, setIsClosing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showDiscardDialog, setShowDiscardDialog] = useState(false);
    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [parentTaskLoading, setParentTaskLoading] = useState(false);
    const [taskAnalysis, setTaskAnalysis] = useState<TaskAnalysis | null>(null);
    const [taskIntelligenceEnabled, setTaskIntelligenceEnabled] =
        useState(false);
    const [subtasks, setSubtasks] = useState<Task[]>([]);

    // Collapsible section states - subtasks is derived from autoFocusSubtasks
    const [baseSections, setBaseSections] = useState({
        tags: false,
        project: false,
        priority: false,
        dueDate: false,
        deferUntil: false,
        recurrence: false,
        subtasks: false,
    });

    // Derive expanded sections with subtasks controlled by autoFocusSubtasks
    const expandedSections = {
        ...baseSections,
        subtasks: baseSections.subtasks || autoFocusSubtasks,
    };

    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    const scrollToSubtasksSection = () => {
        const attemptScroll = (attempt = 1) => {
            const subtasksSection = document.querySelector(
                '[data-section="subtasks"]'
            ) as HTMLElement;

            if (subtasksSection) {
                subtasksSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end',
                });
            } else if (attempt <= 3) {
                // Retry up to 3 times with increasing delays
                setTimeout(() => attemptScroll(attempt + 1), 100 * attempt);
            }
        };

        setTimeout(() => attemptScroll(), 100);
    };

    const toggleSection = useCallback((section: keyof typeof baseSections) => {
        setBaseSections((prev) => {
            const newExpanded = {
                ...prev,
                [section]: !prev[section],
            };

            // Auto-scroll to show the expanded section
            if (newExpanded[section]) {
                // Special handling for subtasks section
                if (section === 'subtasks') {
                    scrollToSubtasksSection();
                } else {
                    setTimeout(() => {
                        const scrollContainer = document.querySelector(
                            '.absolute.inset-0.overflow-y-auto'
                        );
                        if (scrollContainer) {
                            scrollContainer.scrollTo({
                                top: scrollContainer.scrollHeight,
                                behavior: 'smooth',
                            });
                        }
                    }, 100); // Small delay to ensure DOM is updated
                }
            }

            return newExpanded;
        });
    }, []);

    // Handle task updates only when the task ID changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData(task);
            setTags(task.tags?.map((tag) => tag.name) || []);

            // Clear project name - selected project will show as badge
            setNewProjectName('');

            // Reset expandable sections to default state
            setBaseSections({
                tags: false,
                project: false,
                priority: false,
                dueDate: false,
                deferUntil: false,
                recurrence: task.recurring_parent_uid ? true : false,
                subtasks: false,
            });
        }
    }, [isOpen, task.id, task.project_id, projects]);

    // Handle task analysis separately
    useEffect(() => {
        if (isOpen && task.name && taskIntelligenceEnabled) {
            const analysis = analyzeTaskName(task.name);
            setTaskAnalysis(analysis);
        } else {
            setTaskAnalysis(null);
        }
    }, [isOpen, task.name, taskIntelligenceEnabled]);

    // Handle parent task fetching separately
    useEffect(() => {
        const fetchParentTask = async () => {
            if (task.recurring_parent_uid && isOpen) {
                setParentTaskLoading(true);
                try {
                    const parent = await fetchTaskByUid(
                        task.recurring_parent_uid
                    );
                    setParentTask(parent);
                } catch (error) {
                    console.error('Error fetching parent task:', error);
                    setParentTask(null);
                } finally {
                    setParentTaskLoading(false);
                }
            } else {
                setParentTask(null);
            }
        };

        fetchParentTask();
    }, [task.recurring_parent_uid, isOpen]);

    // Fetch task intelligence setting from user profile
    useEffect(() => {
        const fetchIntelligenceSetting = async () => {
            try {
                const enabled = await getTaskIntelligenceEnabled();
                setTaskIntelligenceEnabled(enabled);
            } catch (error) {
                console.error(
                    'Error fetching task intelligence setting:',
                    error
                );
                setTaskIntelligenceEnabled(false); // Default to disabled on error
            }
        };

        if (isOpen) {
            fetchIntelligenceSetting();
        }
    }, [isOpen]);

    // Auto-scroll to subtasks section when modal opens with autoFocusSubtasks
    // But don't auto-scroll for recurring tasks
    useEffect(() => {
        const isRecurringTask =
            task.recurrence_type && task.recurrence_type !== 'none';
        if (isOpen && autoFocusSubtasks && !isRecurringTask) {
            setTimeout(() => {
                scrollToSubtasksSection();
            }, 300);
        }
    }, [isOpen, autoFocusSubtasks, task.recurrence_type]);

    // Load tags when modal opens if not already loaded
    useEffect(() => {
        if (isOpen && !tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    }, [isOpen, tagsStore.hasLoaded, tagsStore.isLoading]);

    const handleEditParent = () => {
        if (parentTask && onEditParentTask) {
            onEditParentTask(parentTask);
            onClose(); // Close current modal
        }
    };

    const handleParentRecurrenceChange = (field: string, value: any) => {
        // Update the parent task data in local state
        if (parentTask) {
            setParentTask({ ...parentTask, [field]: value });
        }
        // Also update the form data to reflect the change
        setFormData((prev) => ({
            ...prev,
            [field]: value,
            update_parent_recurrence: true,
        }));
    };

    // Note: Tags loading removed to prevent modal closing issues
    // Tags will be loaded by other components or on app startup

    const getPriorityString = (
        priority: PriorityType | number | undefined
    ): PriorityType => {
        if (typeof priority === 'number') {
            const priorityNames: ('low' | 'medium' | 'high')[] = [
                'low',
                'medium',
                'high',
            ];
            return priorityNames[priority] || null;
        }
        return priority ?? null;
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = e.target;

        // Validate defer_until vs due_date
        if (name === 'defer_until' || name === 'due_date') {
            const newFormData = { ...formData, [name]: value };

            if (newFormData.defer_until && newFormData.due_date) {
                const deferDate = new Date(newFormData.defer_until);
                const dueDate = new Date(newFormData.due_date);

                if (!isNaN(deferDate.getTime()) && !isNaN(dueDate.getTime())) {
                    if (deferDate > dueDate) {
                        showErrorToast(
                            t(
                                'task.deferAfterDueError',
                                'Defer until date cannot be after the due date'
                            )
                        );
                        return;
                    }
                }
            }
        }

        setFormData((prev) => ({ ...prev, [name]: value }));

        // Analyze task name in real-time (only if intelligence is enabled)
        if (name === 'name' && taskIntelligenceEnabled) {
            const analysis = analyzeTaskName(value);
            setTaskAnalysis(analysis);
        }
    };

    const handleRecurrenceChange = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleTagsChange = useCallback((newTags: string[]) => {
        setTags(newTags);
        setFormData((prev) => ({
            ...prev,
            tags: newTags.map((name) => ({ name })),
        }));
    }, []);

    const handleProjectSearch = (query: string) => {
        setNewProjectName(query);
        setDropdownOpen(true);
        setFilteredProjects(
            projects.filter((project) =>
                project.name.toLowerCase().includes(query.toLowerCase())
            )
        );

        // If the user clears the project name, also clear the project_id in form data
        if (query.trim() === '') {
            setFormData({ ...formData, project_id: null });
        }
    };

    const handleProjectSelection = (project: Project) => {
        setFormData({ ...formData, project_id: project.id });
        setNewProjectName(''); // Clear input after selection (badge will show the project)
        setDropdownOpen(false);
    };

    const handleClearProject = () => {
        setFormData({ ...formData, project_id: null });
        setNewProjectName('');
        setDropdownOpen(false);
    };

    const handleShowAllProjects = () => {
        setNewProjectName('');
        setFilteredProjects(projects);
        setDropdownOpen(!dropdownOpen);
    };

    // Get the selected project object from the project_id
    const selectedProject = formData.project_id
        ? projects.find((p) => p.id === formData.project_id) || null
        : null;

    const handleCreateProject = async (name: string) => {
        if (name.trim() !== '') {
            setIsCreatingProject(true);
            try {
                const newProject = await onCreateProject(name);
                setFormData({ ...formData, project_id: newProject.id });
                setFilteredProjects([...filteredProjects, newProject]);
                setNewProjectName(''); // Clear input after creation (badge will show the project)
                setDropdownOpen(false);
                showSuccessToast(t('success.projectCreated'));
            } catch (error) {
                showErrorToast(t('errors.projectCreationFailed'));
                console.error('Error creating project:', error);
            } finally {
                setIsCreatingProject(false);
            }
        }
    };

    const handleSubmit = async () => {
        // Prevent multiple simultaneous submissions
        if (isSaving) return;

        setIsSaving(true);
        try {
            // Add new tags to the global store
            const existingTagNames = availableTags.map((tag: any) => tag.name);
            const newTagNames = tags.filter(
                (tag) => !existingTagNames.includes(tag)
            );
            if (newTagNames.length > 0) {
                addNewTags(newTagNames);
            }

            // CORRECTION: Use formData.project_id directly instead of the logic based on newProjectName
            // newProjectName is just a temporary lookup field, not the actual project state
            const finalFormData = {
                ...formData,
                project_id: formData.project_id,
                tags: tags.map((tag) => ({ name: tag })),
                subtasks: subtasks,
            };

            onSave(finalFormData as any);

            if (showToast) {
                const taskLink = (
                    <span>
                        {t('task.updated', 'Task')}{' '}
                        <a
                            href={`/task/${formData.uid}`}
                            className="text-green-200 underline hover:text-green-100"
                        >
                            {formData.name}
                        </a>{' '}
                        {t('task.updatedSuccessfully', 'updated successfully!')}
                    </span>
                );
                showSuccessToast(taskLink);
            }
            handleClose();
        } catch (error) {
            console.error('Error saving task:', error);
            // Don't close modal on error so user can retry
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteClick = () => {
        setShowConfirmDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (formData.uid) {
            try {
                await onDelete(formData.uid);
                const taskLink = (
                    <span>
                        {t('task.deleted', 'Task')}{' '}
                        <a
                            href={`/task/${formData.uid}`}
                            className="text-green-200 underline hover:text-green-100"
                        >
                            {formData.name}
                        </a>{' '}
                        {t('task.deletedSuccessfully', 'deleted successfully!')}
                    </span>
                );
                showSuccessToast(taskLink);
                setShowConfirmDialog(false);
                handleClose();
            } catch (error) {
                console.error('Failed to delete task:', error);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
    };

    // Check if there are unsaved changes
    const hasUnsavedChanges = () => {
        // Compare formData with original task
        const formChanged =
            formData.name !== task.name ||
            formData.note !== task.note ||
            formData.priority !== task.priority ||
            formData.due_date !== task.due_date ||
            formData.project_id !== task.project_id ||
            formData.recurrence_type !== task.recurrence_type ||
            formData.recurrence_interval !== task.recurrence_interval ||
            formData.recurrence_weekday !== task.recurrence_weekday ||
            formData.recurrence_end_date !== task.recurrence_end_date;

        // Compare tags
        const originalTags = task.tags?.map((tag) => tag.name) || [];
        const tagsChanged =
            tags.length !== originalTags.length ||
            tags.some((tag, index) => tag !== originalTags[index]);

        // Compare subtasks (check if any were added or modified)
        const subtasksChanged =
            subtasks.length !== (initialSubtasks?.length || 0);

        return formChanged || tagsChanged || subtasksChanged;
    };

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
            setShowDiscardDialog(false);
        }, 300);
    };

    const handleDiscardChanges = () => {
        setShowDiscardDialog(false);
        handleClose();
    };

    const handleCancelDiscard = () => {
        setShowDiscardDialog(false);
    };

    // Handle body scroll when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            // Disable body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            // Re-enable body scroll when modal is closed
            document.body.style.overflow = 'unset';
        }

        return () => {
            // Clean up: re-enable body scroll
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    // Use ref to store hasUnsavedChanges so it's always current in the event handler
    const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
    useEffect(() => {
        hasUnsavedChangesRef.current = hasUnsavedChanges;
    });

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                // Don't show discard dialog if already showing a dialog
                if (showConfirmDialog || showDiscardDialog) {
                    // Let the dialog handle its own Escape
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                // Check for unsaved changes using ref to get current value
                if (hasUnsavedChangesRef.current()) {
                    setShowDiscardDialog(true);
                } else {
                    handleClose();
                }
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, showConfirmDialog, showDiscardDialog]);

    // Load existing subtasks when modal opens - use initialSubtasks if provided, no fetching
    useEffect(() => {
        if (isOpen && task.id) {
            // Always use provided initial subtasks (from parent component) or empty array
            setSubtasks(initialSubtasks || []);
        } else if (!isOpen) {
            // Reset subtasks when modal closes
            setSubtasks([]);
        }
    }, [isOpen, task.id]);

    if (!isOpen) return null;

    return createPortal(
        <>
            <div
                className={`fixed top-16 left-0 right-0 bottom-0 bg-gray-900 bg-opacity-80 z-40 transition-opacity duration-300 overflow-hidden sm:overflow-y-auto ${
                    isClosing ? 'opacity-0' : 'opacity-100'
                }`}
                onMouseDown={(e) => {
                    // Close modal when clicking on backdrop, but not on the modal content
                    // Use mousedown instead of onClick to prevent issues with text selection dragging
                    if (e.target === e.currentTarget) {
                        handleClose();
                    }
                }}
            >
                <div
                    className="h-full flex items-start justify-center sm:px-4 sm:py-4"
                    onMouseDown={(e) => {
                        // Close modal when clicking on centering container, but not on the modal content
                        // Use mousedown instead of onClick to prevent issues with text selection dragging
                        if (e.target === e.currentTarget) {
                            handleClose();
                        }
                    }}
                >
                    <div
                        ref={modalRef}
                        data-testid="task-modal"
                        data-state={isSaving ? 'saving' : 'idle'}
                        className={`bg-white dark:bg-gray-800 border-0 w-full sm:max-w-2xl max-w-full overflow-hidden transform transition-transform duration-300 ${
                            isClosing ? 'scale-95' : 'scale-100'
                        } h-full sm:h-auto sm:my-4`}
                    >
                        <div className="flex flex-col lg:flex-row h-full sm:min-h-[600px] sm:max-h-[90vh]">
                            {/* Main Form Section */}
                            <div className="flex-1 flex flex-col transition-all duration-300 bg-white dark:bg-gray-800 sm:rounded-lg">
                                <div className="flex-1 relative">
                                    <div
                                        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
                                        style={{
                                            WebkitOverflowScrolling: 'touch',
                                        }}
                                    >
                                        <form
                                            className="h-full"
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                return false;
                                            }}
                                        >
                                            <fieldset className="h-full flex flex-col">
                                                {/* Task Title Section - Always Visible */}
                                                <TaskTitleSection
                                                    taskId={task.id}
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    taskAnalysis={taskAnalysis}
                                                    taskIntelligenceEnabled={
                                                        taskIntelligenceEnabled
                                                    }
                                                    onSubmit={handleSubmit}
                                                />

                                                {/* Content Section - Always Visible */}
                                                <TaskContentSection
                                                    taskId={task.id}
                                                    value={formData.note || ''}
                                                    onChange={handleChange}
                                                />

                                                {/* Expandable Sections - Only show when expanded */}
                                                {expandedSections.tags && (
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.tags',
                                                                'Tags'
                                                            )}
                                                        </h3>
                                                        <TaskTagsSection
                                                            tags={tags}
                                                            onTagsChange={
                                                                handleTagsChange
                                                            }
                                                            availableTags={
                                                                availableTags
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.project && (
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.project',
                                                                'Project'
                                                            )}
                                                        </h3>
                                                        <TaskProjectSection
                                                            newProjectName={
                                                                newProjectName
                                                            }
                                                            onProjectSearch={
                                                                handleProjectSearch
                                                            }
                                                            dropdownOpen={
                                                                dropdownOpen
                                                            }
                                                            filteredProjects={
                                                                filteredProjects
                                                            }
                                                            onProjectSelection={
                                                                handleProjectSelection
                                                            }
                                                            onCreateProject={
                                                                handleCreateProject
                                                            }
                                                            isCreatingProject={
                                                                isCreatingProject
                                                            }
                                                            onShowAllProjects={
                                                                handleShowAllProjects
                                                            }
                                                            allProjects={
                                                                projects
                                                            }
                                                            selectedProject={
                                                                selectedProject
                                                            }
                                                            onClearProject={
                                                                handleClearProject
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.priority && (
                                                    <div
                                                        data-testid="priority-section"
                                                        data-state="expanded"
                                                        className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4"
                                                    >
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.priority',
                                                                'Priority'
                                                            )}
                                                        </h3>
                                                        <TaskPrioritySection
                                                            value={getPriorityString(
                                                                formData.priority
                                                            )}
                                                            onChange={(
                                                                value: PriorityType
                                                            ) =>
                                                                setFormData({
                                                                    ...formData,
                                                                    priority:
                                                                        value,
                                                                })
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.dueDate && (
                                                    <div
                                                        data-testid="duedate-section"
                                                        data-state="expanded"
                                                        className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 overflow-visible"
                                                    >
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.dueDate',
                                                                'Due Date'
                                                            )}
                                                        </h3>
                                                        <TaskDueDateSection
                                                            value={
                                                                formData.due_date ||
                                                                ''
                                                            }
                                                            onChange={(
                                                                value
                                                            ) => {
                                                                const event = {
                                                                    target: {
                                                                        name: 'due_date',
                                                                        value,
                                                                    },
                                                                } as React.ChangeEvent<HTMLInputElement>;
                                                                handleChange(
                                                                    event
                                                                );
                                                            }}
                                                            placeholder={t(
                                                                'forms.task.dueDatePlaceholder',
                                                                'Select due date'
                                                            )}
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.deferUntil && (
                                                    <div
                                                        data-testid="deferuntil-section"
                                                        data-state="expanded"
                                                        className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 overflow-visible"
                                                    >
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.deferUntil',
                                                                'Defer Until'
                                                            )}
                                                        </h3>
                                                        <TaskDeferUntilSection
                                                            value={
                                                                formData.defer_until ||
                                                                ''
                                                            }
                                                            onChange={(
                                                                value
                                                            ) => {
                                                                const event = {
                                                                    target: {
                                                                        name: 'defer_until',
                                                                        value,
                                                                    },
                                                                } as React.ChangeEvent<HTMLInputElement>;
                                                                handleChange(
                                                                    event
                                                                );
                                                            }}
                                                            placeholder={t(
                                                                'forms.task.deferUntilPlaceholder',
                                                                'Select defer until date and time'
                                                            )}
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.recurrence && (
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.recurrence',
                                                                'Recurrence'
                                                            )}
                                                        </h3>
                                                        <TaskRecurrenceSection
                                                            recurrenceType={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_type ||
                                                                'none'
                                                            }
                                                            recurrenceInterval={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_interval ||
                                                                1
                                                            }
                                                            recurrenceEndDate={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_end_date
                                                            }
                                                            recurrenceWeekday={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_weekday
                                                            }
                                                            recurrenceWeekdays={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_weekdays
                                                            }
                                                            recurrenceMonthDay={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_month_day
                                                            }
                                                            recurrenceWeekOfMonth={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .recurrence_week_of_month
                                                            }
                                                            completionBased={
                                                                (
                                                                    parentTask ||
                                                                    formData
                                                                )
                                                                    .completion_based ||
                                                                false
                                                            }
                                                            onChange={
                                                                handleRecurrenceChange
                                                            }
                                                            disabled={
                                                                !!parentTask
                                                            }
                                                            isChildTask={
                                                                !!parentTask
                                                            }
                                                            parentTaskLoading={
                                                                parentTaskLoading
                                                            }
                                                            onEditParent={
                                                                parentTask
                                                                    ? handleEditParent
                                                                    : undefined
                                                            }
                                                            onParentRecurrenceChange={
                                                                parentTask
                                                                    ? handleParentRecurrenceChange
                                                                    : undefined
                                                            }
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.subtasks && (
                                                    <div
                                                        className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4"
                                                        data-section="subtasks"
                                                    >
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.subtasks',
                                                                'Subtasks'
                                                            )}
                                                        </h3>
                                                        <TaskSubtasksSection
                                                            parentTaskId={
                                                                task.id!
                                                            }
                                                            subtasks={subtasks}
                                                            onSubtasksChange={
                                                                setSubtasks
                                                            }
                                                            onSubtaskUpdate={async (
                                                                updatedSubtask
                                                            ) => {
                                                                // Update the subtask in the local state
                                                                setSubtasks(
                                                                    (prev) =>
                                                                        prev.map(
                                                                            (
                                                                                st
                                                                            ) =>
                                                                                st.id ===
                                                                                updatedSubtask.id
                                                                                    ? updatedSubtask
                                                                                    : st
                                                                        )
                                                                );
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </fieldset>
                                        </form>
                                    </div>
                                </div>

                                {/* Section Icons - Above border, split layout */}
                                <TaskSectionToggle
                                    expandedSections={expandedSections}
                                    onToggleSection={toggleSection}
                                    formData={formData}
                                    subtasksCount={subtasks.length}
                                />

                                {/* Action Buttons - Below border with custom layout */}
                                <TaskModalActions
                                    taskId={task.id}
                                    isSaving={isSaving}
                                    onDelete={handleDeleteClick}
                                    onCancel={handleClose}
                                    onSave={handleSubmit}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {showConfirmDialog && (
                <ConfirmDialog
                    title={t('modals.deleteTask.title', 'Delete Task')}
                    message={t(
                        'modals.deleteTask.confirmation',
                        'Are you sure you want to delete this task? This action cannot be undone.'
                    )}
                    onConfirm={handleDeleteConfirm}
                    onCancel={() => setShowConfirmDialog(false)}
                />
            )}
            {showDiscardDialog && (
                <DiscardChangesDialog
                    onDiscard={handleDiscardChanges}
                    onCancel={handleCancelDiscard}
                />
            )}
        </>,
        document.body
    );
};

export default TaskModal;
