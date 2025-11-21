import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    CalendarIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ListBulletIcon,
    XMarkIcon,
    ClockIcon,
    CheckIcon,
    EyeIcon,
    PencilIcon,
    ArrowRightIcon,
    InformationCircleIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskModal from './TaskModal';
import RecurrenceDisplay from './RecurrenceDisplay';
import TaskSubtasksSection from './TaskForm/TaskSubtasksSection';
import ProjectDropdown from '../Shared/ProjectDropdown';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    fetchTaskByUid,
    fetchTaskNextIterations,
    TaskIteration,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import TaskPriorityIcon from './TaskPriorityIcon';
import LoadingScreen from '../Shared/LoadingScreen';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import TaskTimeline from './TaskTimeline';
import { isTaskOverdue } from '../../utils/dateUtils';
import TagInput from '../Tag/TagInput';
import TaskDueDateSection from './TaskForm/TaskDueDateSection';
import TaskRecurrenceSection from './TaskForm/TaskRecurrenceSection';

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const projects = useStore((state: any) => state.projectsStore.projects);
    const projectsStore = useStore((state: any) => state.projectsStore);
    const tagsStore = useStore((state: any) => state.tagsStore);
    const tasksStore = useStore((state: any) => state.tasksStore);
    const task = useStore((state: any) =>
        state.tasksStore.tasks.find((t: Task) => t.uid === uid)
    );

    // Get subtasks from the task data (already loaded in global store)
    const subtasks = task?.subtasks || task?.Subtasks || [];

    // Local state
    const [loading, setLoading] = useState(!task); // Only show loading if task not in store
    const [error, setError] = useState<string | null>(null);
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [focusSubtasks, setFocusSubtasks] = useState(false);
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [isOverdueAlertDismissed, setIsOverdueAlertDismissed] =
        useState(false);
    const [isSummaryAlertDismissed, setIsSummaryAlertDismissed] =
        useState(false);
    const [nextIterations, setNextIterations] = useState<TaskIteration[]>([]);
    const [loadingIterations, setLoadingIterations] = useState(false);
    const [parentTask, setParentTask] = useState<Task | null>(null);
    const [loadingParent, setLoadingParent] = useState(false);
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task?.name || '');
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [isEditingContent, setIsEditingContent] = useState(false);
    const [editedContent, setEditedContent] = useState(task?.note || '');
    const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
    const [contentTab, setContentTab] = useState<'edit' | 'preview'>('edit');
    const [isEditingSubtasks, setIsEditingSubtasks] = useState(false);
    const [editedSubtasks, setEditedSubtasks] = useState<Task[]>([]);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [editedTags, setEditedTags] = useState<string[]>(
        task?.tags?.map((tag: any) => tag.name) || []
    );
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                actionsMenuOpen &&
                actionsMenuRef.current &&
                !actionsMenuRef.current.contains(e.target as Node)
            ) {
                setActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [actionsMenuOpen]);
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);
    const [editedDueDate, setEditedDueDate] = useState<string>(
        task?.due_date || ''
    );
    const [isEditingRecurrence, setIsEditingRecurrence] = useState(false);
    const [recurrenceForm, setRecurrenceForm] = useState({
        recurrence_type: task?.recurrence_type || 'none',
        recurrence_interval: task?.recurrence_interval || 1,
        recurrence_end_date: task?.recurrence_end_date || '',
        recurrence_weekday: task?.recurrence_weekday || null,
        recurrence_weekdays: task?.recurrence_weekdays || [],
        recurrence_month_day: task?.recurrence_month_day || null,
        recurrence_week_of_month: task?.recurrence_week_of_month || null,
        completion_based: task?.completion_based || false,
    });

    // Project dropdown state
    const [projectName, setProjectName] = useState('');
    const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
    const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
    const [isCreatingProject, setIsCreatingProject] = useState(false);
    const projectDropdownRef = useRef<HTMLDivElement>(null);

    // Update edited title when task changes
    useEffect(() => {
        if (task?.name) {
            setEditedTitle(task.name);
        }
    }, [task?.name]);

    // Update edited content when task changes
    useEffect(() => {
        setEditedContent(task?.note || '');
    }, [task?.note]);

    useEffect(() => {
        setEditedTags(task?.tags?.map((tag: any) => tag.name) || []);
    }, [task?.tags]);

    useEffect(() => {
        setEditedDueDate(task?.due_date || '');
    }, [task?.due_date]);

    useEffect(() => {
        setRecurrenceForm({
            recurrence_type: task?.recurrence_type || 'none',
            recurrence_interval: task?.recurrence_interval || 1,
            recurrence_end_date: task?.recurrence_end_date || '',
            recurrence_weekday: task?.recurrence_weekday || null,
            recurrence_weekdays: task?.recurrence_weekdays || [],
            recurrence_month_day: task?.recurrence_month_day || null,
            recurrence_week_of_month: task?.recurrence_week_of_month || null,
            completion_based: task?.completion_based || false,
        });
    }, [
        task?.recurrence_type,
        task?.recurrence_interval,
        task?.recurrence_end_date,
        task?.recurrence_weekday,
        task?.recurrence_weekdays,
        task?.recurrence_month_day,
        task?.recurrence_week_of_month,
        task?.completion_based,
    ]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    // Focus textarea when entering content edit mode
    useEffect(() => {
        if (isEditingContent && contentTextareaRef.current) {
            contentTextareaRef.current.focus();
            // Move cursor to the end
            const length = contentTextareaRef.current.value.length;
            contentTextareaRef.current.setSelectionRange(length, length);
        }
    }, [isEditingContent]);

    // Load tags early and check for pending modal state on mount
    useEffect(() => {
        // Preload tags if not already loaded
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }

        try {
            // Check for subtasks modal state
            const pendingStateStr = sessionStorage.getItem('pendingModalState');
            if (pendingStateStr) {
                const pendingState = JSON.parse(pendingStateStr);
                const isRecent = Date.now() - pendingState.timestamp < 2000; // Within 2 seconds
                const isCorrectTask = pendingState.taskId === uid;

                if (isRecent && isCorrectTask && pendingState.isOpen) {
                    // Use microtask to avoid lifecycle method warning
                    queueMicrotask(() => {
                        setIsTaskModalOpen(true);
                        setFocusSubtasks(pendingState.focusSubtasks);
                    });
                    sessionStorage.removeItem('pendingModalState');
                }
            }

            // Check for edit modal state
            const pendingEditStateStr = sessionStorage.getItem(
                'pendingTaskEditModalState'
            );
            if (pendingEditStateStr) {
                const pendingEditState = JSON.parse(pendingEditStateStr);
                const isRecent = Date.now() - pendingEditState.timestamp < 5000; // Within 5 seconds
                const isCorrectTask = pendingEditState.taskId === uid;

                if (isRecent && isCorrectTask && pendingEditState.isOpen) {
                    // Use microtask to avoid lifecycle method warning
                    queueMicrotask(() => {
                        setIsTaskModalOpen(true);
                        setFocusSubtasks(false);
                    });
                    sessionStorage.removeItem('pendingTaskEditModalState');
                }
            }
        } catch {
            sessionStorage.removeItem('pendingModalState');
            sessionStorage.removeItem('pendingTaskEditModalState');
        }
    }, [uid, tagsStore]);

    // Date and recurrence formatting functions (from TaskHeader)
    const formatDueDate = (dueDate: string) => {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0];
        if (dueDate === today) return t('dateIndicators.today', 'TODAY');
        if (dueDate === tomorrow)
            return t('dateIndicators.tomorrow', 'TOMORROW');
        if (dueDate === yesterday)
            return t('dateIndicators.yesterday', 'YESTERDAY');

        return new Date(dueDate).toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const handleSaveTags = async () => {
        if (!task?.id) {
            setIsEditingTags(false);
            setEditedTags(task?.tags?.map((tag: any) => tag.name) || []);
            return;
        }

        const currentTags = task.tags?.map((tag: any) => tag.name) || [];
        if (
            editedTags.length === currentTags.length &&
            editedTags.every((tag, idx) => tag === currentTags[idx])
        ) {
            setIsEditingTags(false);
            return;
        }

        try {
            await updateTask(task.id, {
                ...task,
                tags: editedTags.map((name) => ({ name })),
            });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.tagsUpdated', 'Tags updated successfully')
            );
            setIsEditingTags(false);

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating tags:', error);
            showErrorToast(
                t('task.tagsUpdateError', 'Failed to update tags')
            );
            setEditedTags(task.tags?.map((tag: any) => tag.name) || []);
            setIsEditingTags(false);
        }
    };

    const handleCancelTagsEdit = () => {
        setIsEditingTags(false);
        setEditedTags(task?.tags?.map((tag: any) => tag.name) || []);
    };

    const handleStartRecurrenceEdit = () => {
        setRecurrenceForm({
            recurrence_type: task?.recurrence_type || 'none',
            recurrence_interval: task?.recurrence_interval || 1,
            recurrence_end_date: task?.recurrence_end_date || '',
            recurrence_weekday: task?.recurrence_weekday || null,
            recurrence_weekdays: task?.recurrence_weekdays || [],
            recurrence_month_day: task?.recurrence_month_day || null,
            recurrence_week_of_month: task?.recurrence_week_of_month || null,
            completion_based: task?.completion_based || false,
        });
        setIsEditingRecurrence(true);
    };

    const handleRecurrenceChange = (field: string, value: any) => {
        setRecurrenceForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const handleSaveRecurrence = async () => {
        if (!task?.id) {
            setIsEditingRecurrence(false);
            return;
        }

        try {
            const recurrencePayload: Partial<Task> = {
                recurrence_type: recurrenceForm.recurrence_type,
                recurrence_interval: recurrenceForm.recurrence_interval || 1,
                recurrence_end_date: recurrenceForm.recurrence_end_date || null,
                recurrence_weekday:
                    recurrenceForm.recurrence_type === 'weekly' ||
                    recurrenceForm.recurrence_type === 'monthly_weekday'
                        ? recurrenceForm.recurrence_weekday || null
                        : null,
                recurrence_weekdays:
                    recurrenceForm.recurrence_type === 'weekly'
                        ? recurrenceForm.recurrence_weekdays || []
                        : null,
                recurrence_month_day:
                    recurrenceForm.recurrence_type === 'monthly'
                        ? recurrenceForm.recurrence_month_day || null
                        : null,
                recurrence_week_of_month:
                    recurrenceForm.recurrence_type === 'monthly_weekday'
                        ? recurrenceForm.recurrence_week_of_month || null
                        : null,
                completion_based: recurrenceForm.completion_based,
            };

            await updateTask(task.id, { ...task, ...recurrencePayload });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.recurrenceUpdated', 'Recurrence updated successfully')
            );
            setIsEditingRecurrence(false);
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating recurrence:', error);
            showErrorToast(
                t('task.recurrenceUpdateError', 'Failed to update recurrence')
            );
            setIsEditingRecurrence(false);
        }
    };

    const handleCancelRecurrenceEdit = () => {
        setIsEditingRecurrence(false);
        setRecurrenceForm({
            recurrence_type: task?.recurrence_type || 'none',
            recurrence_interval: task?.recurrence_interval || 1,
            recurrence_end_date: task?.recurrence_end_date || '',
            recurrence_weekday: task?.recurrence_weekday || null,
            recurrence_weekdays: task?.recurrence_weekdays || [],
            recurrence_month_day: task?.recurrence_month_day || null,
            recurrence_week_of_month: task?.recurrence_week_of_month || null,
            completion_based: task?.completion_based || false,
        });
    };

    const handleRecurrenceCardClick = () => {
        if (task.recurring_parent_id) return;
        handleStartRecurrenceEdit();
    };

    const handleStartTagsEdit = () => {
        setEditedTags(task?.tags?.map((tag: any) => tag.name) || []);
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
        setIsEditingTags(true);
    };

    const handleStartDueDateEdit = () => {
        setEditedDueDate(task?.due_date || '');
        setIsEditingDueDate(true);
    };

    const handleSaveDueDate = async () => {
        if (!task?.id) {
            setIsEditingDueDate(false);
            setEditedDueDate(task?.due_date || '');
            return;
        }

        if ((editedDueDate || '') === (task.due_date || '')) {
            setIsEditingDueDate(false);
            return;
        }

        try {
            await updateTask(task.id, { ...task, due_date: editedDueDate || null });

            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.dueDateUpdated', 'Due date updated successfully')
            );
            setIsEditingDueDate(false);

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating due date:', error);
            showErrorToast(
                t('task.dueDateUpdateError', 'Failed to update due date')
            );
            setEditedDueDate(task.due_date || '');
            setIsEditingDueDate(false);
        }
    };

    const handleCancelDueDateEdit = () => {
        setIsEditingDueDate(false);
        setEditedDueDate(task?.due_date || '');
    };

    const formatDateWithDayName = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date().toISOString().split('T')[0];
        const isToday = dateString === today;

        const dayName = date.toLocaleDateString(i18n.language, { weekday: 'long' });
        const formattedDate = date.toLocaleDateString(i18n.language, {
            day: 'numeric',
            month: 'long',
        });

        return {
            dayName,
            formattedDate,
            fullText: `${dayName}, ${formattedDate}`,
            isToday,
        };
    };

    const getDueDateDisplay = (dueDate: string) => {
        const date = new Date(dueDate);
        if (Number.isNaN(date.getTime())) return null;

        const formattedDate = date.toLocaleDateString(i18n.language, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(date);
        target.setHours(0, 0, 0, 0);

        const diffDays = Math.round(
            (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        let relativeText = '';
        if (diffDays === 0) {
            relativeText = t('dateIndicators.today', 'today');
        } else if (diffDays === 1) {
            relativeText = t('dateIndicators.tomorrow', 'tomorrow');
        } else if (diffDays === -1) {
            relativeText = t('dateIndicators.yesterday', 'yesterday');
        } else if (diffDays > 0) {
            relativeText = t('task.inDays', 'in {{count}} days', {
                count: diffDays,
            });
        } else {
            relativeText = t('task.daysAgo', '{{count}} days ago', {
                count: Math.abs(diffDays),
            });
        }

        return { formattedDate, relativeText };
    };

    const getStatusLabel = () => {
        switch (task.status) {
            case 'not_started':
            case 0:
                return t('task.status.notStarted', 'not started');
            case 'in_progress':
            case 1:
                return t('task.status.inProgress', 'in progress');
            case 'done':
            case 2:
                return t('task.status.done', 'completed');
            case 'archived':
            case 3:
                return t('task.status.archived', 'archived');
            default:
                return t('task.status.unknown', 'ongoing');
        }
    };

    const getPriorityLabel = () => {
        if (task.priority === null || task.priority === undefined) {
            return null;
        }
        switch (task.priority) {
            case 'low':
            case 0:
                return t('task.lowPriority', 'low priority');
            case 'medium':
            case 1:
                return t('task.mediumPriority', 'medium priority');
            case 'high':
            case 2:
                return t('task.highPriority', 'high priority');
            default:
                return null;
        }
    };

    const getTaskPlainSummary = () => {
        const statusText = getStatusLabel();
        const priorityText = getPriorityLabel();
        const dueInfo = task.due_date ? getDueDateDisplay(task.due_date) : null;

        return (
            <span>
                {t('task.thisTask', 'This task')}{' '}
                {t('task.is', 'is')}{' '}
                <strong>{statusText}</strong>
                {priorityText && (
                    <>
                        {' '}{t('task.and', 'and')}{' '}
                        <strong>{priorityText}</strong>
                    </>
                )}
                {dueInfo && (
                    <>
                        {`, ${t('task.dueOn', 'due')} ${dueInfo.relativeText}`} {' '}
                            ({dueInfo.formattedDate})
                    </>
                )}
                {task.Project && (
                    <>
                        {`, ${t('task.inProject', 'from project')}`}{' '}
                        <strong>{task.Project.name}</strong>
                    </>
                )}
                .
            </span>
        );
    };

    const formatRecurrence = (recurrenceType: string) => {
        switch (recurrenceType) {
            case 'daily':
                return t('recurrence.daily', 'Daily');
            case 'weekly':
                return t('recurrence.weekly', 'Weekly');
            case 'monthly':
                return t('recurrence.monthly', 'Monthly');
            case 'monthly_weekday':
                return t('recurrence.monthlyWeekday', 'Monthly');
            case 'monthly_last_day':
                return t('recurrence.monthlyLastDay', 'Monthly');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    // Handle click outside project dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                projectDropdownRef.current &&
                !projectDropdownRef.current.contains(event.target as Node)
            ) {
                setProjectDropdownOpen(false);
                setProjectName('');
            }
        };

        if (projectDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [projectDropdownOpen]);

    useEffect(() => {
        const fetchTaskData = async () => {
            if (!uid) {
                setError('No task uid provided');
                setLoading(false);
                return;
            }

            // If task is not in store, load it
            if (!task) {
                try {
                    setLoading(true);
                    const fetchedTask = await fetchTaskByUid(uid);
                    // Add the task to the store
                    tasksStore.setTasks([...tasksStore.tasks, fetchedTask]);
                } catch (fetchError) {
                    setError('Task not found');
                    console.error('Error fetching task:', fetchError);
                } finally {
                    setLoading(false);
                }
            }

            // Subtasks are already loaded as part of the task data from the global store
        };

        fetchTaskData();
    }, [uid, task, tasksStore]);

    // Load next iterations for recurring tasks (both parent tasks and child tasks)
    useEffect(() => {
        const loadNextIterations = async () => {
            // For parent tasks, use the task's own ID
            if (
                task?.id &&
                task.recurrence_type &&
                task.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);
                    const iterations = await fetchTaskNextIterations(task.id);
                    setNextIterations(iterations);
                } catch (error) {
                    console.error('Error loading next iterations:', error);
                    setNextIterations([]);
                } finally {
                    setLoadingIterations(false);
                }
            }
            // For child tasks, use the parent task's ID and start from the child's due date
            else if (
                task?.recurring_parent_id &&
                parentTask?.id &&
                parentTask.recurrence_type &&
                parentTask.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);

                    // If child task has a due date, start iterations from that date
                    const startFromDate = task.due_date
                        ? task.due_date.split('T')[0]
                        : undefined;
                    const iterations = await fetchTaskNextIterations(
                        parentTask.id,
                        startFromDate
                    );

                    setNextIterations(iterations);
                } catch (error) {
                    console.error(
                        'Error loading next iterations for child task:',
                        error
                    );
                    setNextIterations([]);
                } finally {
                    setLoadingIterations(false);
                }
            } else {
                setNextIterations([]);
            }
        };

        loadNextIterations();
    }, [
        task?.id,
        task?.recurrence_type,
        task?.last_generated_date,
        task?.due_date,
        task?.recurring_parent_id,
        parentTask?.id,
        parentTask?.recurrence_type,
        parentTask?.last_generated_date,
    ]);

    // Load parent task for child tasks (recurring instances)
    useEffect(() => {
        const loadParentTask = async () => {
            if (task?.recurring_parent_uid) {
                try {
                    setLoadingParent(true);
                    const parent = await fetchTaskByUid(
                        task.recurring_parent_uid
                    );
                    setParentTask(parent);
                } catch (error) {
                    console.error('Error fetching parent task:', error);
                    setParentTask(null);
                } finally {
                    setLoadingParent(false);
                }
            }
        };

        loadParentTask();
    }, [task?.recurring_parent_uid]);

    const handleStartTitleEdit = () => {
        setIsEditingTitle(true);
        setEditedTitle(task?.name || '');
    };

    const handleSaveTitle = async () => {
        if (!task?.id || !editedTitle.trim()) {
            setIsEditingTitle(false);
            setEditedTitle(task?.name || '');
            return;
        }

        if (editedTitle.trim() === task.name) {
            setIsEditingTitle(false);
            return;
        }

        try {
            await updateTask(task.id, { ...task, name: editedTitle.trim() });

            // Update the task in the global store
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.titleUpdated', 'Task title updated successfully')
            );
            setIsEditingTitle(false);

            // Refresh timeline to show title change activity
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating task title:', error);
            showErrorToast(
                t('task.titleUpdateError', 'Failed to update task title')
            );
            setEditedTitle(task.name);
            setIsEditingTitle(false);
        }
    };

    const handleCancelTitleEdit = () => {
        setIsEditingTitle(false);
        setEditedTitle(task?.name || '');
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelTitleEdit();
        }
    };

    const handleStartContentEdit = () => {
        setIsEditingContent(true);
        setEditedContent(task?.note || '');
        setContentTab('edit');
    };

    const handleSaveContent = async () => {
        if (!task?.id) {
            setIsEditingContent(false);
            setEditedContent(task?.note || '');
            return;
        }

        // Allow saving empty content (to clear notes)
        const trimmedContent = editedContent.trim();

        if (trimmedContent === (task.note || '').trim()) {
            setIsEditingContent(false);
            return;
        }

        try {
            await updateTask(task.id, { ...task, note: trimmedContent });

            // Update the task in the global store
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.contentUpdated', 'Task content updated successfully')
            );
            setIsEditingContent(false);

            // Refresh timeline to show content change activity
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating task content:', error);
            showErrorToast(
                t('task.contentUpdateError', 'Failed to update task content')
            );
            setEditedContent(task.note || '');
            setIsEditingContent(false);
        }
    };

    const handleCancelContentEdit = () => {
        setIsEditingContent(false);
        setEditedContent(task?.note || '');
    };

    const handleContentKeyDown = (e: React.KeyboardEvent) => {
        // Cmd/Ctrl + Enter to save
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSaveContent();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelContentEdit();
        }
    };

    const handleStartSubtasksEdit = () => {
        setIsEditingSubtasks(true);
        setEditedSubtasks([...subtasks]);
    };

    const handleSaveSubtasks = async () => {
        if (!task?.id) {
            setIsEditingSubtasks(false);
            setEditedSubtasks([]);
            return;
        }

        try {
            // Update task with new subtasks
            await updateTask(task.id, { ...task, subtasks: editedSubtasks });

            // Refresh the task from server to get updated subtasks
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.subtasksUpdated', 'Subtasks updated successfully')
            );
            setIsEditingSubtasks(false);

            // Refresh timeline to show subtask changes
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating subtasks:', error);
            showErrorToast(
                t('task.subtasksUpdateError', 'Failed to update subtasks')
            );
            setEditedSubtasks([...subtasks]);
            setIsEditingSubtasks(false);
        }
    };

    const handleCancelSubtasksEdit = () => {
        setIsEditingSubtasks(false);
        setEditedSubtasks([]);
    };

    const handleProjectSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchTerm = e.target.value;
        setProjectName(searchTerm);
        setProjectDropdownOpen(true);

        if (searchTerm.trim() === '') {
            setFilteredProjects(projectsStore.projects.slice(0, 5));
        } else {
            const filtered = projectsStore.projects.filter((project) =>
                project.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredProjects(filtered.slice(0, 5));
        }
    };

    const handleProjectSelection = async (project: Project) => {
        if (!task?.id) return;

        try {
            await updateTask(task.id, { ...task, project_id: project.id });

            // Refresh the task from server
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            setProjectName('');
            setProjectDropdownOpen(false);
            showSuccessToast(
                t('task.projectUpdated', 'Project updated successfully')
            );

            // Refresh timeline
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating project:', error);
            showErrorToast(
                t('task.projectUpdateError', 'Failed to update project')
            );
        }
    };

    const handleClearProject = async () => {
        if (!task?.id) return;

        try {
            await updateTask(task.id, { ...task, project_id: null });

            // Refresh the task from server
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            showSuccessToast(
                t('task.projectCleared', 'Project cleared successfully')
            );

            // Refresh timeline
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error clearing project:', error);
            showErrorToast(
                t('task.projectClearError', 'Failed to clear project')
            );
        }
    };

    const handleCreateProjectInline = async () => {
        if (!task?.id || !projectName.trim()) return;

        setIsCreatingProject(true);
        try {
            const newProject = await createProject({ name: projectName });

            // Add to projects store
            projectsStore.setProjects([
                ...projectsStore.projects,
                newProject,
            ]);

            // Update task with new project
            await updateTask(task.id, { ...task, project_id: newProject.id });

            // Refresh the task from server
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            setProjectName('');
            setProjectDropdownOpen(false);
            setFilteredProjects([]);
            showSuccessToast(
                t('project.createdAndAssigned', 'Project created and assigned')
            );

            // Refresh timeline
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error creating project:', error);
            showErrorToast(
                t('project.createError', 'Failed to create project')
            );
        } finally {
            setIsCreatingProject(false);
        }
    };

    const handleShowAllProjects = () => {
        setProjectDropdownOpen(!projectDropdownOpen);
        if (!projectDropdownOpen) {
            setFilteredProjects(projectsStore.projects);
        }
    };

    const handleEdit = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
        }

        // Store modal state in sessionStorage to persist across re-mounts
        const modalState = {
            isOpen: true,
            taskId: uid,
            timestamp: Date.now(),
        };
        sessionStorage.setItem(
            'pendingTaskEditModalState',
            JSON.stringify(modalState)
        );

        setFocusSubtasks(false);
        setIsTaskModalOpen(true);
    };

    const handleToggleCompletion = async () => {
        if (!task?.id) return;

        try {
            const updatedTask = await toggleTaskCompletion(task.id);
            // Update the task in the global store
            if (uid) {
                const updatedTask = await fetchTaskByUid(uid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTask;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            const statusMessage =
                updatedTask.status === 'done' || updatedTask.status === 2
                    ? t('task.completedSuccess', 'Task marked as completed')
                    : t('task.reopenedSuccess', 'Task reopened');

            showSuccessToast(statusMessage);

            // Refresh timeline to show status change activity
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error toggling task completion:', error);
            showErrorToast(
                t('task.toggleError', 'Failed to update task status')
            );
        }
    };

    const handleTaskUpdate = async (updatedTask: Task) => {
        try {
            if (task?.id) {
                await updateTask(task.id, updatedTask);
                // Update the task in the global store
                if (uid) {
                    const updatedTaskFromServer = await fetchTaskByUid(uid);
                    const existingIndex = tasksStore.tasks.findIndex(
                        (t: Task) => t.uid === uid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...tasksStore.tasks];
                        updatedTasks[existingIndex] = updatedTaskFromServer;
                        tasksStore.setTasks(updatedTasks);
                    }
                }

                // Subtasks will be automatically updated when the task is reloaded from the global store

                // Refresh timeline to show new activity
                setTimelineRefreshKey((prev) => prev + 1);
            }
            setIsTaskModalOpen(false);
        } catch (error) {
            console.error('Error updating task:', error);
            showErrorToast(t('task.updateError', 'Failed to update task'));
        }
    };

    const handleDeleteClick = () => {
        if (task) {
            setTaskToDelete(task);
            setIsConfirmDialogOpen(true);
        }
    };

    const handleDeleteConfirm = async () => {
        if (taskToDelete?.id) {
            try {
                await deleteTask(taskToDelete.id);
                showSuccessToast(
                    t('task.deleteSuccess', 'Task deleted successfully')
                );
                navigate('/today'); // Navigate back to today view after deletion
            } catch (error) {
                console.error('Error deleting task:', error);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
    };

    const handleCreateProject = async (name: string): Promise<Project> => {
        try {
            return await createProject({ name });
        } catch (error) {
            console.error('Error creating project:', error);
            throw error;
        }
    };

    const getProjectLink = (project: Project) => {
        if (project.uid) {
            const slug = project.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/project/${project.uid}-${slug}`;
        }
        return `/project/${project.id}`;
    };

    if (loading) {
        return <LoadingScreen />;
    }

    if (error || !task) {
        return (
            <div className="flex justify-center px-4 lg:px-2">
                <div className="w-full max-w-5xl">
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
                        <ExclamationTriangleIcon className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto mb-8" />
                        <h1 className="text-2xl font-medium text-gray-700 dark:text-gray-300 mb-4">
                            {error || t('task.notFound', 'Task Not Found')}
                        </h1>
                        <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                            {t(
                                'task.notFoundDescription',
                                'The task you are looking for does not exist or has been deleted.'
                            )}
                        </p>
                        <button
                            onClick={() => navigate('/today')}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200"
                        >
                            {t('common.goToToday', 'Go to Today')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 lg:px-8 pt-6">
            <div className="w-full">
                {/* Header Section with Title and Action Buttons */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                        <TaskPriorityIcon
                            priority={task.priority}
                            status={task.status}
                            onToggleCompletion={handleToggleCompletion}
                        />
                        <div className="flex flex-col flex-1">
                            {isEditingTitle ? (
                                <div className="flex items-center space-x-2">
                                    <input
                                        ref={titleInputRef}
                                        type="text"
                                        value={editedTitle}
                                        onChange={(e) =>
                                            setEditedTitle(e.target.value)
                                        }
                                        onKeyDown={handleTitleKeyDown}
                                        onBlur={handleSaveTitle}
                                        className="text-2xl font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                                        placeholder={t(
                                            'task.titlePlaceholder',
                                            'Enter task title'
                                        )}
                                    />
                                    <button
                                        onClick={handleSaveTitle}
                                        className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 rounded-full transition-colors duration-200"
                                        title={t('common.save', 'Save')}
                                    >
                                        <CheckIcon className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={handleCancelTitleEdit}
                                        className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-full transition-colors duration-200"
                                        title={t('common.cancel', 'Cancel')}
                                    >
                                        <XMarkIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            ) : (
                                <h2
                                    onClick={handleStartTitleEdit}
                                    className="text-2xl font-normal text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 transition-colors"
                                    title={t(
                                        'task.clickToEditTitle',
                                        'Click to edit title'
                                    )}
                                >
                                    {task.name}
                                </h2>
                            )}
                        </div>
                    </div>
                    <div className="relative" ref={actionsMenuRef}>
                        <button
                            className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 rounded transition-colors duration-200 text-base"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setActionsMenuOpen(!actionsMenuOpen);
                            }}
                            aria-haspopup="true"
                            aria-expanded={actionsMenuOpen}
                            aria-label={t('common.moreActions', 'More actions')}
                        >
                            ...
                        </button>
                        {actionsMenuOpen && (
                            <div className="absolute right-0 mt-2 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-20">
                                <button
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActionsMenuOpen(false);
                                        handleEdit();
                                    }}
                                >
                                    {t('common.edit', 'Edit')}
                                </button>
                                <button
                                    className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-b-lg"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActionsMenuOpen(false);
                                        handleDeleteClick();
                                    }}
                                >
                                    {t('common.delete', 'Delete')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Overdue Alert */}
                {!isSummaryAlertDismissed && (
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded-r-lg relative">
                        <button
                            onClick={() => setIsSummaryAlertDismissed(true)}
                            className="absolute top-2 right-2 p-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                            aria-label={t('common.close', 'Close')}
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                        <div className="flex items-center pr-8">
                            <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-300 mr-3 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                    {getTaskPlainSummary()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}
                {isTaskOverdue(task) && !isOverdueAlertDismissed && (
                    <div className="mb-6 mt-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-lg relative">
                        <button
                            onClick={() => setIsOverdueAlertDismissed(true)}
                            className="absolute top-2 right-2 p-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                            aria-label={t('common.close', 'Close')}
                        >
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                        <div className="flex items-start pr-8">
                            <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    {t(
                                        'task.overdueAlert',
                                        "This task was in your plan yesterday and wasn't completed."
                                    )}
                                </p>
                                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                    {task.today_move_count &&
                                    task.today_move_count > 1
                                        ? t(
                                              'task.overdueMultipleDays',
                                              `This task has been postponed {{count}} times.`,
                                              { count: task.today_move_count }
                                          )
                                        : t(
                                              'task.overdueYesterday',
                                              'Consider prioritizing this task or breaking it into smaller steps.'
                                          )}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Content - Full width layout */}
                <div className="mb-8 mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Left Column - Main Content */}
                        <div className="lg:col-span-3 space-y-8">
                            {/* Notes Section - Always Visible */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.content', 'Content')}
                                </h4>
                                {isEditingContent ? (
                                    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 p-6">
                                        <div className="relative">
                                            {/* Floating toggle buttons */}
                                            <div className="absolute top-2 right-2 z-10 flex space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setContentTab('edit')
                                                    }
                                                    className={`p-1.5 rounded-md transition-colors ${
                                                        contentTab === 'edit'
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                                                    }`}
                                                    title={t(
                                                        'common.edit',
                                                        'Edit'
                                                    )}
                                                >
                                                    <PencilIcon className="h-3 w-3" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setContentTab('preview')
                                                    }
                                                    className={`p-1.5 rounded-md transition-colors ${
                                                        contentTab === 'preview'
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'
                                                    }`}
                                                    title={t(
                                                        'common.preview',
                                                        'Preview'
                                                    )}
                                                >
                                                    <EyeIcon className="h-3 w-3" />
                                                </button>
                                            </div>

                                            {contentTab === 'edit' ? (
                                                <textarea
                                                    ref={contentTextareaRef}
                                                    value={editedContent}
                                                    onChange={(e) =>
                                                        setEditedContent(
                                                            e.target.value
                                                        )
                                                    }
                                                    onKeyDown={
                                                        handleContentKeyDown
                                                    }
                                                    className="w-full min-h-[200px] bg-transparent border-none focus:ring-0 focus:outline-none text-gray-900 dark:text-gray-100 resize-y font-normal pr-20"
                                                    placeholder={t(
                                                        'task.contentPlaceholder',
                                                        'Add content here... (Markdown supported)'
                                                    )}
                                                />
                                            ) : (
                                                <div className="w-full min-h-[200px] bg-gray-50 dark:bg-gray-800 rounded p-3 pr-20 overflow-y-auto">
                                                    {editedContent ? (
                                                        <MarkdownRenderer
                                                            content={
                                                                editedContent
                                                            }
                                                            className="prose dark:prose-invert max-w-none"
                                                        />
                                                    ) : (
                                                        <p className="text-gray-500 dark:text-gray-400 italic">
                                                            {t(
                                                                'task.noContentPreview',
                                                                'No content to preview. Switch to Edit mode to add content.'
                                                            )}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {t(
                                                    'task.contentEditHint',
                                                    'Press Cmd/Ctrl+Enter to save, Esc to cancel'
                                                )}
                                            </span>
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={handleSaveContent}
                                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                                >
                                                    {t('common.save', 'Save')}
                                                </button>
                                                <button
                                                    onClick={
                                                        handleCancelContentEdit
                                                    }
                                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    {t('common.cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : task.note ? (
                                    <div
                                        onClick={handleStartContentEdit}
                                        className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                                        title={t(
                                            'task.clickToEditContent',
                                            'Click to edit content'
                                        )}
                                    >
                                        <MarkdownRenderer
                                            content={task.note}
                                            className="prose dark:prose-invert max-w-none"
                                        />
                                    </div>
                                ) : (
                                    <div
                                        onClick={handleStartContentEdit}
                                        className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                                        title={t(
                                            'task.clickToAddContent',
                                            'Click to add content'
                                        )}
                                    >
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                                            <PencilSquareIcon className="h-12 w-12 mb-3 opacity-50" />
                                            <span className="text-sm text-center">
                                                {t(
                                                    'task.noNotes',
                                                    'No content added yet'
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Subtasks Section - Always Visible */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.subtasks', 'Subtasks')}
                                </h4>
                                {isEditingSubtasks ? (
                                    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-blue-500 dark:border-blue-400 p-6">
                                        <TaskSubtasksSection
                                            parentTaskId={task.id!}
                                            subtasks={editedSubtasks}
                                            onSubtasksChange={setEditedSubtasks}
                                        />
                                        <div className="flex items-center justify-end mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                            <div className="flex space-x-2">
                                                <button
                                                    onClick={handleSaveSubtasks}
                                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                                >
                                                    {t('common.save', 'Save')}
                                                </button>
                                                <button
                                                    onClick={
                                                        handleCancelSubtasksEdit
                                                    }
                                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    {t('common.cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : subtasks.length > 0 ? (
                                    <div className="space-y-0.5">
                                        {subtasks.map((subtask: Task) => (
                                            <div
                                                key={subtask.id}
                                                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 transition-all duration-200 ${
                                                    subtask.status ===
                                                        'in_progress' ||
                                                    subtask.status === 1
                                                        ? 'border-green-400/60 dark:border-green-500/60'
                                                        : 'border-gray-50 dark:border-gray-800'
                                                }`}
                                            >
                                                <div className="px-3 py-3 flex items-center space-x-3">
                                                    <TaskPriorityIcon
                                                        priority={
                                                            subtask.priority
                                                        }
                                                        status={
                                                            subtask.status
                                                        }
                                                        onToggleCompletion={async () => {
                                                            console.log(
                                                                'Toggling subtask:',
                                                                subtask.id
                                                            );
                                                            if (
                                                                subtask.id
                                                            ) {
                                                                try {
                                                                    // Pass the current subtask to avoid fetching it
                                                                    await toggleTaskCompletion(
                                                                        subtask.id,
                                                                        subtask
                                                                    );
                                                                    // Refresh task data which includes updated subtasks
                                                                    if (
                                                                        uid
                                                                    ) {
                                                                        const updatedTask =
                                                                            await fetchTaskByUid(
                                                                                uid
                                                                            );
                                                                        const existingIndex =
                                                                            tasksStore.tasks.findIndex(
                                                                                (
                                                                                    t: Task
                                                                                ) =>
                                                                                    t.uid ===
                                                                                    uid
                                                                            );
                                                                        if (
                                                                            existingIndex >=
                                                                            0
                                                                        ) {
                                                                            const updatedTasks =
                                                                                [
                                                                                    ...tasksStore.tasks,
                                                                                ];
                                                                            updatedTasks[
                                                                                existingIndex
                                                                            ] =
                                                                                updatedTask;
                                                                            tasksStore.setTasks(
                                                                                updatedTasks
                                                                            );
                                                                        }
                                                                    }

                                                                    // Refresh timeline to show subtask completion activity
                                                                    setTimelineRefreshKey(
                                                                        (
                                                                            prev
                                                                        ) =>
                                                                            prev +
                                                                            1
                                                                    );
                                                                } catch (error) {
                                                                    console.error(
                                                                        'Error toggling subtask completion:',
                                                                        error
                                                                    );
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    <span
                                                        onClick={
                                                            handleStartSubtasksEdit
                                                        }
                                                        className={`text-base flex-1 truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                                                            subtask.status ===
                                                                'done' ||
                                                            subtask.status ===
                                                                2 ||
                                                            subtask.status ===
                                                                'archived' ||
                                                            subtask.status ===
                                                                3
                                                                ? 'text-gray-500 dark:text-gray-400'
                                                                : 'text-gray-900 dark:text-gray-100'
                                                        }`}
                                                        title={t(
                                                            'task.clickToEditSubtasks',
                                                            'Click to edit subtasks'
                                                        )}
                                                    >
                                                        {subtask.name}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div
                                        onClick={handleStartSubtasksEdit}
                                        className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 cursor-pointer transition-colors"
                                        title={t(
                                            'task.clickToEditSubtasks',
                                            'Click to add or edit subtasks'
                                        )}
                                    >
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                                            <ListBulletIcon className="h-12 w-12 mb-3 opacity-50" />
                                            <span className="text-sm text-center">
                                                {t(
                                                    'task.noSubtasksClickToAdd',
                                                    'No subtasks yet, click to add'
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t(
                                        'task.recurringSetup',
                                        'Recurring Setup'
                                    )}
                                </h4>
                                <div
                                    className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-6 space-y-4 ${
                                        !task.recurring_parent_id &&
                                        !isEditingRecurrence
                                            ? 'cursor-pointer'
                                            : ''
                                    }`}
                                    onClick={
                                        !task.recurring_parent_id && !isEditingRecurrence
                                            ? handleRecurrenceCardClick
                                            : undefined
                                    }
                                    role={
                                        !task.recurring_parent_id && !isEditingRecurrence
                                            ? 'button'
                                            : undefined
                                    }
                                    tabIndex={
                                        !task.recurring_parent_id && !isEditingRecurrence
                                            ? 0
                                            : -1
                                    }
                                    onKeyDown={(e) => {
                                        if (
                                            !isEditingRecurrence &&
                                            !task.recurring_parent_id &&
                                            e.key === 'Enter'
                                        ) {
                                            e.preventDefault();
                                            handleRecurrenceCardClick();
                                        }
                                    }}
                                >
                                    {task.recurring_parent_id && (
                                        <div className="mb-4">
                                            <div className="flex items-center mb-2">
                                                <ArrowPathIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                    {t(
                                                        'task.instanceOf',
                                                        'This is an instance of a recurring task'
                                                    )}
                                                </span>
                                            </div>
                                            {loadingParent && (
                                                <div className="flex items-center py-2">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {t(
                                                            'common.loading',
                                                            'Loading parent task...'
                                                        )}
                                                    </span>
                                                </div>
                                            )}
                                            {parentTask && (
                                                <div className="ml-6">
                                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                                        <strong>
                                                            {t(
                                                                'task.parentTask',
                                                                'Parent Task'
                                                            )}
                                                            :
                                                        </strong>{' '}
                                                        <Link
                                                            to={`/task/${parentTask.uid}`}
                                                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
                                                        >
                                                            {
                                                                parentTask.name
                                                            }
                                                        </Link>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isEditingRecurrence &&
                                    !task.recurring_parent_id ? (
                                        <div className="space-y-4">
                                                    <TaskRecurrenceSection
                                                        recurrenceType={
                                                            recurrenceForm.recurrence_type
                                                        }
                                                        recurrenceInterval={
                                                        recurrenceForm.recurrence_interval
                                                    }
                                                    recurrenceEndDate={
                                                        recurrenceForm.recurrence_end_date ||
                                                        undefined
                                                    }
                                                    recurrenceWeekday={
                                                        recurrenceForm.recurrence_weekday ||
                                                        undefined
                                                    }
                                                    recurrenceWeekdays={
                                                        recurrenceForm.recurrence_weekdays ||
                                                        []
                                                    }
                                                    recurrenceMonthDay={
                                                        recurrenceForm.recurrence_month_day ||
                                                        undefined
                                                    }
                                                    recurrenceWeekOfMonth={
                                                                recurrenceForm.recurrence_week_of_month ||
                                                                undefined
                                                            }
                                                        completionBased={
                                                            recurrenceForm.completion_based
                                                        }
                                                        onChange={
                                                            handleRecurrenceChange
                                                        }
                                                    />
                                                    <div className="flex justify-end space-x-2">
                                                        <button
                                                            onClick={handleSaveRecurrence}
                                                            className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                                        >
                                                            {t(
                                                                'common.save',
                                                                'Save'
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={handleCancelRecurrenceEdit}
                                                            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                        >
                                                            {t(
                                                                'common.cancel',
                                                                'Cancel'
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {(task.recurrence_type &&
                                                    task.recurrence_type !==
                                                        'none') ||
                                                (parentTask?.recurrence_type &&
                                                    parentTask.recurrence_type !==
                                                        'none') ? (
                                                    <div className="mb-4">
                                                        <RecurrenceDisplay
                                                            recurrenceType={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_type
                                                                    ? parentTask.recurrence_type
                                                                    : task.recurrence_type
                                                            }
                                                            recurrenceInterval={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_interval
                                                                    ? parentTask.recurrence_interval
                                                                    : task.recurrence_interval
                                                            }
                                                            recurrenceWeekdays={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_weekdays
                                                                    ? parentTask.recurrence_weekdays
                                                                    : task.recurrence_weekdays
                                                            }
                                                            recurrenceEndDate={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_end_date
                                                                    ? parentTask.recurrence_end_date
                                                                    : task.recurrence_end_date
                                                            }
                                                            recurrenceMonthDay={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_month_day
                                                                    ? parentTask.recurrence_month_day
                                                                    : task.recurrence_month_day
                                                            }
                                                            recurrenceWeekOfMonth={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_week_of_month
                                                                    ? parentTask.recurrence_week_of_month
                                                                    : task.recurrence_week_of_month
                                                            }
                                                            recurrenceWeekday={
                                                                task.recurring_parent_id &&
                                                                parentTask?.recurrence_weekday
                                                                    ? parentTask.recurrence_weekday
                                                                    : task.recurrence_weekday
                                                            }
                                                            completionBased={
                                                                task.recurring_parent_id &&
                                                                parentTask?.completion_based
                                                                    ? parentTask.completion_based
                                                                    : task.completion_based
                                                            }
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                                        {t(
                                                            'task.notRecurring',
                                                            'This task is not recurring yet.'
                                                        )}
                                                    </div>
                                                )}

                                                {((task.recurrence_type &&
                                                    task.recurrence_type !==
                                                        'none') ||
                                                    (task.recurring_parent_id &&
                                                        parentTask?.recurrence_type &&
                                                        parentTask.recurrence_type !==
                                                            'none')) && (
                                                    <div>
                                                        <div className="flex items-center mb-3">
                                                            <ClockIcon className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                                {task.recurring_parent_id
                                                                    ? t(
                                                                          'task.nextOccurrencesAfterThis',
                                                                          'Next Occurrences After This'
                                                                      )
                                                                    : t(
                                                                          'task.nextOccurrences',
                                                                          'Next Occurrences'
                                                                      )}
                                                                {!loadingIterations &&
                                                                    nextIterations.length >
                                                                        0 &&
                                                                    nextIterations.some(
                                                                        (
                                                                            iter
                                                                        ) =>
                                                                            formatDateWithDayName(
                                                                                iter.date
                                                                            ).isToday
                                                                    ) && (
                                                                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                                                                            (
                                                                            {t(
                                                                                'task.includingToday',
                                                                                'including today'
                                                                            )}
                                                                            )
                                                                        </span>
                                                                    )}
                                                            </span>
                                                        </div>

                                                        {loadingIterations ? (
                                                            <div className="flex items-center justify-center py-4">
                                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                                                                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                                                                    {t(
                                                                        'common.loading',
                                                                        'Loading...'
                                                                    )}
                                                                </span>
                                                            </div>
                                                        ) : nextIterations.length >
                                                          0 ? (
                                                            <div className="space-y-2">
                                                                {nextIterations.map(
                                                                    (
                                                                        iteration,
                                                                        index
                                                                    ) => {
                                                                        const dateInfo =
                                                                            formatDateWithDayName(
                                                                                iteration.date
                                                                            );
                                                                        return (
                                                                            <div
                                                                                key={
                                                                                    index
                                                                                }
                                                                                className={`flex items-center py-2 px-3 rounded transition-colors ${
                                                                                    dateInfo.isToday
                                                                                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800'
                                                                                        : 'bg-gray-50 dark:bg-gray-800 border border-transparent'
                                                                                }`}
                                                                            >
                                                                                <div
                                                                                    className={`w-7 h-7 rounded-full flex items-center justify-center mr-3 ${
                                                                                        dateInfo.isToday
                                                                                            ? 'bg-blue-600 dark:bg-blue-500'
                                                                                            : 'bg-blue-100 dark:bg-blue-900'
                                                                                    }`}
                                                                                >
                                                                                    <span
                                                                                        className={`text-xs font-medium ${
                                                                                            dateInfo.isToday
                                                                                                ? 'text-white'
                                                                                                : 'text-blue-600 dark:text-blue-400'
                                                                                        }`}
                                                                                    >
                                                                                        {index +
                                                                                            1}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex-1">
                                                                                    <div
                                                                                        className={`text-sm font-medium ${
                                                                                            dateInfo.isToday
                                                                                                ? 'text-blue-900 dark:text-blue-100'
                                                                                                : 'text-gray-900 dark:text-gray-100'
                                                                                        }`}
                                                                                    >
                                                                                        {
                                                                                            dateInfo.dayName
                                                                                        }
                                                                                        {dateInfo.isToday && (
                                                                                            <span className="ml-2 text-xs px-2 py-0.5 bg-blue-600 dark:bg-blue-500 text-white rounded-full font-semibold">
                                                                                                {t(
                                                                                                    'dateIndicators.today',
                                                                                                    'TODAY'
                                                                                                )}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div
                                                                                        className={`text-xs ${
                                                                                            dateInfo.isToday
                                                                                                ? 'text-blue-700 dark:text-blue-300'
                                                                                                : 'text-gray-500 dark:text-gray-400'
                                                                                        }`}
                                                                                    >
                                                                                        {
                                                                                            dateInfo.formattedDate
                                                                                        }
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                                                                {t(
                                                                    'task.noMoreIterations',
                                                                    'No more iterations scheduled'
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                        {/* Right Column - Metadata and Recent Activity */}
                        <div className="space-y-6">
                            {/* Project Section */}
                            <div ref={projectDropdownRef}>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.project', 'Project')}
                                </h4>
                                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-4">
                                    {projectDropdownOpen ? (
                                        <ProjectDropdown
                                            projectName={projectName}
                                            onProjectSearch={handleProjectSearch}
                                            dropdownOpen={projectDropdownOpen}
                                            filteredProjects={filteredProjects}
                                            onProjectSelection={handleProjectSelection}
                                            onCreateProject={handleCreateProjectInline}
                                            isCreatingProject={isCreatingProject}
                                            onShowAllProjects={handleShowAllProjects}
                                            allProjects={projectsStore.projects}
                                            selectedProject={null}
                                            onClearProject={handleClearProject}
                                        />
                                    ) : task.Project ? (
                                        <div
                                            onClick={() => setProjectDropdownOpen(true)}
                                            className="bg-gray-50 dark:bg-gray-900 rounded-lg shadow-sm relative cursor-pointer hover:opacity-90 transition-opacity"
                                        >
                                            <div
                                                className="flex items-center justify-center overflow-hidden rounded-t-lg relative"
                                                style={{ height: '100px' }}
                                            >
                                                {task.Project.image_url ? (
                                                    <img
                                                        src={task.Project.image_url}
                                                        alt={task.Project.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700"></div>
                                                )}
                                            </div>
                                            <div className="p-3">
                                                <div className="flex items-center text-md font-semibold text-gray-900 dark:text-gray-100">
                                                    <span className="truncate">
                                                        {task.Project.name}
                                                    </span>
                                                    <Link
                                                        to={getProjectLink(task.Project)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex-shrink-0 ml-auto"
                                                        title={t(
                                                            'project.viewProject',
                                                            'Go to project'
                                                        )}
                                                    >
                                                        <ArrowRightIcon className="h-4 w-4" />
                                                        <span className="sr-only">
                                                            {t(
                                                                'project.viewProject',
                                                                'Go to project'
                                                            )}
                                                        </span>
                                                    </Link>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => setProjectDropdownOpen(true)}
                                            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 p-6 cursor-pointer transition-colors flex items-center justify-center"
                                        >
                                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                {t('task.noProject', 'No project - Click to assign')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tags Section */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.tags', 'Tags')}
                                </h4>
                                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors p-4 space-y-3">
                                    {isEditingTags ? (
                                        <div className="space-y-3">
                                            <TagInput
                                                initialTags={editedTags}
                                                onTagsChange={setEditedTags}
                                                availableTags={tagsStore.tags}
                                                onFocus={() => {
                                                    if (
                                                        !tagsStore.hasLoaded &&
                                                        !tagsStore.isLoading
                                                    ) {
                                                        tagsStore.loadTags();
                                                    }
                                                }}
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={handleSaveTags}
                                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                                >
                                                    {t('common.save', 'Save')}
                                                </button>
                                                <button
                                                    onClick={handleCancelTagsEdit}
                                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                                                >
                                                    {t('common.cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : task.tags && task.tags.length > 0 ? (
                                        <div className="space-y-1">
                                            {task.tags.map((tag: any) => (
                                                <button
                                                    key={
                                                        tag.uid ||
                                                        tag.id ||
                                                        tag.name
                                                    }
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleStartTagsEdit();
                                                    }}
                                                    className="group flex w-full items-center justify-between px-3 py-1.5 rounded-md bg-white dark:bg-gray-900 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                                >
                                                    <div className="flex items-center space-x-2 min-w-0">
                                                        <TagIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                                                            {tag.name}
                                                        </span>
                                                    </div>
                                                    <ArrowRightIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300 flex-shrink-0" />
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <div
                                            onClick={handleStartTagsEdit}
                                            className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 cursor-pointer transition-colors"
                                        >
                                            <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                {t('task.noTags', 'No tags')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Priority Section */}
                            <div className="min-w-0">
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.priority', 'Priority')}
                                </h4>
                                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await updateTask(task.id, {
                                                        ...task,
                                                        priority: null,
                                                    });
                                                    const updatedTask =
                                                        await fetchTaskByUid(uid!);
                                                    tasksStore.updateTaskInStore(
                                                        updatedTask
                                                    );
                                                    setTimelineRefreshKey(
                                                        (prev) => prev + 1
                                                    );
                                                    showSuccessToast(
                                                        t(
                                                            'task.priorityUpdated',
                                                            'Priority updated successfully'
                                                        )
                                                    );
                                                } catch (error) {
                                                    console.error(
                                                        'Error updating priority:',
                                                        error
                                                    );
                                                    showErrorToast(
                                                        t(
                                                            'task.priorityUpdateError',
                                                            'Failed to update priority'
                                                        )
                                                    );
                                                }
                                            }}
                                            className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                                                task.priority === null || task.priority === undefined
                                                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                            }`}
                                        >
                                            {t('priority.none', 'None')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await updateTask(task.id, {
                                                        ...task,
                                                        priority: 'low',
                                                    });
                                                    const updatedTask =
                                                        await fetchTaskByUid(uid!);
                                                    tasksStore.updateTaskInStore(
                                                        updatedTask
                                                    );
                                                    setTimelineRefreshKey(
                                                        (prev) => prev + 1
                                                    );
                                                    showSuccessToast(
                                                        t(
                                                            'task.priorityUpdated',
                                                            'Priority updated successfully'
                                                        )
                                                    );
                                                } catch (error) {
                                                    console.error(
                                                        'Error updating priority:',
                                                        error
                                                    );
                                                    showErrorToast(
                                                        t(
                                                            'task.priorityUpdateError',
                                                            'Failed to update priority'
                                                        )
                                                    );
                                                }
                                            }}
                                            className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                                                task.priority === 'low' || task.priority === 0
                                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                                            }`}
                                        >
                                            {t('priority.low', 'Low')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await updateTask(task.id, {
                                                        ...task,
                                                        priority: 'medium',
                                                    });
                                                    const updatedTask =
                                                        await fetchTaskByUid(uid!);
                                                    tasksStore.updateTaskInStore(
                                                        updatedTask
                                                    );
                                                    setTimelineRefreshKey(
                                                        (prev) => prev + 1
                                                    );
                                                    showSuccessToast(
                                                        t(
                                                            'task.priorityUpdated',
                                                            'Priority updated successfully'
                                                        )
                                                    );
                                                } catch (error) {
                                                    console.error(
                                                        'Error updating priority:',
                                                        error
                                                    );
                                                    showErrorToast(
                                                        t(
                                                            'task.priorityUpdateError',
                                                            'Failed to update priority'
                                                        )
                                                    );
                                                }
                                            }}
                                            className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                                                task.priority === 'medium' || task.priority === 1
                                                    ? 'bg-yellow-500 dark:bg-yellow-600 text-white'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50'
                                            }`}
                                        >
                                            {t('priority.medium', 'Medium')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                try {
                                                    await updateTask(task.id, {
                                                        ...task,
                                                        priority: 'high',
                                                    });
                                                    const updatedTask =
                                                        await fetchTaskByUid(uid!);
                                                    tasksStore.updateTaskInStore(
                                                        updatedTask
                                                    );
                                                    setTimelineRefreshKey(
                                                        (prev) => prev + 1
                                                    );
                                                    showSuccessToast(
                                                        t(
                                                            'task.priorityUpdated',
                                                            'Priority updated successfully'
                                                        )
                                                    );
                                                } catch (error) {
                                                    console.error(
                                                        'Error updating priority:',
                                                        error
                                                    );
                                                    showErrorToast(
                                                        t(
                                                            'task.priorityUpdateError',
                                                            'Failed to update priority'
                                                        )
                                                    );
                                                }
                                            }}
                                            className={`w-full min-w-0 px-3 py-2 text-sm font-medium rounded transition-colors whitespace-nowrap ${
                                                task.priority === 'high' || task.priority === 2
                                                    ? 'bg-red-500 dark:bg-red-600 text-white'
                                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                                            }`}
                                        >
                                            {t('priority.high', 'High')}
                                        </button>
                                </div>
                            </div>

                            {/* Due Date Section */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.dueDate', 'Due Date')}
                                </h4>
                                <div className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors ${
                                    task.due_date && (() => {
                                        const dueDate = new Date(task.due_date);
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        dueDate.setHours(0, 0, 0, 0);
                                        const isCompleted = task.status === 'done' || task.status === 2 || task.status === 'archived' || task.status === 3 || task.completed_at;
                                        return dueDate < today && !isCompleted;
                                    })() ? 'border-red-500 dark:border-red-400' : ''
                                }`}>
                                    {isEditingDueDate ? (
                                        <div className="space-y-3">
                                            <TaskDueDateSection
                                                value={editedDueDate}
                                                onChange={setEditedDueDate}
                                                placeholder={t(
                                                    'forms.task.dueDatePlaceholder',
                                                    'Select due date'
                                                )}
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={handleSaveDueDate}
                                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                                >
                                                    {t('common.save', 'Save')}
                                                </button>
                                                <button
                                                    onClick={
                                                        handleCancelDueDateEdit
                                                    }
                                                    className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                >
                                                    {t('common.cancel', 'Cancel')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleStartDueDateEdit}
                                            className="flex w-full items-center justify-between text-left"
                                        >
                                            {task.due_date ? (
                                                (() => {
                                                    const display =
                                                        getDueDateDisplay(
                                                            task.due_date
                                                        );
                                                    if (!display) return null;
                                                    // Check if due date is in the past and task is not completed
                                                    const dueDate = new Date(task.due_date);
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    dueDate.setHours(0, 0, 0, 0);
                                                    const isCompleted = task.status === 'done' || task.status === 2 || task.status === 'archived' || task.status === 3 || task.completed_at;
                                                    const overdue = dueDate < today && !isCompleted;

                                                    return (
                                                        <div className={`flex items-center justify-between w-full ${
                                                            overdue
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : 'text-gray-900 dark:text-gray-100'
                                                        }`}>
                                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                <CalendarIcon className={`h-4 w-4 flex-shrink-0 ${
                                                                    overdue
                                                                        ? 'text-red-600 dark:text-red-400'
                                                                        : 'text-gray-500 dark:text-gray-400'
                                                                }`} />
                                                                <span className="text-sm font-medium">
                                                                    {display.formattedDate}
                                                                </span>
                                                                <span className={`text-sm italic ${
                                                                    overdue
                                                                        ? 'text-red-500 dark:text-red-400 font-medium'
                                                                        : 'text-gray-500 dark:text-gray-400'
                                                                }`}>
                                                                    ({display.relativeText})
                                                                </span>
                                                            </div>
                                                            {overdue && (
                                                                <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 ml-2" />
                                                            )}
                                                        </div>
                                                    );
                                                })()
                                            ) : (
                                                <span className="text-sm text-gray-500 dark:text-gray-400 italic">
                                                    {t(
                                                        'task.noDueDate',
                                                        'No due date'
                                                    )}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Recent Activity Section */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.recentActivity', 'Recent Activity')}
                                </h4>
                                <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                                    <TaskTimeline
                                        taskUid={task.uid}
                                        refreshKey={timelineRefreshKey}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* End of main content sections */}

                {/* Task Modal for Editing - Only render when we have task data */}
                {task && (
                    <TaskModal
                        isOpen={isTaskModalOpen}
                        task={task}
                        onClose={() => {
                            setIsTaskModalOpen(false);
                            setFocusSubtasks(false);
                            // Clear pending state when modal is closed
                            sessionStorage.removeItem('pendingModalState');
                            sessionStorage.removeItem(
                                'pendingTaskEditModalState'
                            );
                        }}
                        onSave={handleTaskUpdate}
                        onDelete={async (taskId: number) => {
                            await deleteTask(taskId);
                            navigate('/today');
                        }}
                        projects={projects}
                        onCreateProject={handleCreateProject}
                        showToast={false}
                        initialSubtasks={task.subtasks || task.Subtasks || []}
                        autoFocusSubtasks={focusSubtasks}
                    />
                )}

                {/* Confirm Delete Dialog */}
                {isConfirmDialogOpen && taskToDelete && (
                    <ConfirmDialog
                        title={t('task.deleteConfirmTitle', 'Delete Task')}
                        message={t(
                            'task.deleteConfirmMessage',
                            'Are you sure you want to delete this task? This action cannot be undone.'
                        )}
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => {
                            setIsConfirmDialogOpen(false);
                            setTaskToDelete(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default TaskDetails;
