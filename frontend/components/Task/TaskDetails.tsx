import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    PencilSquareIcon,
    TrashIcon,
    TagIcon,
    FolderIcon,
    CalendarIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    ListBulletIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import ConfirmDialog from '../Shared/ConfirmDialog';
import TaskModal from './TaskModal';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import {
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    fetchTaskByNanoid,
} from '../../utils/tasksService';
import { createProject } from '../../utils/projectsService';
import { useStore } from '../../store/useStore';
import { useToast } from '../Shared/ToastContext';
import TaskPriorityIcon from './TaskPriorityIcon';
import LoadingScreen from '../Shared/LoadingScreen';
import MarkdownRenderer from '../Shared/MarkdownRenderer';
import TaskTimeline from './TaskTimeline';
import { isTaskOverdue } from '../../utils/dateUtils';

const TaskDetails: React.FC = () => {
    const { nanoid } = useParams<{ nanoid: string }>();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast } = useToast();

    const projects = useStore((state: any) => state.projectsStore.projects);
    const tagsStore = useStore((state: any) => state.tagsStore);
    const tasksStore = useStore((state: any) => state.tasksStore);
    const task = useStore((state: any) =>
        state.tasksStore.tasks.find((t: Task) => t.nanoid === nanoid)
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
                const isCorrectTask = pendingState.taskId === nanoid;

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
                const isCorrectTask = pendingEditState.taskId === nanoid;

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
    }, [nanoid, tagsStore]);

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

        return new Date(dueDate).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
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

    useEffect(() => {
        const fetchTaskData = async () => {
            if (!nanoid) {
                setError('No task nanoid provided');
                setLoading(false);
                return;
            }

            // If task is not in store, load it
            if (!task) {
                try {
                    setLoading(true);
                    const fetchedTask = await fetchTaskByNanoid(nanoid);
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
    }, [nanoid, task, tasksStore]);

    const handleEdit = (e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
        }

        // Store modal state in sessionStorage to persist across re-mounts
        const modalState = {
            isOpen: true,
            taskId: nanoid,
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
            if (nanoid) {
                const updatedTask = await fetchTaskByNanoid(nanoid);
                const existingIndex = tasksStore.tasks.findIndex(
                    (t: Task) => t.nanoid === nanoid
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
                if (nanoid) {
                    const updatedTask = await fetchTaskByNanoid(nanoid);
                    const existingIndex = tasksStore.tasks.findIndex(
                        (t: Task) => t.nanoid === nanoid
                    );
                    if (existingIndex >= 0) {
                        const updatedTasks = [...tasksStore.tasks];
                        updatedTasks[existingIndex] = updatedTask;
                        tasksStore.setTasks(updatedTasks);
                    }
                }
                showSuccessToast(
                    t('task.updateSuccess', 'Task updated successfully')
                );

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

    const handleSubtaskClick = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();

            // Store the intent to open modal in sessionStorage (survives re-mounts)
            const modalState = {
                isOpen: true,
                focusSubtasks: true,
                taskId: nanoid,
                timestamp: Date.now(),
            };
            sessionStorage.setItem(
                'pendingModalState',
                JSON.stringify(modalState)
            );

            // Set state immediately
            setFocusSubtasks(true);
            setIsTaskModalOpen(true);
        },
        [nanoid]
    );

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
        <div className="flex justify-center px-4 lg:px-2">
            <div className="w-full max-w-5xl">
                {/* Header Section with Title and Action Buttons */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <TaskPriorityIcon
                            priority={task.priority}
                            status={task.status}
                            onToggleCompletion={handleToggleCompletion}
                        />
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-normal text-gray-900 dark:text-gray-100">
                                {task.name}
                            </h2>
                            {/* Project, tags, due date, and recurrence under title */}
                            {(task.Project ||
                                (task.tags && task.tags.length > 0) ||
                                task.due_date ||
                                (task.recurrence_type &&
                                    task.recurrence_type !== 'none')) && (
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {task.Project && (
                                        <div className="flex items-center">
                                            <FolderIcon className="h-3 w-3 mr-1" />
                                            <Link
                                                to={
                                                    task.Project.nanoid
                                                        ? `/project/${task.Project.nanoid}-${task.Project.name
                                                              .toLowerCase()
                                                              .replace(
                                                                  /[^a-z0-9]+/g,
                                                                  '-'
                                                              )
                                                              .replace(
                                                                  /^-|-$/g,
                                                                  ''
                                                              )}`
                                                        : `/project/${task.Project.id}`
                                                }
                                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
                                            >
                                                {task.Project.name}
                                            </Link>
                                        </div>
                                    )}
                                    {task.Project &&
                                        task.tags &&
                                        task.tags.length > 0 && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {task.tags && task.tags.length > 0 && (
                                        <div className="flex items-center">
                                            <TagIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {task.tags.map(
                                                    (
                                                        tag: any,
                                                        index: number
                                                    ) => (
                                                        <React.Fragment
                                                            key={
                                                                tag.id ||
                                                                tag.name
                                                            }
                                                        >
                                                            <Link
                                                                to={
                                                                    tag.nanoid
                                                                        ? `/tag/${tag.nanoid}-${tag.name
                                                                              .toLowerCase()
                                                                              .replace(
                                                                                  /[^a-z0-9]+/g,
                                                                                  '-'
                                                                              )
                                                                              .replace(
                                                                                  /^-|-$/g,
                                                                                  ''
                                                                              )}`
                                                                        : `/tag/${encodeURIComponent(tag.name)}`
                                                                }
                                                                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:underline"
                                                            >
                                                                {tag.name}
                                                            </Link>
                                                            {index <
                                                                task.tags!
                                                                    .length -
                                                                    1 && ', '}
                                                        </React.Fragment>
                                                    )
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    {(task.Project ||
                                        (task.tags && task.tags.length > 0)) &&
                                        task.due_date && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {task.due_date && (
                                        <div className="flex items-center">
                                            <CalendarIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {formatDueDate(task.due_date)}
                                            </span>
                                        </div>
                                    )}
                                    {(task.Project ||
                                        (task.tags && task.tags.length > 0) ||
                                        task.due_date) &&
                                        task.recurrence_type &&
                                        task.recurrence_type !== 'none' && (
                                            <span className="mx-2">•</span>
                                        )}
                                    {task.recurrence_type &&
                                        task.recurrence_type !== 'none' && (
                                            <div className="flex items-center">
                                                <ArrowPathIcon className="h-3 w-3 mr-1" />
                                                <span>
                                                    {formatRecurrence(
                                                        task.recurrence_type
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex space-x-1">
                        <button
                            onClick={handleEdit}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-full transition-colors duration-200"
                        >
                            <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteClick();
                            }}
                            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded-full transition-colors duration-200"
                        >
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Overdue Alert */}
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
                                              `This task has been postponed ${task.today_move_count} times.`
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

                {/* Content - Two column layout */}
                <div className="mb-8 mt-8">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Notes and Subtasks */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Notes Section - Always Visible */}
                            <div>
                                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                    {t('task.content', 'Content')}
                                </h4>
                                {task.note ? (
                                    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                                        <MarkdownRenderer
                                            content={task.note}
                                            className="prose dark:prose-invert max-w-none"
                                        />
                                    </div>
                                ) : (
                                    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
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
                                <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                    {t('task.subtasks', 'Subtasks')}
                                </h4>
                                {subtasks.length > 0 ? (
                                    <div className="space-y-1">
                                        {subtasks.map((subtask: Task) => (
                                            <div
                                                key={subtask.id}
                                                className="group"
                                            >
                                                <div
                                                    onClick={handleSubtaskClick}
                                                    className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 cursor-pointer transition-all duration-200 ${
                                                        subtask.status ===
                                                            'in_progress' ||
                                                        subtask.status === 1
                                                            ? 'border-green-400/60 dark:border-green-500/60'
                                                            : 'border-gray-50 dark:border-gray-800'
                                                    }`}
                                                >
                                                    <div className="px-4 py-2.5 flex items-center space-x-3">
                                                        <div
                                                            className="flex-shrink-0"
                                                            onClick={(e) =>
                                                                e.stopPropagation()
                                                            }
                                                        >
                                                            <TaskPriorityIcon
                                                                priority={
                                                                    subtask.priority
                                                                }
                                                                status={
                                                                    subtask.status
                                                                }
                                                                onToggleCompletion={async (
                                                                    e?: React.MouseEvent
                                                                ) => {
                                                                    e?.stopPropagation();
                                                                    if (
                                                                        subtask.id
                                                                    ) {
                                                                        try {
                                                                            await toggleTaskCompletion(
                                                                                subtask.id
                                                                            );
                                                                            // Reload subtasks after toggling completion
                                                                            if (
                                                                                task?.id
                                                                            ) {
                                                                                // Refresh task data which includes updated subtasks
                                                                                if (
                                                                                    nanoid
                                                                                ) {
                                                                                    const updatedTask =
                                                                                        await fetchTaskByNanoid(
                                                                                            nanoid
                                                                                        );
                                                                                    const existingIndex =
                                                                                        tasksStore.tasks.findIndex(
                                                                                            (
                                                                                                t: Task
                                                                                            ) =>
                                                                                                t.nanoid ===
                                                                                                nanoid
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
                                                                            }
                                                                        } catch (error) {
                                                                            console.error(
                                                                                'Error toggling subtask completion:',
                                                                                error
                                                                            );
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                        <span
                                                            className={`text-base flex-1 truncate ${
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
                                                        >
                                                            {subtask.name}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                                        <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                                            <ListBulletIcon className="h-12 w-12 mb-3 opacity-50" />
                                            <span className="text-sm text-center">
                                                {t(
                                                    'task.noSubtasks',
                                                    'No subtasks yet'
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Column - Recent Activity */}
                        <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4">
                                {t('task.recentActivity', 'Recent Activity')}
                            </h4>
                            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 p-6">
                                <TaskTimeline
                                    taskId={task.id}
                                    refreshKey={timelineRefreshKey}
                                />
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
                        initialSubtasks={subtasks}
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
