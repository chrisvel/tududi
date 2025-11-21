import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    ExclamationTriangleIcon,
    ListBulletIcon,
    ClockIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskModal from './TaskModal';
import RecurrenceDisplay from './RecurrenceDisplay';
import TaskSubtasksSection from './TaskForm/TaskSubtasksSection';
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
import TaskTimeline from './TaskTimeline';
import TaskDueDateSection from './TaskForm/TaskDueDateSection';
import TaskRecurrenceSection from './TaskForm/TaskRecurrenceSection';
import {
    TaskDetailsHeader,
    TaskSummaryAlerts,
    TaskContentSection,
    TaskRecurringInstanceInfo,
    TaskProjectSection,
    TaskTagsSection,
    TaskPrioritySection,
} from './TaskDetails/';

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
    const [isEditingSubtasks, setIsEditingSubtasks] = useState(false);
    const [editedSubtasks, setEditedSubtasks] = useState<Task[]>([]);
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
            await updateTask(task.id, {
                ...task,
                due_date: editedDueDate || null,
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

        const dayName = date.toLocaleDateString(i18n.language, {
            weekday: 'long',
        });
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
                {t('task.thisTask', 'This task')} {' '}
                {t('task.is', 'is')} <strong>{statusText}</strong>
                {priorityText && (
                    <>
                        {' '}
                        {t('task.and', 'and')} {t('task.has', 'has')}{' '}
                        <strong>{priorityText}</strong>
                    </>
                )}
                {dueInfo && (
                    <>
                        {`, ${t('task.dueOn', 'due')} ${dueInfo.relativeText}`}{' '}
                        ({dueInfo.formattedDate})
                    </>
                )}
                {task.Project && (
                    <>
                        {`, ${t('task.fromProject', 'from project')}`}{' '}
                        <strong>{task.Project.name}</strong>
                    </>
                )}
                .
            </span>
        );
    };


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

    // Wrapper handlers for new components
    const handleTitleUpdate = async (newTitle: string) => {
        if (!task?.id || !newTitle.trim()) {
            return;
        }

        if (newTitle.trim() === task.name) {
            return;
        }

        try {
            await updateTask(task.id, { ...task, name: newTitle.trim() });

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

            // Refresh timeline to show title change activity
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating task title:', error);
            showErrorToast(
                t('task.titleUpdateError', 'Failed to update task title')
            );
            throw error;
        }
    };

    const handleContentUpdate = async (newContent: string) => {
        if (!task?.id) {
            return;
        }

        const trimmedContent = newContent.trim();

        if (trimmedContent === (task.note || '').trim()) {
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

            // Refresh timeline to show content change activity
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating task content:', error);
            showErrorToast(
                t('task.contentUpdateError', 'Failed to update task content')
            );
            throw error;
        }
    };

    const handleProjectCreateInlineWrapper = async (name: string) => {
        if (!task?.id || !name.trim()) return;

        try {
            const newProject = await createProject({ name });

            // Add to projects store
            projectsStore.setProjects([...projectsStore.projects, newProject]);

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
            throw error;
        }
    };

    const handleTagsUpdate = async (tags: string[]) => {
        if (!task?.id) {
            return;
        }

        const currentTags = task.tags?.map((tag: any) => tag.name) || [];
        if (
            tags.length === currentTags.length &&
            tags.every((tag, idx) => tag === currentTags[idx])
        ) {
            return;
        }

        try {
            await updateTask(task.id, {
                ...task,
                tags: tags.map((name) => ({ name })),
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

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating tags:', error);
            showErrorToast(t('task.tagsUpdateError', 'Failed to update tags'));
            throw error;
        }
    };

    const handlePriorityUpdate = async (priority: any) => {
        if (!task?.id) return;

        try {
            await updateTask(task.id, {
                ...task,
                priority: priority,
            });
            const updatedTask = await fetchTaskByUid(uid!);
            tasksStore.updateTaskInStore(updatedTask);
            setTimelineRefreshKey((prev) => prev + 1);
            showSuccessToast(
                t('task.priorityUpdated', 'Priority updated successfully')
            );
        } catch (error) {
            console.error('Error updating priority:', error);
            showErrorToast(
                t('task.priorityUpdateError', 'Failed to update priority')
            );
            throw error;
        }
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
                <TaskDetailsHeader
                    task={task}
                    onToggleCompletion={handleToggleCompletion}
                    onTitleUpdate={handleTitleUpdate}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                />

                {/* Summary and Overdue Alerts */}
                <TaskSummaryAlerts
                    task={task}
                    summaryMessage={getTaskPlainSummary()}
                    isSummaryDismissed={isSummaryAlertDismissed}
                    isOverdueDismissed={isOverdueAlertDismissed}
                    onDismissSummary={() => setIsSummaryAlertDismissed(true)}
                    onDismissOverdue={() => setIsOverdueAlertDismissed(true)}
                />

                {/* Content - Full width layout */}
                <div className="mb-8 mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        {/* Left Column - Main Content */}
                        <div className="lg:col-span-3 space-y-8">
                            {/* Notes Section - Always Visible */}
                            <TaskContentSection
                                content={task.note || ''}
                                onUpdate={handleContentUpdate}
                            />

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
                                                    {t(
                                                        'common.cancel',
                                                        'Cancel'
                                                    )}
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
                                                        status={subtask.status}
                                                        onToggleCompletion={async () => {
                                                            console.log(
                                                                'Toggling subtask:',
                                                                subtask.id
                                                            );
                                                            if (subtask.id) {
                                                                try {
                                                                    // Pass the current subtask to avoid fetching it
                                                                    await toggleTaskCompletion(
                                                                        subtask.id,
                                                                        subtask
                                                                    );
                                                                    // Refresh task data which includes updated subtasks
                                                                    if (uid) {
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
                                                            subtask.status === 3
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
                                        !task.recurring_parent_id &&
                                        !isEditingRecurrence
                                            ? handleRecurrenceCardClick
                                            : undefined
                                    }
                                    role={
                                        !task.recurring_parent_id &&
                                        !isEditingRecurrence
                                            ? 'button'
                                            : undefined
                                    }
                                    tabIndex={
                                        !task.recurring_parent_id &&
                                        !isEditingRecurrence
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
                                    <TaskRecurringInstanceInfo
                                        task={task}
                                        parentTask={parentTask}
                                        loadingParent={loadingParent}
                                    />

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
                                                    onClick={
                                                        handleSaveRecurrence
                                                    }
                                                    className="px-4 py-2 text-sm bg-green-600 dark:bg-green-500 text-white rounded hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                                                >
                                                    {t('common.save', 'Save')}
                                                </button>
                                                <button
                                                    onClick={
                                                        handleCancelRecurrenceEdit
                                                    }
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
                                                <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
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
                                                                    (iter) =>
                                                                        formatDateWithDayName(
                                                                            iter.date
                                                                        )
                                                                            .isToday
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
                            <TaskProjectSection
                                task={task}
                                projects={projectsStore.projects}
                                onProjectSelect={handleProjectSelection}
                                onProjectClear={handleClearProject}
                                onProjectCreate={
                                    handleProjectCreateInlineWrapper
                                }
                                getProjectLink={getProjectLink}
                            />

                            {/* Tags Section */}
                            <TaskTagsSection
                                task={task}
                                availableTags={tagsStore.tags}
                                hasLoadedTags={tagsStore.hasLoaded}
                                isLoadingTags={tagsStore.isLoading}
                                onUpdate={handleTagsUpdate}
                                onLoadTags={() => tagsStore.loadTags()}
                            />

                            {/* Priority Section */}
                            <TaskPrioritySection
                                task={task}
                                onUpdate={handlePriorityUpdate}
                            />

                            {/* Due Date Section */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                    {t('task.dueDate', 'Due Date')}
                                </h4>
                                <div
                                    className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 p-4 transition-colors ${
                                        task.due_date &&
                                        (() => {
                                            const dueDate = new Date(
                                                task.due_date
                                            );
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            dueDate.setHours(0, 0, 0, 0);
                                            const isCompleted =
                                                task.status === 'done' ||
                                                task.status === 2 ||
                                                task.status === 'archived' ||
                                                task.status === 3 ||
                                                task.completed_at;
                                            return (
                                                dueDate < today && !isCompleted
                                            );
                                        })()
                                            ? 'border-red-500 dark:border-red-400'
                                            : ''
                                    }`}
                                >
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
                                                    {t(
                                                        'common.cancel',
                                                        'Cancel'
                                                    )}
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
                                                    const dueDate = new Date(
                                                        task.due_date
                                                    );
                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    dueDate.setHours(
                                                        0,
                                                        0,
                                                        0,
                                                        0
                                                    );
                                                    const isCompleted =
                                                        task.status ===
                                                            'done' ||
                                                        task.status === 2 ||
                                                        task.status ===
                                                            'archived' ||
                                                        task.status === 3 ||
                                                        task.completed_at;
                                                    const overdue =
                                                        dueDate < today &&
                                                        !isCompleted;

                                                    return (
                                                        <div
                                                            className={`flex items-center justify-between w-full ${
                                                                overdue
                                                                    ? 'text-red-600 dark:text-red-400'
                                                                    : 'text-gray-900 dark:text-gray-100'
                                                            }`}
                                                        >
                                                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                                                                <CalendarIcon
                                                                    className={`h-4 w-4 flex-shrink-0 ${
                                                                        overdue
                                                                            ? 'text-red-600 dark:text-red-400'
                                                                            : 'text-gray-500 dark:text-gray-400'
                                                                    }`}
                                                                />
                                                                <span className="text-sm font-medium">
                                                                    {
                                                                        display.formattedDate
                                                                    }
                                                                </span>
                                                                <span
                                                                    className={`text-sm italic ${
                                                                        overdue
                                                                            ? 'text-red-500 dark:text-red-400 font-medium'
                                                                            : 'text-gray-500 dark:text-gray-400'
                                                                    }`}
                                                                >
                                                                    (
                                                                    {
                                                                        display.relativeText
                                                                    }
                                                                    )
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
                                    {t(
                                        'task.recentActivity',
                                        'Recent Activity'
                                    )}
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
