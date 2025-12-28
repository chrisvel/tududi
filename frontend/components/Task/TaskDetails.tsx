import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    updateTask,
    deleteTask,
    fetchTaskByUid,
    fetchTaskNextIterations,
    TaskIteration,
    toggleTaskCompletion,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { fetchAttachments } from '../../utils/attachmentsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import LoadingScreen from '../Shared/LoadingScreen';
import TaskTimeline from './TaskTimeline';
import {
    TaskDetailsHeader,
    TaskContentCard,
    TaskProjectCard,
    TaskTagsCard,
    TaskSubtasksCard,
    TaskRecurrenceCard,
    TaskDueDateCard,
    TaskDeferUntilCard,
    TaskAttachmentsCard,
} from './TaskDetails/';
import { isTaskOverdueInTodayPlan, isTaskPastDue } from '../../utils/dateUtils';

const TaskDetails: React.FC = () => {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const projectsStore = useStore((state: any) => state.projectsStore);
    const tagsStore = useStore((state: any) => state.tagsStore);
    const tasksStore = useStore((state: any) => state.tasksStore);
    const task = useStore((state: any) =>
        state.tasksStore.tasks.find((t: Task) => t.uid === uid)
    );

    const subtasks = task?.subtasks || [];

    const [loading, setLoading] = useState(!task);
    const [error, setError] = useState<string | null>(null);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [timelineRefreshKey, setTimelineRefreshKey] = useState(0);
    const [isOverdueBubbleVisible, setIsOverdueBubbleVisible] = useState(false);
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
            const target = e.target as Node;
            if (
                actionsMenuOpen &&
                actionsMenuRef.current &&
                !actionsMenuRef.current.contains(target)
            ) {
                setActionsMenuOpen(false);
            }

            if (isOverdueBubbleVisible) {
                const clickedOverdueToggle =
                    typeof e.composedPath === 'function'
                        ? e
                              .composedPath()
                              .some(
                                  (node) =>
                                      node instanceof HTMLElement &&
                                      node.hasAttribute('data-overdue-toggle')
                              )
                        : target instanceof HTMLElement &&
                          !!target.closest('[data-overdue-toggle]');

                if (!clickedOverdueToggle) {
                    setIsOverdueBubbleVisible(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [actionsMenuOpen, isOverdueBubbleVisible]);
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);
    const [editedDueDate, setEditedDueDate] = useState<string>(
        task?.due_date || ''
    );
    const [isEditingDeferUntil, setIsEditingDeferUntil] = useState(false);
    const [editedDeferUntil, setEditedDeferUntil] = useState<string>(
        task?.defer_until || ''
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
    const [activePill, setActivePill] = useState('overview');
    const [attachmentCount, setAttachmentCount] = useState(0);

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

    useEffect(() => {
        if (!tagsStore.hasLoaded && !tagsStore.isLoading) {
            tagsStore.loadTags();
        }
    }, [tagsStore]);

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

    const isOverdue = task ? isTaskOverdueInTodayPlan(task) : false;
    const isPastDue = task ? isTaskPastDue(task) : false;

    useEffect(() => {
        if (!isOverdue) {
            setIsOverdueBubbleVisible(false);
        }
    }, [isOverdue]);

    const handleOverdueIconClick = () => {
        if (!isOverdue) {
            return;
        }
        setIsOverdueBubbleVisible((prev) => !prev);
    };

    const handleDismissOverdueAlert = () => {
        setIsOverdueBubbleVisible(false);
    };

    const handleRecurrenceChange = (field: string, value: any) => {
        setRecurrenceForm((prev) => {
            const updated = { ...prev, [field]: value };

            // Set default values when switching to monthly recurrence
            if (
                field === 'recurrence_type' &&
                value === 'monthly' &&
                !prev.recurrence_month_day
            ) {
                updated.recurrence_month_day = new Date().getDate();
            }

            return updated;
        });
    };

    const handleSaveRecurrence = async () => {
        if (!task?.uid) {
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

            await updateTask(task.uid, { ...task, ...recurrencePayload });

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
        if (!task?.uid) {
            setIsEditingDueDate(false);
            setEditedDueDate(task?.due_date || '');
            return;
        }

        if ((editedDueDate || '') === (task.due_date || '')) {
            setIsEditingDueDate(false);
            return;
        }

        if (task.defer_until && editedDueDate) {
            const deferDate = new Date(task.defer_until);
            const dueDate = new Date(editedDueDate);

            if (!isNaN(deferDate.getTime()) && !isNaN(dueDate.getTime())) {
                if (deferDate > dueDate) {
                    showErrorToast(
                        t(
                            'task.dueDateBeforeDeferError',
                            'Due date cannot be before the defer until date'
                        )
                    );
                    return;
                }
            }
        }

        // Check if due date is in the past
        if (editedDueDate) {
            const dueDate = new Date(editedDueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);

            if (!isNaN(dueDate.getTime()) && dueDate < today) {
                showErrorToast(
                    t(
                        'task.dueDateInPastWarning',
                        'Warning: You are setting a due date in the past'
                    )
                );
            }
        }

        try {
            await updateTask(task.uid, {
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

    const handleStartDeferUntilEdit = () => {
        setEditedDeferUntil(task?.defer_until || '');
        setIsEditingDeferUntil(true);
    };

    const handleSaveDeferUntil = async () => {
        if (!task?.uid) {
            setIsEditingDeferUntil(false);
            setEditedDeferUntil(task?.defer_until || '');
            return;
        }

        if ((editedDeferUntil || '') === (task.defer_until || '')) {
            setIsEditingDeferUntil(false);
            return;
        }

        if (editedDeferUntil && task.due_date) {
            const deferDate = new Date(editedDeferUntil);
            const dueDate = new Date(task.due_date);

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

        try {
            await updateTask(task.uid, {
                defer_until: editedDeferUntil || null,
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
                t('task.deferUntilUpdated', 'Defer until successfully updated')
            );
            setIsEditingDeferUntil(false);
            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error: any) {
            console.error('Error updating defer until:', error);
            showErrorToast(
                error?.message ||
                    t(
                        'task.deferUntilUpdateError',
                        'Failed to update defer until'
                    )
            );
            setEditedDeferUntil(task?.defer_until || '');
            setIsEditingDeferUntil(false);
        }
    };

    const handleCancelDeferUntilEdit = () => {
        setIsEditingDeferUntil(false);
        setEditedDeferUntil(task?.defer_until || '');
    };

    useEffect(() => {
        const fetchTaskData = async () => {
            if (!uid) {
                setError('No task uid provided');
                setLoading(false);
                return;
            }

            if (!task) {
                try {
                    setLoading(true);
                    const fetchedTask = await fetchTaskByUid(uid);
                    tasksStore.setTasks([...tasksStore.tasks, fetchedTask]);
                } catch (fetchError) {
                    setError('Task not found');
                    console.error('Error fetching task:', fetchError);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchTaskData();
    }, [uid, task, tasksStore]);

    // Load attachment count when task is loaded
    useEffect(() => {
        const loadAttachmentCount = async () => {
            if (task?.uid) {
                try {
                    const attachments = await fetchAttachments(task.uid);
                    setAttachmentCount(attachments.length);
                } catch (error) {
                    console.error('Error loading attachment count:', error);
                }
            }
        };

        loadAttachmentCount();
    }, [task?.uid]);

    useEffect(() => {
        const loadNextIterations = async () => {
            if (
                task?.id &&
                task.recurrence_type &&
                task.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);
                    // Don't pass startFromDate - let backend default to today
                    const iterations = await fetchTaskNextIterations(
                        task.uid!
                    );
                    setNextIterations(iterations);
                } catch (error) {
                    console.error('Error loading next iterations:', error);
                    setNextIterations([]);
                } finally {
                    setLoadingIterations(false);
                }
            } else if (
                task?.recurring_parent_id &&
                parentTask?.uid &&
                parentTask.recurrence_type &&
                parentTask.recurrence_type !== 'none'
            ) {
                try {
                    setLoadingIterations(true);

                    // Don't pass startFromDate - let backend default to today
                    const iterations = await fetchTaskNextIterations(
                        parentTask.uid
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
        task?.due_date,
        task?.recurring_parent_id,
        parentTask?.id,
        parentTask?.recurrence_type,
    ]);

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
        if (!task?.uid) {
            setIsEditingSubtasks(false);
            setEditedSubtasks([]);
            return;
        }

        try {
            await updateTask(task.uid, { ...task, subtasks: editedSubtasks });

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
        if (!subtask.uid) return;
        try {
            await toggleTaskCompletion(subtask.uid, subtask);
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
        if (!task?.uid) return;

        try {
            await updateTask(task.uid, { ...task, project_id: project.id });

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

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating project:', error);
            showErrorToast(
                t('task.projectUpdateError', 'Failed to update project')
            );
        }
    };

    const handleClearProject = async () => {
        if (!task?.uid) return;

        try {
            await updateTask(task.uid, { ...task, project_id: null });

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

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error clearing project:', error);
            showErrorToast(
                t('task.projectClearError', 'Failed to clear project')
            );
        }
    };

    const refreshRecurringSetup = useCallback(
        async (latestTask?: Task | null) => {
            if (!latestTask) {
                setNextIterations([]);
                return;
            }

            const isTemplateTask =
                latestTask.recurrence_type &&
                latestTask.recurrence_type !== 'none' &&
                !latestTask.recurring_parent_id;
            const canUseParentIterations =
                !!latestTask.recurring_parent_id &&
                !!parentTask?.id &&
                parentTask?.recurrence_type &&
                parentTask.recurrence_type !== 'none';

            if (!isTemplateTask && !canUseParentIterations) {
                setNextIterations([]);
                return;
            }

            try {
                setLoadingIterations(true);
                if (isTemplateTask) {
                    // Don't pass startFromDate - let backend default to today
                    const iterations = await fetchTaskNextIterations(
                        latestTask.uid!
                    );
                    setNextIterations(iterations);
                } else if (canUseParentIterations && parentTask?.uid) {
                    // Don't pass startFromDate - let backend default to today
                    const iterations = await fetchTaskNextIterations(
                        parentTask.uid
                    );
                    setNextIterations(iterations);
                }
            } catch (error) {
                console.error('Error refreshing recurring setup:', error);
                setNextIterations([]);
            } finally {
                setLoadingIterations(false);
            }
        },
        [parentTask?.id, parentTask?.recurrence_type]
    );

    const handleQuickStatusToggle = async () => {
        if (!task?.uid) {
            return;
        }

        const isCurrentlyInProgress =
            task.status === 'in_progress' || task.status === 1;
        const isToggleable =
            task.status === 'not_started' ||
            task.status === 0 ||
            isCurrentlyInProgress;

        if (!isToggleable) {
            return;
        }

        try {
            const nextStatusPayload: Task = {
                ...task,
                status: isCurrentlyInProgress ? 0 : 1, // 0=not_started, 1=in_progress
            };

            await updateTask(task.uid, nextStatusPayload);

            let latestTaskData: Task | null = null;

            if (uid) {
                const updatedTaskFromServer = await fetchTaskByUid(uid);
                latestTaskData = updatedTaskFromServer;
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.uid === uid
                );
                if (existingIndex >= 0) {
                    const updatedTasks = [...tasksStore.tasks];
                    updatedTasks[existingIndex] = updatedTaskFromServer;
                    tasksStore.setTasks(updatedTasks);
                }
            }

            if (!latestTaskData) {
                latestTaskData = nextStatusPayload;
            }

            await refreshRecurringSetup(latestTaskData);
            setTimelineRefreshKey((prev) => prev + 1);
            showSuccessToast(
                isCurrentlyInProgress
                    ? t('tasks.setNotStarted', 'Set to not started')
                    : t('tasks.setInProgress', 'Set in progress')
            );
        } catch (error) {
            console.error('Error toggling in-progress status:', error);
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    const handleStatusUpdate = async (newStatus: number) => {
        if (!task?.uid) return;

        try {
            await updateTask(task.uid, {
                ...task,
                status: newStatus,
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
                t('task.statusUpdated', 'Status updated successfully')
            );

            setTimelineRefreshKey((prev) => prev + 1);
        } catch (error) {
            console.error('Error updating status:', error);
            showErrorToast(
                t('task.statusUpdateError', 'Failed to update status')
            );
        }
    };

    const handleDeleteClick = () => {
        if (task) {
            setTaskToDelete(task);
            setIsConfirmDialogOpen(true);
        }
    };

    const handleDeleteConfirm = async () => {
        if (taskToDelete?.uid) {
            try {
                await deleteTask(taskToDelete.uid);
                showSuccessToast(
                    t('task.deleteSuccess', 'Task deleted successfully')
                );
                navigate('/today');
            } catch (error) {
                console.error('Error deleting task:', error);
                showErrorToast(t('task.deleteError', 'Failed to delete task'));
            }
        }
        setIsConfirmDialogOpen(false);
        setTaskToDelete(null);
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

    const getTagLink = (tag: any) => {
        if (tag.uid) {
            const slug = tag.name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
            return `/tag/${tag.uid}-${slug}`;
        }
        return `/tag/${encodeURIComponent(tag.name)}`;
    };

    const handleTitleUpdate = async (newTitle: string) => {
        if (!task?.uid || !newTitle.trim()) {
            return;
        }

        if (newTitle.trim() === task.name) {
            return;
        }

        try {
            await updateTask(task.uid, { ...task, name: newTitle.trim() });

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
        if (!task?.uid) {
            return;
        }

        const trimmedContent = newContent.trim();

        if (trimmedContent === (task.note || '').trim()) {
            return;
        }

        try {
            await updateTask(task.uid, { ...task, note: trimmedContent });

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
        if (!task?.uid || !name.trim()) return;

        try {
            const newProject = await createProject({ name });

            projectsStore.setProjects([...projectsStore.projects, newProject]);

            await updateTask(task.uid, { ...task, project_id: newProject.id });

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
        if (!task?.uid) {
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
            await updateTask(task.uid, {
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
        if (!task?.uid) return;

        try {
            await updateTask(task.uid, {
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
        <div className="px-4 lg:px-6 pt-4">
            <div className="w-full">
                {/* Header Section with Title and Action Buttons */}
                <TaskDetailsHeader
                    task={task}
                    onTitleUpdate={handleTitleUpdate}
                    onStatusUpdate={handleStatusUpdate}
                    onPriorityUpdate={handlePriorityUpdate}
                    onDelete={handleDeleteClick}
                    getProjectLink={getProjectLink}
                    getTagLink={getTagLink}
                    activePill={activePill}
                    onPillChange={setActivePill}
                    showOverdueIcon={isOverdue}
                    showPastDueBadge={isPastDue}
                    onOverdueIconClick={handleOverdueIconClick}
                    isOverdueAlertVisible={isOverdue && isOverdueBubbleVisible}
                    onDismissOverdueAlert={handleDismissOverdueAlert}
                    onQuickStatusToggle={handleQuickStatusToggle}
                    attachmentCount={attachmentCount}
                    subtasksCount={subtasks.length}
                />

                {/* Content - Full width layout */}
                <div className="mb-6 mt-6">
                    {/* Overview Pill */}
                    {activePill === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* Left Column - Main Content */}
                            <div className="lg:col-span-3 space-y-8">
                                <TaskContentCard
                                    content={task.note || ''}
                                    onUpdate={handleContentUpdate}
                                />
                            </div>

                            {/* Right Column - Project and Tags */}
                            <div className="space-y-6">
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

                                <TaskTagsCard
                                    task={task}
                                    availableTags={tagsStore.tags}
                                    hasLoadedTags={tagsStore.hasLoaded}
                                    isLoadingTags={tagsStore.isLoading}
                                    onUpdate={handleTagsUpdate}
                                    onLoadTags={() => tagsStore.loadTags()}
                                    getTagLink={getTagLink}
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

                                <TaskDeferUntilCard
                                    task={task}
                                    isEditing={isEditingDeferUntil}
                                    editedDeferUntil={editedDeferUntil}
                                    onChangeDateTime={setEditedDeferUntil}
                                    onStartEdit={handleStartDeferUntilEdit}
                                    onSave={handleSaveDeferUntil}
                                    onCancel={handleCancelDeferUntilEdit}
                                />
                            </div>
                        </div>
                    )}

                    {/* Recurrence Pill */}
                    {activePill === 'recurrence' && (
                        <div className="grid grid-cols-1">
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
                    )}

                    {/* Subtasks Pill */}
                    {activePill === 'subtasks' && (
                        <div className="grid grid-cols-1">
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
                        </div>
                    )}

                    {/* Attachments Pill */}
                    {activePill === 'attachments' && (
                        <div className="grid grid-cols-1">
                            <TaskAttachmentsCard
                                taskUid={task.uid}
                                onAttachmentsCountChange={setAttachmentCount}
                            />
                        </div>
                    )}

                    {/* Activity Pill */}
                    {activePill === 'activity' && (
                        <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                            <TaskTimeline
                                taskUid={task.uid}
                                refreshKey={timelineRefreshKey}
                            />
                        </div>
                    )}
                </div>
                {/* End of main content sections */}

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
