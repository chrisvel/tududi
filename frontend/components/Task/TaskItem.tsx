import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';
import { useToast } from '../Shared/ToastContext';
import TaskPriorityIcon from '../Shared/Icons/TaskPriorityIcon';
import { isTaskCompleted } from '../../constants/taskStatus';

// Import SubtasksDisplay component from TaskHeader
interface SubtasksDisplayProps {
    loadingSubtasks: boolean;
    subtasks: Task[];
    onTaskClick: (e: React.MouseEvent, task: Task) => void;
    loadSubtasks: () => Promise<void>;
    onSubtaskUpdate: (updatedSubtask: Task) => void;
}

const getPriorityBorderClassName = (
    priority?: Task['priority'] | number
): string => {
    let normalizedPriority = priority;
    if (typeof normalizedPriority === 'number') {
        const priorityNames: Array<'low' | 'medium' | 'high'> = [
            'low',
            'medium',
            'high',
        ];
        normalizedPriority = priorityNames[normalizedPriority] || undefined;
    }

    switch (normalizedPriority) {
        case 'high':
            return 'border-l-4 border-l-red-500';
        case 'medium':
            return 'border-l-4 border-l-yellow-400';
        case 'low':
            return 'border-l-4 border-l-blue-400';
        default:
            return 'border-l-4 border-l-transparent';
    }
};

