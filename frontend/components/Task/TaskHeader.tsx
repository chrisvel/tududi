import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarDaysIcon,
    CalendarIcon,
    PlayIcon,
    ArrowPathIcon,
    ArrowRightIcon,
    ListBulletIcon,
} from '@heroicons/react/24/outline';
import { TagIcon, FolderIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import TaskPriorityIcon from './TaskPriorityIcon';
import { Project } from '../../entities/Project';
import { Task, StatusType } from '../../entities/Task';
import { fetchSubtasks } from '../../utils/tasksService';

interface TaskHeaderProps {
    task: Task;
    project?: Project;
    onTaskClick: (e: React.MouseEvent) => void;
    onToggleCompletion?: () => void;
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number) => Promise<void>;
    onTaskUpdate?: (task: Task) => Promise<void>;
    isOverdue?: boolean;
    // Props for subtasks functionality
    showSubtasks?: boolean;
    hasSubtasks?: boolean;
    onSubtasksToggle?: (e: React.MouseEvent) => void;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
    task,
    project,
    onTaskClick,
    onToggleCompletion,
    hideProjectName = false,
    onToggleToday,
    onTaskUpdate,
    isOverdue = false,
    // Props for subtasks functionality
    showSubtasks,
    hasSubtasks,
    onSubtasksToggle,
}) => {
    const { t } = useTranslation();

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

    const handleTodayToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening task modal
        if (onToggleToday && task.id) {
            try {
                await onToggleToday(task.id);
            } catch (error) {
                console.error('Failed to toggle today status:', error);
            }
        }
    };

    const handlePlayToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening task modal
        if (
            task.id &&
            (task.status === 'not_started' ||
                task.status === 'in_progress' ||
                task.status === 0 ||
                task.status === 1) &&
            onTaskUpdate
        ) {
            try {
                const isCurrentlyInProgress =
                    task.status === 'in_progress' || task.status === 1;
                const updatedTask = {
                    ...task,
                    status: (isCurrentlyInProgress
                        ? 'not_started'
                        : 'in_progress') as StatusType,
                    // Automatically add to today plan when setting to in_progress
                    today: isCurrentlyInProgress ? task.today : true,
                };
                await onTaskUpdate(updatedTask);
            } catch (error) {
                console.error('Failed to toggle in progress status:', error);
            }
        }
    };

    // Check if task has metadata (project, tags, due_date, recurrence_type)
    const hasMetadata =
        (project && !hideProjectName) ||
        (task.tags && task.tags.length > 0) ||
        task.due_date ||
        (task.recurrence_type && task.recurrence_type !== 'none');

    return (
        <div
            className={`${hasMetadata ? 'py-2' : 'py-3'} px-4 cursor-pointer group`}
            onClick={onTaskClick}
        >
            {/* Full view (md and larger) */}
            <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center space-x-3 mb-2 md:mb-0">
                    <TaskPriorityIcon
                        priority={task.priority}
                        status={task.status}
                        onToggleCompletion={onToggleCompletion}
                    />
                    <div className="flex flex-col">
                        <div className="flex items-center">
                            <span className="text-md text-gray-900 dark:text-gray-100">
                                {task.name}
                            </span>
                            {isOverdue && (
                                <ArrowRightIcon
                                    className="ml-2 h-4 w-4 text-amber-600 dark:text-amber-400 opacity-60"
                                    title="This task was in your plan yesterday and wasn't completed."
                                />
                            )}
                        </div>
                        {/* Project, tags, due date, and recurrence in same row, with spacing when they exist */}
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            {project && !hideProjectName && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <Link
                                        to={`/project/${project.id}`}
                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {project.name}
                                    </Link>
                                </div>
                            )}
                            {project &&
                                !hideProjectName &&
                                task.tags &&
                                task.tags.length > 0 && (
                                    <span className="mx-2">•</span>
                                )}
                            {task.tags && task.tags.length > 0 && (
                                <div className="flex items-center">
                                    <TagIcon className="h-3 w-3 mr-1" />
                                    <span>
                                        {task.tags.map((tag, index) => (
                                            <React.Fragment key={tag.name}>
                                                <Link
                                                    to={`/tag/${encodeURIComponent(tag.name)}`}
                                                    className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                >
                                                    {tag.name}
                                                </Link>
                                                {index <
                                                    task.tags!.length - 1 &&
                                                    ', '}
                                            </React.Fragment>
                                        ))}
                                    </span>
                                </div>
                            )}
                            {((project && !hideProjectName) ||
                                (task.tags && task.tags.length > 0)) &&
                                task.due_date && (
                                    <span className="mx-2">•</span>
                                )}
                            {task.due_date && (
                                <div className="flex items-center">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    <span>{formatDueDate(task.due_date)}</span>
                                </div>
                            )}
                            {((project && !hideProjectName) ||
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
                    </div>
                </div>
                <div className="flex items-center flex-wrap justify-start md:justify-end space-x-2">
                    {/* Today Plan Controls */}
                    {onToggleToday && (
                        <button
                            onClick={handleTodayToggle}
                            className={`items-center justify-center ${
                                Number(task.today_move_count) > 1
                                    ? 'px-2 h-6'
                                    : 'w-6 h-6'
                            } rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                                task.today
                                    ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 flex'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hidden group-hover:flex'
                            }`}
                            title={
                                task.today
                                    ? t(
                                          'tasks.removeFromToday',
                                          'Remove from today plan'
                                      )
                                    : t('tasks.addToToday', 'Add to today plan')
                            }
                        >
                            {task.today ? (
                                <CalendarDaysIcon className="h-3 w-3" />
                            ) : (
                                <CalendarIcon className="h-3 w-3" />
                            )}
                            {Number(task.today_move_count) > 1 && (
                                <span className="ml-1 text-xs font-medium">
                                    {Number(task.today_move_count)}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Play/In Progress Controls */}
                    {(task.status === 'not_started' ||
                        task.status === 'in_progress' ||
                        task.status === 0 ||
                        task.status === 1) && (
                        <button
                            onClick={handlePlayToggle}
                            className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                                task.status === 'in_progress' ||
                                task.status === 1
                                    ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 animate-pulse'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100'
                            }`}
                            title={
                                task.status === 'in_progress' ||
                                task.status === 1
                                    ? t(
                                          'tasks.setNotStarted',
                                          'Set to not started'
                                      )
                                    : t(
                                          'tasks.setInProgress',
                                          'Set in progress'
                                      )
                            }
                        >
                            <PlayIcon className="h-3 w-3" />
                        </button>
                    )}

                    {/* Show Subtasks Controls */}
                    {hasSubtasks &&
                        !(task.status === 'archived' || task.status === 3) && (
                            <button
                                onClick={(e) => {
                                    if (onSubtasksToggle) {
                                        onSubtasksToggle(e);
                                    }
                                }}
                                className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                                    showSubtasks
                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100'
                                }`}
                                title={
                                    showSubtasks
                                        ? t(
                                              'tasks.hideSubtasks',
                                              'Hide subtasks'
                                          )
                                        : t(
                                              'tasks.showSubtasks',
                                              'Show subtasks'
                                          )
                                }
                            >
                                <ListBulletIcon className="h-3 w-3" />
                            </button>
                        )}
                </div>
            </div>

            {/* Mobile view (below md breakpoint) */}
            <div className="block md:hidden">
                <div className="flex items-center">
                    {/* Priority Icon - Centered vertically with entire card */}
                    <div className="flex items-center justify-center w-5 flex-shrink-0">
                        <TaskPriorityIcon
                            priority={task.priority}
                            status={task.status}
                            onToggleCompletion={onToggleCompletion}
                        />
                    </div>

                    {/* Task content - 65% width */}
                    <div className="ml-2 flex-1 w-[65%] min-w-0">
                        {/* Task Title */}
                        <div className="font-light text-md text-gray-900 dark:text-gray-100">
                            <span className="break-words">{task.name}</span>
                            {isOverdue && (
                                <ArrowRightIcon
                                    className="ml-2 h-4 w-4 text-amber-600 dark:text-amber-400 opacity-60"
                                    title="This task was in your plan yesterday and wasn't completed."
                                />
                            )}
                        </div>

                        {/* Project, tags, due date, and recurrence */}
                        <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                            {project && !hideProjectName && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <Link
                                        to={`/project/${project.id}`}
                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {project.name}
                                    </Link>
                                </div>
                            )}
                            {task.tags && task.tags.length > 0 && (
                                <div className="flex items-center">
                                    <TagIcon className="h-3 w-3 mr-1" />
                                    <span>
                                        {task.tags.map((tag, index) => (
                                            <React.Fragment key={tag.name}>
                                                <Link
                                                    to={`/tag/${encodeURIComponent(tag.name)}`}
                                                    className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                >
                                                    {tag.name}
                                                </Link>
                                                {index <
                                                    task.tags!.length - 1 &&
                                                    ', '}
                                            </React.Fragment>
                                        ))}
                                    </span>
                                </div>
                            )}
                            {task.due_date && (
                                <div className="flex items-center">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    <span>{formatDueDate(task.due_date)}</span>
                                </div>
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
                    </div>

                    {/* Mobile buttons on the right */}
                    <div className="flex items-center space-x-2 ml-2">
                        {/* Today Plan Controls - Mobile */}
                        {onToggleToday && (
                            <button
                                onClick={handleTodayToggle}
                                className={`items-center justify-center ${Number(task.today_move_count) > 1 ? 'px-2 h-6' : 'w-6 h-6'} rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                                    task.today
                                        ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 flex'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 hidden group-hover:flex'
                                }`}
                                title={
                                    task.today
                                        ? t(
                                              'tasks.removeFromToday',
                                              'Remove from today plan'
                                          )
                                        : t(
                                              'tasks.addToToday',
                                              'Add to today plan'
                                          )
                                }
                            >
                                {task.today ? (
                                    <CalendarDaysIcon className="h-3 w-3" />
                                ) : (
                                    <CalendarIcon className="h-3 w-3" />
                                )}
                                {Number(task.today_move_count) > 1 && (
                                    <span className="ml-1 text-xs font-medium">
                                        {Number(task.today_move_count)}
                                    </span>
                                )}
                            </button>
                        )}

                        {/* Play/In Progress Controls - Mobile */}
                        {(task.status === 'not_started' ||
                            task.status === 'in_progress' ||
                            task.status === 0 ||
                            task.status === 1) && (
                            <button
                                onClick={handlePlayToggle}
                                className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                                    task.status === 'in_progress' ||
                                    task.status === 1
                                        ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 animate-pulse'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100'
                                }`}
                                title={
                                    task.status === 'in_progress' ||
                                    task.status === 1
                                        ? t(
                                              'tasks.setNotStarted',
                                              'Set to not started'
                                          )
                                        : t(
                                              'tasks.setInProgress',
                                              'Set in progress'
                                          )
                                }
                            >
                                <PlayIcon className="h-3 w-3" />
                            </button>
                        )}

                        {/* Show Subtasks Controls - Mobile */}
                        {hasSubtasks &&
                            !(
                                task.status === 'archived' || task.status === 3
                            ) && (
                                <button
                                    onClick={(e) => {
                                        console.log(
                                            'Subtasks button clicked (mobile)',
                                            e
                                        );
                                        if (onSubtasksToggle) {
                                            onSubtasksToggle(e);
                                        }
                                    }}
                                    className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                                        showSubtasks
                                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100'
                                    }`}
                                    title={
                                        showSubtasks
                                            ? t(
                                                  'tasks.hideSubtasks',
                                                  'Hide subtasks'
                                              )
                                            : t(
                                                  'tasks.showSubtasks',
                                                  'Show subtasks'
                                              )
                                    }
                                >
                                    <ListBulletIcon className="h-3 w-3" />
                                </button>
                            )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Subtasks Display Component
interface SubtasksDisplayProps {
    showSubtasks: boolean;
    loadingSubtasks: boolean;
    subtasks: Task[];
    onTaskClick: (e: React.MouseEvent, task: Task) => void;
}

const SubtasksDisplay: React.FC<SubtasksDisplayProps> = ({
    showSubtasks,
    loadingSubtasks,
    subtasks,
    onTaskClick,
}) => {
    const { t } = useTranslation();

    if (!showSubtasks) return null;

    return (
        <div className="mt-1 space-y-1">
            {loadingSubtasks ? (
                <div className="ml-[10%] text-sm text-gray-500 dark:text-gray-400">
                    {t('loading.subtasks', 'Loading subtasks...')}
                </div>
            ) : subtasks.length > 0 ? (
                subtasks.map((subtask) => (
                    <div key={subtask.id} className="ml-[10%] group">
                        <div
                            className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 cursor-pointer transition-all duration-200 ${
                                subtask.status === 'in_progress' ||
                                subtask.status === 1
                                    ? 'border-green-400/60 dark:border-green-500/60'
                                    : 'border-gray-50 dark:border-gray-800'
                            }`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onTaskClick(e, subtask);
                            }}
                        >
                            <div className="px-3 py-2.5 flex items-center justify-between">
                                {/* Left side - Task info */}
                                <div className="flex items-center space-x-2 flex-1 min-w-0">
                                    <TaskPriorityIcon
                                        priority={subtask.priority}
                                        status={subtask.status}
                                    />
                                    <span
                                        className={`text-sm flex-1 truncate ${
                                            subtask.status === 'done' ||
                                            subtask.status === 2 ||
                                            subtask.status === 'archived' ||
                                            subtask.status === 3
                                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {subtask.name}
                                    </span>
                                </div>

                                {/* Right side - Status indicator */}
                                <div className="flex items-center space-x-1">
                                    {subtask.status === 'done' ||
                                    subtask.status === 2 ||
                                    subtask.status === 'archived' ||
                                    subtask.status === 3 ? (
                                        <span className="text-xs text-green-600 dark:text-green-400">
                                            ✓
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            ) : (
                <div className="ml-[10%] text-sm text-gray-500 dark:text-gray-400">
                    {t('subtasks.noSubtasks', 'No subtasks found')}
                </div>
            )}
        </div>
    );
};

// TaskWithSubtasks Component that combines both
interface TaskWithSubtasksProps extends TaskHeaderProps {
    onSubtaskClick?: (subtask: Task) => void;
}

const TaskWithSubtasks: React.FC<TaskWithSubtasksProps> = (props) => {
    const [showSubtasks, setShowSubtasks] = useState(false);
    const [subtasks, setSubtasks] = useState<Task[]>([]);
    const [loadingSubtasks, setLoadingSubtasks] = useState(false);
    const [hasSubtasks, setHasSubtasks] = useState(false);

    // Check if task has subtasks using included data
    useEffect(() => {
        const hasSubtasksFromData =
            props.task.subtasks && props.task.subtasks.length > 0;
        setHasSubtasks(!!hasSubtasksFromData);

        // Set initial subtasks state if they are already loaded
        if (hasSubtasksFromData && props.task.subtasks) {
            setSubtasks(props.task.subtasks);
        }
    }, [props.task.id, props.task.subtasks]);

    const loadSubtasks = async () => {
        if (!props.task.id) return;

        // If subtasks are already included in the task data, use them
        if (props.task.subtasks && props.task.subtasks.length > 0) {
            setSubtasks(props.task.subtasks);
            return;
        }

        // Only fetch if not already included (fallback for older API responses)
        setLoadingSubtasks(true);
        try {
            const subtasksData = await fetchSubtasks(props.task.id);
            setSubtasks(subtasksData);
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            setSubtasks([]);
        } finally {
            setLoadingSubtasks(false);
        }
    };

    const handleSubtasksToggle = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening task modal

        if (!showSubtasks && subtasks.length === 0) {
            await loadSubtasks();
        }

        setShowSubtasks(!showSubtasks);
    };

    return (
        <>
            <TaskHeader
                {...props}
                // Pass the subtasks state to the header
                showSubtasks={showSubtasks}
                hasSubtasks={hasSubtasks}
                onSubtasksToggle={handleSubtasksToggle}
            />
            <SubtasksDisplay
                showSubtasks={showSubtasks}
                loadingSubtasks={loadingSubtasks}
                subtasks={subtasks}
                onTaskClick={(e, task) => {
                    e.stopPropagation();
                    // Call the parent's onSubtaskClick handler if provided
                    if (props.onSubtaskClick) {
                        props.onSubtaskClick(task);
                    }
                }}
            />
        </>
    );
};

export { TaskWithSubtasks };
export default TaskHeader;
