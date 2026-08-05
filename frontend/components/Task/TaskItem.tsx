import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Task } from '../../entities/Task';
import { Project } from '../../entities/Project';
import TaskHeader from './TaskHeader';
import { useToast } from '../Shared/ToastContext';
import {
    ExclamationTriangleIcon,
    BoltIcon,
    ArrowPathIcon,
    ClockIcon,
    ScaleIcon,
    ArrowRightCircleIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { toggleTaskCompletion, updateTask, fetchSubtasks, deleteTask } from '../../utils/tasksService';
import { isTaskOverdueInTodayPlan } from '../../utils/dateUtils';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '../Shared/ConfirmDialog';
import { getApiPath } from '../../config/paths';

const getStatusPillColor = (status: Task['status']): string => {
    if (status === 'in_progress' || status === 1) return 'bg-blue-400 dark:bg-blue-500';
    if (status === 'done' || status === 2 || status === 'archived' || status === 3) return 'bg-green-400 dark:bg-green-500';
    if (status === 'cancelled' || status === 5) return 'bg-red-400 dark:bg-red-400';
    if (status === 'planned' || status === 4) return 'bg-purple-400 dark:bg-purple-400';
    if (status === 'waiting') return 'bg-amber-400 dark:bg-amber-500';
    return 'bg-gray-300 dark:bg-gray-600';
};

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
    isInCompletedSection?: boolean;
    hideStatusControl?: boolean;
    isKanbanView?: boolean;
    showSuggestionChips?: boolean;
    compact?: boolean;
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
    hideStatusControl = false,
    isKanbanView = false,
    showSuggestionChips = false,
    compact = false,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const [projectList, setProjectList] = useState<Project[]>(projects);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const { showErrorToast, showUndoToast } = useToast();
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    // Status menu state
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

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
    const fromState = { state: { from: location.pathname + location.search } };

    const handleTaskClick = () => {
        if (task.uid) {
            if (task.habit_mode) {
                navigate(`/habit/${task.uid}`);
            } else {
                navigate(`/task/${task.uid}`, fromState);
            }
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
            navigate(`/task/${task.uid}`, fromState);
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

                const previousStatus = task.status;

                // If completing the task in upcoming view and not showing completed tasks, trigger animation
                if (isCompletingTask && isUpcomingView && !showCompletedTasks) {
                    setIsAnimatingOut(true);
                    // Wait for animation to complete before updating state
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }

                const response = await toggleTaskCompletion(task.uid!, task);

                // Show undo toast on completion
                if (isCompletingTask) {
                    showUndoToast(
                        <>Task <span className="font-semibold">&apos;{task.name}&apos;</span> completed.</>,
                        async () => {
                            try {
                                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                const { subtasks: _taskSubtasks, ...taskWithoutSubtasks } = task;
                                const reverted = await updateTask(task.uid!, {
                                    ...taskWithoutSubtasks,
                                    status: previousStatus,
                                    completed_at: null,
                                });
                                if (onTaskCompletionToggle) {
                                    onTaskCompletionToggle(reverted);
                                } else {
                                    await onTaskUpdate({ ...taskWithoutSubtasks, ...reverted });
                                }
                            } catch {
                                showErrorToast('Failed to undo task completion.');
                            }
                        }
                    );
                }

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

    // Check if task is overdue (created yesterday or earlier and not completed)
    const isOverdue = isTaskOverdueInTodayPlan(task);

    return (
        <div className={`relative ${isStatusMenuOpen ? 'z-[10001]' : ''}`}>
            <div
                className={`relative flex items-stretch rounded-lg transition-colors duration-150 hover:bg-gray-200/50 dark:hover:bg-gray-700/40 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
            >
                {/* Left status pill */}
                <span className={`flex-shrink-0 w-1.5 my-2 self-stretch rounded-sm ${getStatusPillColor(task.status)}`} />

                {/* Content */}
                <div className="flex-1 min-w-0 relative overflow-visible">
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
                        onMenuOpenChange={setIsStatusMenuOpen}
                        hideStatusControl={hideStatusControl}
                        isKanbanView={isKanbanView}
                        compact={compact}
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
            </div>

            {/* Suggestion reason row - only in Suggested section */}
            {showSuggestionChips && task._suggestionMeta && (() => {
                const { reason, reasonLabel, reasonColor } = task._suggestionMeta;
                const iconProps = { className: 'h-3.5 w-3.5 flex-shrink-0' };
                const icon =
                    reason === 'due'        ? <ExclamationTriangleIcon {...iconProps} /> :
                    reason === 'goal'       ? <ArrowRightCircleIcon {...iconProps} /> :
                    reason === 'high'       ? <BoltIcon {...iconProps} /> :
                    reason === 'revive'     ? <ArrowPathIcon {...iconProps} /> :
                    reason === 'aging_review' ? <ClockIcon {...iconProps} /> :
                    reason === 'area_balance' ? <ScaleIcon {...iconProps} /> :
                    reason === 'fits_now'   ? <SparklesIcon {...iconProps} /> :
                                              <ArrowRightCircleIcon {...iconProps} />;
                return (
                    <div
                        className="flex items-center gap-2 ml-4 px-3 py-1.5 rounded-b-lg text-[11px] select-none"
                        style={{
                            backgroundColor: `${reasonColor}12`,
                            color: `${reasonColor}cc`,
                        }}
                    >
                        {icon}
                        <span className="font-light leading-tight">{reasonLabel}</span>
                    </div>
                );
            })()}

            {/* Subtasks displayed as full task item cards */}
            {showSubtasks &&
                (subtasks.length > 0 || loadingSubtasks) &&
                !(task.status === 'archived' || task.status === 3) && (
                    <div className="mt-1 ml-4 space-y-1 relative z-0">
                        {loadingSubtasks ? (
                            <div className="text-sm text-gray-500 dark:text-gray-400 px-3 py-2">
                                {t('loading.subtasks', 'Loading subtasks...')}
                            </div>
                        ) : (
                            subtasks.map((subtask) => (
                                <TaskItem
                                    key={subtask.id ?? subtask.uid}
                                    task={subtask}
                                    onTaskUpdate={async (updated) => {
                                        setSubtasks((prev) =>
                                            prev.map((st) =>
                                                st.id === updated.id ? updated : st
                                            )
                                        );
                                    }}
                                    onTaskDelete={(subtaskUid) => {
                                        deleteTask(subtaskUid)
                                            .then(() => {
                                                setSubtasks((prev) =>
                                                    prev.filter((st) => st.uid !== subtaskUid)
                                                );
                                            })
                                            .catch((err) => {
                                                console.error('Error deleting subtask:', err);
                                            });
                                    }}
                                    projects={projects}
                                    hideProjectName
                                    compact
                                />
                            ))
                        )}
                    </div>
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
        </div>
    );
};

export default React.memo(TaskItem);
