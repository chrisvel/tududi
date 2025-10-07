import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PriorityType, Task } from '../../entities/Task';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { useToast } from '../Shared/ToastContext';
import { Project } from '../../entities/Project';
import { useStore } from '../../store/useStore';
import { fetchTaskById } from '../../utils/tasksService';
import {
    analyzeTaskName,
    TaskAnalysis,
} from '../../utils/taskIntelligenceService';
import { useTranslation } from 'react-i18next';
import {
    TagIcon,
    FolderIcon,
    ArrowPathIcon,
    TrashIcon,
    ListBulletIcon,
    ExclamationTriangleIcon,
    CalendarIcon,
} from '@heroicons/react/24/outline';

// Import form sections
import TaskTitleSection from './TaskForm/TaskTitleSection';
import TaskContentSection from './TaskForm/TaskContentSection';
import TaskTagsSection from './TaskForm/TaskTagsSection';
import TaskProjectSection from './TaskForm/TaskProjectSection';
import TaskRecurrenceSection from './TaskForm/TaskRecurrenceSection';
import TaskSubtasksSection from './TaskForm/TaskSubtasksSection';
import PriorityDropdown from '../Shared/PriorityDropdown';
import DatePicker from '../Shared/DatePicker';

interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    task: Task;
    onSave: (task: Task) => void;
    onDelete: (taskId: number) => Promise<void>;
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
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [parentTaskLoading, setParentTaskLoading] = useState(false);
    const [taskAnalysis, setTaskAnalysis] = useState<TaskAnalysis | null>(null);
    const [taskIntelligenceEnabled] = useState(true);
    const [subtasks, setSubtasks] = useState<Task[]>([]);

    // Collapsible section states - subtasks is derived from autoFocusSubtasks
    const [baseSections, setBaseSections] = useState({
        tags: false,
        project: false,
        priority: false,
        dueDate: false,
        recurrence: false,
        subtasks: false,
    });

    // Derive expanded sections with subtasks controlled by autoFocusSubtasks
    // and recurrence expanded for child tasks
    const expandedSections = {
        ...baseSections,
        subtasks: baseSections.subtasks || autoFocusSubtasks,
        recurrence: baseSections.recurrence || !!task.recurring_parent_id, // Auto-expand for child tasks
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
        setFormData(task);
        setTags(task.tags?.map((tag) => tag.name) || []);

        // Initialize project name from task data
        if (task.project_id) {
            const currentProject = projects.find(
                (p) => p.id === task.project_id
            );
            if (currentProject) {
                setNewProjectName(currentProject.name);
            }
        } else {
            setNewProjectName('');
        }
    }, [task.id, task.project_id, projects]);

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
            if (task.recurring_parent_id && isOpen) {
                setParentTaskLoading(true);
                try {
                    const parent = await fetchTaskById(
                        task.recurring_parent_id
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
    }, [task.recurring_parent_id, isOpen]);

    // Don't fetch task intelligence setting - use default enabled state
    // This prevents unnecessary API calls when opening the modal

    // Auto-scroll to subtasks section when modal opens with autoFocusSubtasks
    useEffect(() => {
        if (isOpen && autoFocusSubtasks) {
            setTimeout(() => {
                scrollToSubtasksSection();
            }, 300);
        }
    }, [isOpen, autoFocusSubtasks]);

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
            const priorityNames: PriorityType[] = ['low', 'medium', 'high'];
            return priorityNames[priority] || 'low';
        }
        return priority || 'low';
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { name, value } = e.target;
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

    const handleProjectSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
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
        setNewProjectName(project.name);
        setDropdownOpen(false);
    };

    const handleShowAllProjects = () => {
        setNewProjectName('');
        setFilteredProjects(projects);
        setDropdownOpen(!dropdownOpen);
    };

    const handleCreateProject = async () => {
        if (newProjectName.trim() !== '') {
            setIsCreatingProject(true);
            try {
                const newProject = await onCreateProject(newProjectName);
                setFormData({ ...formData, project_id: newProject.id });
                setFilteredProjects([...filteredProjects, newProject]);
                setNewProjectName(newProject.name);
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
        try {
            // Add new tags to the global store
            const existingTagNames = availableTags.map((tag: any) => tag.name);
            const newTagNames = tags.filter(
                (tag) => !existingTagNames.includes(tag)
            );
            if (newTagNames.length > 0) {
                addNewTags(newTagNames);
            }

            // If project name is empty, clear the project_id
            const finalFormData = {
                ...formData,
                project_id:
                    newProjectName.trim() === '' ? null : formData.project_id,
                tags: tags.map((tag) => ({ name: tag })),
                subtasks: subtasks,
            };

            await onSave(finalFormData as any);

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
        }
    };

    const handleDeleteClick = () => {
        setShowConfirmDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (formData.id) {
            try {
                await onDelete(formData.id);
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

    const handleClose = () => {
        setIsClosing(true);
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300);
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

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

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
                onClick={(e) => {
                    // Close modal when clicking on backdrop, but not on the modal content
                    if (e.target === e.currentTarget) {
                        handleClose();
                    }
                }}
            >
                <div
                    className="h-full flex items-start justify-center sm:px-4 sm:py-4"
                    onClick={(e) => {
                        // Close modal when clicking on centering container, but not on the modal content
                        if (e.target === e.currentTarget) {
                            handleClose();
                        }
                    }}
                >
                    <div
                        ref={modalRef}
                        className={`bg-white dark:bg-gray-800 border-0 w-full sm:max-w-2xl transform transition-transform duration-300 ${
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
                                                        />
                                                    </div>
                                                )}

                                                {expandedSections.priority && (
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.priority',
                                                                'Priority'
                                                            )}
                                                        </h3>
                                                        <PriorityDropdown
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
                                                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4 px-4 overflow-visible">
                                                        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                                            {t(
                                                                'forms.task.labels.dueDate',
                                                                'Due Date'
                                                            )}
                                                        </h3>
                                                        <div className="overflow-visible">
                                                            <DatePicker
                                                                value={
                                                                    formData.due_date ||
                                                                    ''
                                                                }
                                                                onChange={(
                                                                    value
                                                                ) => {
                                                                    const event =
                                                                        {
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
                                                            formData={formData}
                                                            parentTask={
                                                                parentTask
                                                            }
                                                            parentTaskLoading={
                                                                parentTaskLoading
                                                            }
                                                            onRecurrenceChange={
                                                                handleRecurrenceChange
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
                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 px-3 py-2">
                                    <div className="flex items-center justify-between">
                                        {/* Left side: Section icons */}
                                        <div className="flex items-center space-x-1">
                                            {/* Tags Toggle */}
                                            <button
                                                onClick={() =>
                                                    toggleSection('tags')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.tags
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.labels.tags',
                                                    'Tags'
                                                )}
                                            >
                                                <TagIcon className="h-5 w-5" />
                                                {formData.tags &&
                                                    formData.tags.length >
                                                        0 && (
                                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                    )}
                                            </button>

                                            {/* Project Toggle */}
                                            <button
                                                onClick={() =>
                                                    toggleSection('project')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.project
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.labels.project',
                                                    'Project'
                                                )}
                                            >
                                                <FolderIcon className="h-5 w-5" />
                                                {formData.project_id && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                            </button>

                                            {/* Priority Toggle */}
                                            <button
                                                onClick={() =>
                                                    toggleSection('priority')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.priority
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.labels.priority',
                                                    'Priority'
                                                )}
                                            >
                                                <ExclamationTriangleIcon className="h-5 w-5" />
                                                {getPriorityString(
                                                    formData.priority
                                                ) !== 'medium' && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                            </button>

                                            {/* Due Date Toggle */}
                                            <button
                                                onClick={() =>
                                                    toggleSection('dueDate')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.dueDate
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.labels.dueDate',
                                                    'Due Date'
                                                )}
                                            >
                                                <CalendarIcon className="h-5 w-5" />
                                                {formData.due_date && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                            </button>

                                            {/* Recurrence Toggle */}
                                            <button
                                                onClick={() =>
                                                    toggleSection('recurrence')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.recurrence
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.recurrence',
                                                    'Recurrence'
                                                )}
                                            >
                                                <ArrowPathIcon className="h-5 w-5" />
                                                {(formData.recurrence_type ||
                                                    formData.recurring_parent_id) && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                            </button>

                                            {/* Subtasks Toggle */}
                                            <button
                                                onClick={() =>
                                                    toggleSection('subtasks')
                                                }
                                                className={`relative p-2 rounded-full transition-colors ${
                                                    expandedSections.subtasks
                                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                                                }`}
                                                title={t(
                                                    'forms.task.subtasks',
                                                    'Subtasks'
                                                )}
                                            >
                                                <ListBulletIcon className="h-5 w-5" />
                                                {subtasks.length > 0 && (
                                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full"></span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Action Buttons - Below border with custom layout */}
                                <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 flex items-center justify-between sm:rounded-bl-lg">
                                    {/* Left side: Delete and Cancel */}
                                    <div className="flex items-center space-x-3">
                                        {task.id && (
                                            <button
                                                type="button"
                                                onClick={handleDeleteClick}
                                                className="p-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none transition duration-150 ease-in-out"
                                                title={t(
                                                    'common.delete',
                                                    'Delete'
                                                )}
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleClose}
                                            className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 focus:outline-none transition duration-150 ease-in-out text-sm"
                                        >
                                            {t('common.cancel', 'Cancel')}
                                        </button>
                                    </div>

                                    {/* Right side: Save */}
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none transition duration-150 ease-in-out text-sm"
                                        data-testid="task-save-button"
                                    >
                                        {t('common.save', 'Save')}
                                    </button>
                                </div>
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
        </>,
        document.body
    );
};

export default TaskModal;
