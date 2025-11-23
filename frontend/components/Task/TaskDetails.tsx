import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskModal from './TaskModal';
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
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    TaskSummaryAlerts,
    TaskContentCard,
    TaskProjectCard,
    TaskTagsCard,
    TaskPriorityCard,
    TaskSubtasksCard,
    TaskRecurrenceCard,
    TaskDueDateCard,
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

        if (diffDays === 0) {
            return {
                formattedDate,
                relativeText: t('dateIndicators.today', 'today'),
            };
        }
        if (diffDays === 1) {
            return {
                formattedDate,
                relativeText: t('dateIndicators.tomorrow', 'tomorrow'),
            };
        }
        if (diffDays === -1) {
            return {
                formattedDate,
                relativeText: t('dateIndicators.yesterday', 'yesterday'),
            };
        }

        const relativeText =
            diffDays > 0
                ? t('task.inDays', 'in {{count}} days', { count: diffDays })
                : t('task.daysAgo', '{{count}} days ago', {
                      count: Math.abs(diffDays),
                  });

        return { formattedDate, relativeText };
    };

    const getTaskPlainSummary = () => {
        const statusText = getStatusLabel();
        const priorityText = getPriorityLabel();
        const dueInfo = task.due_date ? getDueDateDisplay(task.due_date) : null;

        return (
            <span>
                {t('task.thisTask', 'This task')} {t('task.is', 'is')}{' '}
                <strong>{statusText}</strong>
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

    const handleToggleSubtaskCompletion = async (subtask: Task) => {
        if (!subtask.id) return;
        try {
            await toggleTaskCompletion(subtask.id, subtask);
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
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error toggling subtask completion:', error);
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
                            <TaskContentCard
                                content={task.note || ''}
                                onUpdate={handleContentUpdate}
                            />

                            <TaskSubtasksCard
                                task={task}
                                subtasks={subtasks}
                                isEditing={isEditingSubtasks}
                                editedSubtasks={editedSubtasks}
                                onSubtasksChange={setEditedSubtasks}
                                onStartEdit={handleStartSubtasksEdit}
                                onSave={handleSaveSubtasks}
                                onCancel={handleCancelSubtasksEdit}
                                onToggleSubtaskCompletion={
                                    handleToggleSubtaskCompletion
                                }
                            />

                            <TaskRecurrenceCard
                                task={task}
                                parentTask={parentTask}
                                loadingParent={loadingParent}
                                isEditing={isEditingRecurrence}
                                recurrenceForm={recurrenceForm}
                                onStartEdit={handleStartRecurrenceEdit}
                                onChange={handleRecurrenceChange}
                                onSave={handleSaveRecurrence}
                                onCancel={handleCancelRecurrenceEdit}
                                loadingIterations={loadingIterations}
                                nextIterations={nextIterations}
                                canEdit={!task.recurring_parent_id}
                            />
                        </div>

                        {/* Right Column - Metadata and Recent Activity */}
                        <div className="space-y-6">
                            {/* Project Section */}
                            <TaskProjectCard
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
                            <TaskTagsCard
                                task={task}
                                availableTags={tagsStore.tags}
                                hasLoadedTags={tagsStore.hasLoaded}
                                isLoadingTags={tagsStore.isLoading}
                                onUpdate={handleTagsUpdate}
                                onLoadTags={() => tagsStore.loadTags()}
                            />

                            {/* Priority Section */}
                            <TaskPriorityCard
                                task={task}
                                onUpdate={handlePriorityUpdate}
                            />

                            <TaskDueDateCard
                                task={task}
                                isEditing={isEditingDueDate}
                                editedDueDate={editedDueDate}
                                onChangeDate={setEditedDueDate}
                                onStartEdit={handleStartDueDateEdit}
                                onSave={handleSaveDueDate}
                                onCancel={handleCancelDueDateEdit}
                            />

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
