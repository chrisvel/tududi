import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ExclamationTriangleIcon,
    BoltIcon,
    ArrowPathIcon,
    ClockIcon,
    ScaleIcon,
    ArrowRightCircleIcon,
    SparklesIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../../entities/Task';
import { Project } from '../../../entities/Project';
import { useToast } from '../../Shared/ToastContext';
import ConfirmDialog from '../../Shared/ConfirmDialog';
import { isTaskCompleted } from '../../../constants/taskStatus';
import {
    toggleTaskCompletion,
    updateTask,
    fetchSubtasks,
    deleteTask,
    createTask,
} from '../../../utils/tasksService';
import { isTaskOverdueInTodayPlan } from '../../../utils/dateUtils';
import { getApiPath } from '../../../config/paths';
import TaskRowCollapsed from './TaskRowCollapsed';
import TaskRowExpanded from './TaskRowExpanded';
import { useTaskRowExpansion } from './TaskRowExpansionContext';
import { useTaskRowSave } from './useTaskRowSave';

const getPriorityBorderClassName = (
    priority?: Task['priority'] | number
): string => {
    let p = priority;
    if (typeof p === 'number') {
        p = (['low', 'medium', 'high'] as const)[p] || undefined;
    }
    switch (p) {
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

export interface TaskRowProps {
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
    // Opt out of inline quick-edit: clicking the row opens the full page.
    disableExpand?: boolean;
}

const TaskRow: React.FC<TaskRowProps> = ({
    task,
    onTaskUpdate,
    onTaskCompletionToggle,
    onTaskDelete,
    projects,
    hideProjectName = false,
    isUpcomingView = false,
    showCompletedTasks = false,
    isInCompletedSection = false,
    hideStatusControl = false,
    compact = false,
    showSuggestionChips = false,
    disableExpand = false,
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const { showErrorToast, showUndoToast } = useToast();

    const [projectList, setProjectList] = useState<Project[]>(projects);
    const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);

    const [subtasks, setSubtasks] = useState<Task[]>(task.subtasks || []);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [showSubtasks, setShowSubtasks] = useState(false);

    const canExpand = !disableExpand && !task.habit_mode && !!task.uid;
    const { isExpanded, toggle, collapse } = useTaskRowExpansion(task.uid, {
        disabled: !canExpand,
    });
    const setters = useTaskRowSave(task, onTaskUpdate);
    const rowRootRef = useRef<HTMLDivElement>(null);

    // Keep the quick-edit panel mounted through its collapse animation.
    const [panelMounted, setPanelMounted] = useState(isExpanded);
    useEffect(() => {
        if (isExpanded) setPanelMounted(true);
    }, [isExpanded]);
    const handlePanelExited = useCallback(() => setPanelMounted(false), []);

    // Collapse the quick-edit form on Escape or a click outside the row.
    // Clicks inside portalled overlays (calendars, dropdown menus) render
    // outside #root, so they are ignored here.
    useEffect(() => {
        if (!isExpanded) return;
        const appRoot = document.getElementById('root');
        const onPointerDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (appRoot && !appRoot.contains(target)) return;
            if (rowRootRef.current && !rowRootRef.current.contains(target)) {
                collapse();
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') collapse();
        };
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isExpanded, collapse]);

    useEffect(() => setProjectList(projects), [projects]);
    useEffect(() => {
        setSubtasks(task.subtasks || []);
    }, [task.id, task.subtasks]);
    useEffect(() => {
        setShowSubtasks(false);
    }, [task.id]);

    const fromState = {
        state: { from: location.pathname + location.search },
    };
    const fullPagePath = task.habit_mode
        ? `/habit/${task.uid}`
        : `/task/${task.uid}`;

    const loadSubtasks = useCallback(async () => {
        if (!task.uid) return;
        setLoadingSubtasks(true);
        try {
            setSubtasks(await fetchSubtasks(task.uid));
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            setSubtasks([]);
        } finally {
            setLoadingSubtasks(false);
        }
    }, [task.uid]);

    const handleActivate = () => {
        if (canExpand) {
            toggle();
            return;
        }
        if (task.uid) navigate(fullPagePath, fromState);
    };

    const handleSubtasksToggle = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!showSubtasks) {
            if (subtasks.length === 0) await loadSubtasks();
            setShowSubtasks(true);
        } else {
            setShowSubtasks(false);
        }
    };

    const handleAddSubtask = useCallback(
        async (name: string) => {
            if (!task.id || !task.uid) return;
            try {
                await createTask({
                    name,
                    status: 'not_started',
                    completed_at: null,
                    parent_task_id: task.id,
                } as Task);
                const fresh = await fetchSubtasks(task.uid);
                setSubtasks(fresh);
                setShowSubtasks(true);
                await onTaskUpdate({ ...task, subtasks: fresh });
            } catch (error) {
                console.error('Failed to add subtask:', error);
                showErrorToast(
                    t('task.subtasksUpdateError', 'Failed to add subtask')
                );
            }
        },
        [task, onTaskUpdate, showErrorToast, t]
    );

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsConfirmDialogOpen(true);
    };

    const handleDelete = async () => {
        if (!task.uid) return;
        try {
            await onTaskDelete(task.uid);
        } catch (error) {
            console.error('Task delete failed:', error);
            showErrorToast(t('errors.permissionDenied', 'Permission denied'));
        }
    };

    const handleToggleCompletion = async () => {
        if (!task.id) return;
        try {
            const isCompletingTask =
                task.status !== 'done' &&
                task.status !== 2 &&
                task.status !== 'archived' &&
                task.status !== 3;
            const previousStatus = task.status;

            if (isCompletingTask && isUpcomingView && !showCompletedTasks) {
                setIsAnimatingOut(true);
                await new Promise((resolve) => setTimeout(resolve, 300));
            }

            const response = await toggleTaskCompletion(task.uid!, task);

            if (isCompletingTask) {
                showUndoToast(
                    <>
                        Task{' '}
                        <span className="font-semibold">
                            &apos;{task.name}&apos;
                        </span>{' '}
                        completed.
                    </>,
                    async () => {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-unused-vars
                            const { subtasks: _s, ...taskWithoutSubtasks } =
                                task;
                            const reverted = await updateTask(task.uid!, {
                                ...taskWithoutSubtasks,
                                status: previousStatus,
                                completed_at: null,
                            });
                            if (onTaskCompletionToggle) {
                                onTaskCompletionToggle(reverted);
                            } else {
                                await onTaskUpdate({
                                    ...taskWithoutSubtasks,
                                    ...reverted,
                                });
                            }
                        } catch {
                            showErrorToast('Failed to undo task completion.');
                        }
                    }
                );
            }

            if (onTaskCompletionToggle) {
                onTaskCompletionToggle(response);
            } else {
                await onTaskUpdate({
                    ...task,
                    ...response,
                    subtasks: response.subtasks || task.subtasks || [],
                });
            }

            if (response.parent_child_logic_executed) {
                setTimeout(async () => {
                    try {
                        const res = await fetch(getApiPath(`task/${task.uid}`));
                        if (res.ok) await onTaskUpdate(await res.json());
                    } catch (error) {
                        console.error(
                            'Error refetching task after parent-child logic:',
                            error
                        );
                        window.location.reload();
                    }
                }, 200);
            }
        } catch (error) {
            console.error('Error toggling task completion:', error);
            setIsAnimatingOut(false);
        }
    };

    let project =
        task.Project || projectList.find((p) => p.id === task.project_id);
    if (project && !project.id && task.project_id) {
        project = { ...project, id: task.project_id };
    }

    const isInProgress = task.status === 'in_progress' || task.status === 1;
    void isTaskOverdueInTodayPlan;

    const priorityBorderClass =
        isInCompletedSection || isTaskCompleted(task.status)
            ? 'border-l-4 border-l-green-500'
            : getPriorityBorderClassName(task.priority);

    const hasInitialSubtasks = !!(task.subtasks && task.subtasks.length > 0);
    const shouldShowSubtasksIcon =
        hasInitialSubtasks || subtasks.length > 0 || loadingSubtasks;

    const completionPercentage =
        subtasks.length === 0
            ? 0
            : Math.round(
                  (subtasks.filter(
                      (s) =>
                          s.status === 'done' ||
                          s.status === 2 ||
                          s.status === 'archived' ||
                          s.status === 3
                  ).length /
                      subtasks.length) *
                      100
              );

    return (
        <div
            ref={rowRootRef}
            className={`relative ${
                isStatusMenuOpen ? 'z-[10001]' : isExpanded ? 'z-30' : ''
            }`}
        >
            <div
                className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 relative overflow-visible transition-colors duration-200 ease-in-out hover:ring-1 hover:ring-gray-200 dark:hover:ring-gray-700 ${priorityBorderClass} ${
                    isInProgress
                        ? 'ring-1 ring-blue-500/60 dark:ring-blue-600/60'
                        : ''
                } ${
                    isExpanded
                        ? 'ring-1 ring-blue-400/70 dark:ring-blue-600/70'
                        : ''
                } ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`}
            >
                <TaskRowCollapsed
                    task={task}
                    project={project}
                    hideProjectName={hideProjectName}
                    hideStatusControl={hideStatusControl}
                    compact={compact}
                    onActivate={handleActivate}
                    onToggleCompletion={handleToggleCompletion}
                    onTaskUpdate={onTaskUpdate}
                    onMenuOpenChange={setIsStatusMenuOpen}
                    hasSubtasks={shouldShowSubtasksIcon}
                    showSubtasks={showSubtasks}
                    onSubtasksToggle={
                        shouldShowSubtasksIcon
                            ? handleSubtasksToggle
                            : undefined
                    }
                    editable={isExpanded}
                    onSaveTitle={setters.setTitle}
                    onEscape={collapse}
                />

                {panelMounted && (
                    <TaskRowExpanded
                        task={task}
                        projects={projectList}
                        setters={setters}
                        open={isExpanded}
                        onExited={handlePanelExited}
                        onDelete={handleDeleteClick}
                        fullPagePath={fullPagePath}
                        subtasksOpen={showSubtasks}
                        onToggleSubtasks={() => {
                            void handleSubtasksToggle({
                                stopPropagation: () => {},
                            } as React.MouseEvent);
                        }}
                        onAddSubtask={handleAddSubtask}
                    />
                )}

                {subtasks.length > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5">
                        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 ml-1 rounded-r-lg overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-green-400 via-green-500 to-green-600 transition-all duration-500 ease-out"
                                style={{ width: `${completionPercentage}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {showSuggestionChips &&
                task._suggestionMeta &&
                (() => {
                    const { reason, reasonLabel, reasonColor } =
                        task._suggestionMeta;
                    const iconProps = {
                        className: 'h-3.5 w-3.5 flex-shrink-0',
                    };
                    const icon =
                        reason === 'due' ? (
                            <ExclamationTriangleIcon {...iconProps} />
                        ) : reason === 'goal' ? (
                            <ArrowRightCircleIcon {...iconProps} />
                        ) : reason === 'high' ? (
                            <BoltIcon {...iconProps} />
                        ) : reason === 'revive' ? (
                            <ArrowPathIcon {...iconProps} />
                        ) : reason === 'aging_review' ? (
                            <ClockIcon {...iconProps} />
                        ) : reason === 'area_balance' ? (
                            <ScaleIcon {...iconProps} />
                        ) : reason === 'fits_now' ? (
                            <SparklesIcon {...iconProps} />
                        ) : (
                            <ArrowRightCircleIcon {...iconProps} />
                        );
                    return (
                        <div
                            className="flex items-center gap-2 ml-4 px-3 py-1.5 rounded-b-lg text-[11px] select-none"
                            style={{
                                backgroundColor: `${reasonColor}12`,
                                color: `${reasonColor}cc`,
                            }}
                        >
                            {icon}
                            <span className="font-light leading-tight">
                                {reasonLabel}
                            </span>
                        </div>
                    );
                })()}

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
                                <TaskRow
                                    key={subtask.id ?? subtask.uid}
                                    task={subtask}
                                    onTaskUpdate={async (updated) => {
                                        setSubtasks((prev) =>
                                            prev.map((st) =>
                                                st.id === updated.id
                                                    ? updated
                                                    : st
                                            )
                                        );
                                    }}
                                    onTaskDelete={(subtaskUid) => {
                                        deleteTask(subtaskUid)
                                            .then(() =>
                                                setSubtasks((prev) =>
                                                    prev.filter(
                                                        (st) =>
                                                            st.uid !==
                                                            subtaskUid
                                                    )
                                                )
                                            )
                                            .catch((err) =>
                                                console.error(
                                                    'Error deleting subtask:',
                                                    err
                                                )
                                            );
                                    }}
                                    projects={projects}
                                    hideProjectName
                                    compact
                                />
                            ))
                        )}
                    </div>
                )}

            {isConfirmDialogOpen && (
                <ConfirmDialog
                    title={t('tasks.deleteConfirmTitle', 'Delete Task')}
                    message={t(
                        'tasks.deleteConfirmMessage',
                        `Are you sure you want to delete "${task.name}"? This action cannot be undone.`
                    )}
                    onConfirm={() => {
                        setIsConfirmDialogOpen(false);
                        void handleDelete();
                    }}
                    onCancel={() => setIsConfirmDialogOpen(false)}
                />
            )}
        </div>
    );
};

export default React.memo(TaskRow);