const SubtasksDisplay: React.FC<SubtasksDisplayProps> = ({
    loadingSubtasks,
    subtasks,
    onTaskClick,
    loadSubtasks,
    onSubtaskUpdate,
}) => {
    const { t } = useTranslation();

    if (loadingSubtasks) {
        return (
            <div className="ml-[10%] text-sm text-gray-500 dark:text-gray-400">
                {t('loading.subtasks', 'Loading subtasks...')}
            </div>
        );
    }

    if (subtasks.length === 0) {
        return (
            <div className="ml-[10%] text-sm text-gray-500 dark:text-gray-400">
                {t('subtasks.noSubtasks', 'No subtasks found')}
            </div>
        );
    }

    return (
        <div className="mt-1 space-y-1">
            {subtasks.map((subtask) => {
                const borderClass = isTaskCompleted(subtask.status)
                    ? 'border-l-4 border-l-green-500'
                    : getPriorityBorderClassName(subtask.priority);
                return (
                    <div key={subtask.id} className="ml-[10%]">
                        <div
                            className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 relative overflow-visible transition-colors duration-200 ease-in-out hover:ring-1 hover:ring-gray-200 dark:hover:ring-gray-700 cursor-pointer ${borderClass}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(e, subtask);
                            }}
                        >
                            <div className="px-3 py-2.5 flex items-center justify-between">
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <TaskPriorityIcon
                                        priority={subtask.priority || 'low'}
                                        status={subtask.status || 'not_started'}
                                        onToggleCompletion={async () => {
                                            if (subtask.uid) {
                                                try {
                                                    const updatedSubtask =
                                                        await toggleTaskCompletion(
                                                            subtask.uid,
                                                            subtask
                                                        );

                                                    if (
                                                        updatedSubtask.parent_child_logic_executed
                                                    ) {
                                                        setTimeout(() => {
                                                            window.location.reload();
                                                        }, 200);
                                                        return;
                                                    }

                                                    onSubtaskUpdate(
                                                        updatedSubtask
                                                    );
                                                } catch (error) {
                                                    console.error(
                                                        'Error toggling subtask completion:',
                                                        error
                                                    );
                                                    await loadSubtasks();
                                                }
                                            }
                                        }}
                                    />
                                    <span
                                        className={`text-sm truncate min-w-0 ${
                                            isTaskCompleted(subtask.status)
                                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {subtask.original_name || subtask.name}
                                    </span>
                                </div>
                                {isTaskCompleted(subtask.status) && (
                                    <span className="text-xs text-green-600 dark:text-green-400">
                                        ✓
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
import { toggleTaskCompletion, fetchSubtasks } from '../../utils/tasksService';
import { isTaskOverdueInTodayPlan } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { getApiPath } from '../../config/paths';

interface TaskItemProps {
    task: Task;
    onTaskUpdate: (task: Task) => Promise<void>;
    onTaskCompletionToggle?: (task: Task) => void;
    onTaskDelete: (taskUid: string) => void;
    projects: Project[];
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    isUpcomingView?: boolean;
    showCompletedTasks?: boolean;
}

const TaskItem: React.FC<TaskItemProps> = ({
    task,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    onToggleToday,
    isUpcomingView = false,
    showCompletedTasks = false,
}) => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [projectList, setProjectList] = useState<Project[]>(projects);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const { showErrorToast } = useToast();
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    // Subtasks state
    const [subtasks, setSubtasks] = useState<Task[]>([]);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [showSubtasks, setShowSubtasks] = useState(false);

    // Update projectList when projects prop changes
    useEffect(() => {
        setProjectList(projects);
    }, [projects]);

    const loadSubtasks = useCallback(async () => {
        if (!task.uid) return;

        setLoadingSubtasks(true);
        try {
            const subtasksData = await fetchSubtasks(task.uid);
            setSubtasks(subtasksData);
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            setSubtasks([]);
        } finally {
            setLoadingSubtasks(false);
        }
    }, [task.id]);

    // Calculate completion percentage
    const calculateCompletionPercentage = () => {
        if (subtasks.length === 0) return 0;
        const completedCount = subtasks.filter(
            (subtask) =>
                subtask.status === 'done' ||
                subtask.status === 2 ||
                subtask.status === 'archived' ||
                subtask.status === 3
        ).length;
        return Math.round((completedCount / subtasks.length) * 100);
    };

    const completionPercentage = calculateCompletionPercentage();
    const hasInitialSubtasks = task.subtasks && task.subtasks.length > 0;
    const shouldShowSubtasksIcon =
        hasInitialSubtasks || subtasks.length > 0 || loadingSubtasks;

    useEffect(() => {
        const subtasksData = task.subtasks || [];
        setSubtasks(subtasksData);
    }, [task.id, task.subtasks]);

    useEffect(() => {
        setShowSubtasks(false);
    }, [task.id]);
    const handleTaskClick = () => {
        if (task.uid) {
            if (task.habit_mode) {
                navigate(`/habit/${task.uid}`);
            } else {
                navigate(`/task/${task.uid}`);
            }
        }
    };

    const handleSubtaskClick = async () => {
        // Navigate to the parent task URL (not the subtask URL)
        if (task.uid) {
            navigate(`/task/${task.uid}`);
        }
    };

    const handleSubtasksToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!showSubtasks) {
            if (subtasks.length === 0) {
                await loadSubtasks();
            }
            setShowSubtasks(true);
        } else {
            setShowSubtasks(false);
        }
    };

    const handleEdit = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (task.uid) {
            navigate(`/task/${task.uid}`);
        }
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsConfirmDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        setIsConfirmDialogOpen(false);
        handleDelete();
    };

    const handleDelete = async () => {
        if (task.uid) {
            try {
                await onTaskDelete(task.uid);
            } catch (error: any) {
                console.error('Task delete failed:', error);
                showErrorToast(
                    t('errors.permissionDenied', 'Permission denied')
                );
            }
        }
    };

    const handleToggleCompletion = async () => {
        if (task.id) {
            try {
                // Check if task is being completed (not uncompleted)
                const isCompletingTask =
                    task.status !== 'done' &&
                    task.status !== 2 &&
                    task.status !== 'archived' &&
                    task.status !== 3;

                // If completing the task in upcoming view and not showing completed tasks, trigger animation
                if (isCompletingTask && isUpcomingView && !showCompletedTasks) {
                    setIsAnimatingOut(true);
                    // Wait for animation to complete before updating state
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }

                const response = await toggleTaskCompletion(task.uid!, task);

                // Handle the updated task
                if (onTaskCompletionToggle) {
                    onTaskCompletionToggle(response);
                } else {
                    // Merge the response with existing task data to preserve subtasks
                    const mergedTask = {
                        ...task,
                        ...response,
                        // Explicitly preserve subtasks data from original task
                        subtasks: response.subtasks || task.subtasks || [],
                    };
                    await onTaskUpdate(mergedTask);
                }

                // Only refresh if parent-child logic was executed (affecting other tasks)
                if (response.parent_child_logic_executed) {
                    // Instead of refreshing, let's refetch and update the task data
                    setTimeout(async () => {
                        try {
                            // Refetch the current task with updated subtasks
                            const updatedTaskResponse = await fetch(
                                getApiPath(`task/${task.uid}`)
                            );
                            if (updatedTaskResponse.ok) {
                                const updatedTaskData =
                                    await updatedTaskResponse.json();
                                await onTaskUpdate(updatedTaskData);
                            }
                        } catch (error) {
                            console.error(
                                'Error refetching task after parent-child logic:',
                                error
                            );
                            // Fallback to refresh if API call fails
                            window.location.reload();
                        }
                    }, 200);
                }
            } catch (error) {
                console.error('Error toggling task completion:', error);
                setIsAnimatingOut(false); // Reset animation state on error
            }
        }
    };

    // Use the project from the task's included data if available, otherwise find from projectList
    let project =
        task.Project || projectList.find((p) => p.id === task.project_id);

    // If project exists but doesn't have an ID, add the ID from task.project_id
    if (project && !project.id && task.project_id) {
        project = { ...project, id: task.project_id };
    }

    // Check if task is in progress to apply pulsing border animation
    const isInProgress = task.status === 'in_progress' || task.status === 1;

    // Check if task is overdue (created yesterday or earlier and not completed)
    const isOverdue = isTaskOverdueInTodayPlan(task);

    const priorityBorderClass = isTaskCompleted(task.status)
        ? 'border-l-4 border-l-green-500'
        : getPriorityBorderClassName(task.priority);

    return (
        <>
            <div
                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 relative overflow-visible transition-colors duration-200 ease-in-out hover:ring-1 hover:ring-gray-200 dark:hover:ring-gray-700 ${priorityBorderClass} ${
                    isInProgress
                        ? 'ring-1 ring-blue-500/60 dark:ring-blue-600/60'
                        : ''
                } ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
            >
                <TaskHeader
                    task={task}
                    project={project}
                    onTaskClick={handleTaskClick}
                    onToggleCompletion={handleToggleCompletion}
                    hideProjectName={hideProjectName}
                    onToggleToday={onToggleToday}
                    onTaskUpdate={onTaskUpdate}
                    isOverdue={isOverdue}
                    showSubtasks={showSubtasks}
                    hasSubtasks={shouldShowSubtasksIcon}
                    onSubtasksToggle={
                        shouldShowSubtasksIcon
                            ? handleSubtasksToggle
                            : undefined
                    }
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    isUpcomingView={isUpcomingView}
                />

                {/* Progress bar at bottom of parent task */}
                {subtasks.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 opacity-100">
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 ml-1 rounded-r-lg overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 transition-all duration-500 ease-out"
                                style={{ width: `${completionPercentage}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Hide subtasks display for archived tasks */}
            {showSubtasks &&
                (subtasks.length > 0 || loadingSubtasks) &&
                !(task.status === 'archived' || task.status === 3) && (
                    <SubtasksDisplay
                        loadingSubtasks={loadingSubtasks}
                        subtasks={subtasks}
                        onTaskClick={(e) => {
                            e.stopPropagation();
                            handleSubtaskClick();
                        }}
                        loadSubtasks={loadSubtasks}
                        onSubtaskUpdate={(updatedSubtask) => {
                            setSubtasks((prev) =>
                                prev.map((st) =>
                                    st.id === updatedSubtask.id
                                        ? updatedSubtask
                                        : st
                                )
                            );
                        }}
                    />
                )}
            {/* Confirm Delete Dialog */}
            {isConfirmDialogOpen && (
                <ConfirmDialog
                    title={t('tasks.deleteConfirmTitle', 'Delete Task')}
                    message={t(
                        'tasks.deleteConfirmMessage',
                        `Are you sure you want to delete "${task.name}"? This action cannot be undone.`
                    )}
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setIsConfirmDialogOpen(false)}
                />
            )}
        </>
    );
};

export default React.memo(TaskItem);
