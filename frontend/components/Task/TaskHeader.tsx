import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarDaysIcon,
    CalendarIcon,
    ArrowPathIcon,
    ListBulletIcon,
    ChevronDownIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { TagIcon, FolderIcon, FireIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import TaskPriorityIcon from '../Shared/Icons/TaskPriorityIcon';
import { Project } from '../../entities/Project';
import { Task } from '../../entities/Task';
import { fetchSubtasks } from '../../utils/tasksService';
import { isTaskCompleted, isTaskInProgress } from '../../constants/taskStatus';
import TaskStatusControl from './TaskStatusControl';
import { parseDateString } from '../../utils/dateUtils';

interface TaskHeaderProps {
    task: Task;
    project?: Project;
    onTaskClick: (e: React.MouseEvent) => void;
    onToggleCompletion?: () => void;
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    onTaskUpdate?: (task: Task) => Promise<void>;
    isOverdue?: boolean;
    showSubtasks?: boolean;
    hasSubtasks?: boolean;
    onSubtasksToggle?: (e: React.MouseEvent) => void;
    // Props for edit and delete functionality
    onEdit?: (e: React.MouseEvent) => void;
    onDelete?: (e: React.MouseEvent) => void;
    isUpcomingView?: boolean;
}

const TaskHeader: React.FC<TaskHeaderProps> = ({
    task,
    project,
    onTaskClick,
    onToggleCompletion,
    hideProjectName = false,
    onToggleToday: _onToggleToday,
    onTaskUpdate,
    showSubtasks,
    hasSubtasks,
    onSubtasksToggle,
    // Props for edit and delete functionality
    onEdit: _onEdit,
    onDelete: _onDelete,
    isUpcomingView = false,
}) => {
    const { t } = useTranslation();
    void _onToggleToday;
    void _onEdit;
    void _onDelete;
    const SubtasksToggleButton = () => {
        if (!hasSubtasks || !onSubtasksToggle) return null;

        return (
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSubtasksToggle(e);
                }}
                className={`ml-1 flex items-center justify-center h-5 px-1.5 rounded-full border transition-colors duration-150 gap-0.5 ${
                    showSubtasks
                        ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-100'
                        : 'text-gray-400 border-transparent hover:border-gray-200 hover:text-gray-600 dark:hover:border-gray-600'
                }`}
                aria-pressed={!!showSubtasks}
                title={
                    showSubtasks
                        ? t('tasks.hideSubtasks', 'Hide subtasks')
                        : t('tasks.showSubtasks', 'Show subtasks')
                }
            >
                <ListBulletIcon className="h-3.5 w-3.5" />
                <ChevronDownIcon
                    className={`h-3 w-3 transition-transform ${
                        showSubtasks ? 'rotate-180' : ''
                    }`}
                />
            </button>
        );
    };

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

        const date = parseDateString(dueDate);
        if (!date) return dueDate;
        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDeferUntil = (deferUntil: string): string | null => {
        const date = new Date(deferUntil);
        if (Number.isNaN(date.getTime())) {
            return null;
        }

        const datePart = date.toLocaleDateString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });

        const timePart = date.toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
        });

        return `${datePart} • ${timePart}`;
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

    const formattedDeferUntil = task.defer_until
        ? formatDeferUntil(task.defer_until)
        : null;

    // Check if task has metadata (project, tags, due_date, completed_at, recurrence_type, recurring_parent_id, or defer_until)
    const hasMetadata =
        (project && !hideProjectName) ||
        (task.tags && task.tags.length > 0) ||
        task.due_date ||
        (isTaskCompleted(task.status) && task.completed_at) ||
        (task.recurrence_type && task.recurrence_type !== 'none') ||
        task.recurring_parent_id ||
        !!formattedDeferUntil;

    return (
        <div
            className={`${hasMetadata ? 'py-2' : 'py-3'} px-4 cursor-pointer group`}
            role="button"
            tabIndex={0}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTaskClick(e);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onTaskClick(e as any);
                }
            }}
        >
            {/* Full view (md and larger) */}
            <div className="hidden md:flex flex-col md:flex-row md:items-center md:relative">
                <div
                    className={`flex items-center space-x-3 mb-2 md:mb-0 flex-1 min-w-0 ${!isUpcomingView ? 'pr-44' : ''}`}
                >
                    <div className="hidden">
                        <TaskPriorityIcon
                            priority={task.priority}
                            status={task.status}
                            onToggleCompletion={onToggleCompletion}
                            testIdSuffix="-desktop"
                        />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                        {isUpcomingView ? (
                            <div className="flex-1 min-w-0">
                                {/* Full width title that wraps */}
                                <div className="mb-0.5 flex items-center gap-1.5 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        {task.habit_mode && (
                                            <FireIcon
                                                className="h-4 w-4 text-orange-500 flex-shrink-0"
                                                title="Habit"
                                            />
                                        )}
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-300 tracking-tight truncate">
                                            {task.original_name || task.name}
                                        </span>
                                    </div>
                                    <SubtasksToggleButton />
                                </div>
                                {/* Show project and tags info in upcoming view */}
                                {project && !hideProjectName && (
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                        <FolderIcon className="h-3 w-3 mr-1" />
                                        <Link
                                            to={
                                                project.uid
                                                    ? `/project/${project.uid}-${project.name
                                                          .toLowerCase()
                                                          .replace(
                                                              /[^a-z0-9]+/g,
                                                              '-'
                                                          )
                                                          .replace(
                                                              /^-|-$/g,
                                                              ''
                                                          )}`
                                                    : `/project/${project.id}`
                                            }
                                            className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                            onClick={(e) => {
                                                // Prevent navigation if we're already on this project's page
                                                if (
                                                    window.location.pathname ===
                                                    `/project/${project.id}`
                                                ) {
                                                    e.preventDefault();
                                                }
                                                e.stopPropagation();
                                            }}
                                        >
                                            {project.name}
                                        </Link>
                                    </div>
                                )}
                                {task.tags && task.tags.length > 0 && (
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                        <TagIcon className="h-3 w-3 mr-1" />
                                        <span>
                                            {task.tags.map((tag, index) => (
                                                <React.Fragment key={tag.name}>
                                                    <Link
                                                        to={
                                                            tag.uid
                                                                ? `/tag/${tag.uid}-${tag.name
                                                                      .toLowerCase()
                                                                      .replace(
                                                                          /[^a-z0-9]+/g,
                                                                          '-'
                                                                      )
                                                                      .replace(
                                                                          /^-|-$/g,
                                                                          ''
                                                                      )}`
                                                                : `/tag/${tag.name
                                                                      .toLowerCase()
                                                                      .replace(
                                                                          /[^a-z0-9]+/g,
                                                                          '-'
                                                                      )
                                                                      .replace(
                                                                          /^-|-$/g,
                                                                          ''
                                                                      )}`
                                                        }
                                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
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
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                {task.habit_mode && (
                                    <FireIcon
                                        className="h-4 w-4 text-orange-500 flex-shrink-0"
                                        title="Habit"
                                    />
                                )}
                                <span className="text-md font-medium text-gray-900 dark:text-gray-300 truncate">
                                    {task.original_name || task.name}
                                </span>
                                <SubtasksToggleButton />
                            </div>
                        )}
                        {/* Project, tags, due date, and recurrence in same row, with spacing when they exist */}
                        {!isUpcomingView && (
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap overflow-x-auto">
                                {project && !hideProjectName && (
                                    <div className="flex items-center">
                                        <FolderIcon className="h-3 w-3 mr-1" />
                                        <Link
                                            to={
                                                project.uid
                                                    ? `/project/${project.uid}-${project.name
                                                          .toLowerCase()
                                                          .replace(
                                                              /[^a-z0-9]+/g,
                                                              '-'
                                                          )
                                                          .replace(
                                                              /^-|-$/g,
                                                              ''
                                                          )}`
                                                    : `/project/${project.id}`
                                            }
                                            className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                            onClick={(e) => {
                                                // Prevent navigation if we're already on this project's page
                                                if (
                                                    window.location.pathname ===
                                                    `/project/${project.id}`
                                                ) {
                                                    e.preventDefault();
                                                }
                                                e.stopPropagation();
                                            }}
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
                                                        to={
                                                            tag.uid
                                                                ? `/tag/${tag.uid}-${tag.name
                                                                      .toLowerCase()
                                                                      .replace(
                                                                          /[^a-z0-9]+/g,
                                                                          '-'
                                                                      )
                                                                      .replace(
                                                                          /^-|-$/g,
                                                                          ''
                                                                      )}`
                                                                : `/tag/${tag.name
                                                                      .toLowerCase()
                                                                      .replace(
                                                                          /[^a-z0-9]+/g,
                                                                          '-'
                                                                      )
                                                                      .replace(
                                                                          /^-|-$/g,
                                                                          ''
                                                                      )}`
                                                        }
                                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
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
                                    <div className="flex items-center whitespace-nowrap">
                                        <CalendarIcon className="h-3 w-3 mr-1" />
                                        <span>
                                            {formatDueDate(task.due_date)}
                                        </span>
                                    </div>
                                )}
                                {isTaskCompleted(task.status) &&
                                    task.completed_at && (
                                        <div className="flex items-center whitespace-nowrap">
                                            <CheckIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {formatDueDate(
                                                    task.completed_at.split(
                                                        'T'
                                                    )[0]
                                                )}
                                            </span>
                                        </div>
                                    )}
                                {task.recurrence_type &&
                                    task.recurrence_type !== 'none' && (
                                        <div
                                            className="flex items-center"
                                            title={
                                                task.due_date
                                                    ? `${t('next', 'Next')}: ${formatDueDate(task.due_date)}`
                                                    : undefined
                                            }
                                        >
                                            <ArrowPathIcon className="h-3 w-3 mr-1" />
                                            <span>
                                                {formatRecurrence(
                                                    task.recurrence_type
                                                )}
                                            </span>
                                        </div>
                                    )}
                                {task.recurring_parent_id && (
                                    <div className="flex items-center">
                                        <ArrowPathIcon className="h-3 w-3 mr-1" />
                                        <span>
                                            {t(
                                                'recurrence.instance',
                                                'Recurring task instance'
                                            )}
                                        </span>
                                    </div>
                                )}
                                {formattedDeferUntil && (
                                    <div className="flex items-center">
                                        <CalendarDaysIcon className="h-3 w-3 mr-1" />
                                        <span>{formattedDeferUntil}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {!isUpcomingView && !task.habit_mode && onToggleCompletion && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center">
                        <TaskStatusControl
                            task={task}
                            onToggleCompletion={onToggleCompletion}
                            onTaskUpdate={onTaskUpdate}
                            showMobileVariant={false}
                            className=""
                        />
                    </div>
                )}
            </div>

            {/* Mobile view (below md breakpoint) */}
            <div className="block md:hidden">
                <div className="flex items-center">
                    {/* Priority Icon - Centered vertically with entire card */}
                    <div className="hidden">
                        <TaskPriorityIcon
                            priority={task.priority}
                            status={task.status}
                            onToggleCompletion={onToggleCompletion}
                            testIdSuffix="-mobile"
                        />
                    </div>

                    {/* Task content - full width */}
                    <div className="ml-3 flex-1 min-w-0">
                        {/* Task Title */}
                        <div className="font-medium text-md text-gray-900 dark:text-gray-300">
                            <span className="inline-flex items-center gap-1.5 w-full min-w-0">
                                {task.habit_mode && (
                                    <FireIcon
                                        className="h-4 w-4 text-orange-500 flex-shrink-0"
                                        title="Habit"
                                    />
                                )}
                                <span className="truncate flex-1">
                                    {task.original_name || task.name}
                                </span>
                                <SubtasksToggleButton />
                            </span>
                        </div>

                        {/* Project, tags, due date, and recurrence */}
                        <div
                            className={`flex flex-col text-xs text-gray-500 dark:text-gray-400 space-y-1 ${hasMetadata ? 'mt-1' : 'hidden'}`}
                        >
                            {project && !hideProjectName && (
                                <div className="flex items-center">
                                    <FolderIcon className="h-3 w-3 mr-1" />
                                    <Link
                                        to={
                                            project.uid
                                                ? `/project/${project.uid}-${project.name
                                                      .toLowerCase()
                                                      .replace(
                                                          /[^a-z0-9]+/g,
                                                          '-'
                                                      )
                                                      .replace(/^-|-$/g, '')}`
                                                : `/project/${project.id}`
                                        }
                                        className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                        onClick={(e) => {
                                            // Prevent navigation if we're already on this project's page
                                            if (
                                                window.location.pathname ===
                                                `/project/${project.id}`
                                            ) {
                                                e.preventDefault();
                                            }
                                            e.stopPropagation();
                                        }}
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
                                                    to={
                                                        tag.uid
                                                            ? `/tag/${tag.uid}-${tag.name
                                                                  .toLowerCase()
                                                                  .replace(
                                                                      /[^a-z0-9]+/g,
                                                                      '-'
                                                                  )
                                                                  .replace(
                                                                      /^-|-$/g,
                                                                      ''
                                                                  )}`
                                                            : `/tag/${tag.name
                                                                  .toLowerCase()
                                                                  .replace(
                                                                      /[^a-z0-9]+/g,
                                                                      '-'
                                                                  )
                                                                  .replace(
                                                                      /^-|-$/g,
                                                                      ''
                                                                  )}`
                                                    }
                                                    className="text-gray-500 dark:text-gray-400 hover:underline transition-colors"
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
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
                            {!isUpcomingView && task.due_date && (
                                <div className="flex items-center whitespace-nowrap">
                                    <CalendarIcon className="h-3 w-3 mr-1" />
                                    <span>{formatDueDate(task.due_date)}</span>
                                </div>
                            )}
                            {isTaskCompleted(task.status) &&
                                task.completed_at && (
                                    <div className="flex items-center whitespace-nowrap">
                                        <CheckIcon className="h-3 w-3 mr-1" />
                                        <span>
                                            {formatDueDate(
                                                task.completed_at.split('T')[0]
                                            )}
                                        </span>
                                    </div>
                                )}
                            {task.recurrence_type &&
                                task.recurrence_type !== 'none' && (
                                    <div
                                        className="flex items-center"
                                        title={
                                            task.due_date
                                                ? `${t('next', 'Next')}: ${formatDueDate(task.due_date)}`
                                                : undefined
                                        }
                                    >
                                        <ArrowPathIcon className="h-3 w-3 mr-1" />
                                        <span>
                                            {formatRecurrence(
                                                task.recurrence_type
                                            )}
                                        </span>
                                    </div>
                                )}
                            {task.recurring_parent_id && (
                                <div className="flex items-center">
                                    <ArrowPathIcon className="h-3 w-3 mr-1" />
                                    <span>
                                        {t(
                                            'recurrence.instance',
                                            'Recurring task instance'
                                        )}
                                    </span>
                                </div>
                            )}
                            {formattedDeferUntil && (
                                <div className="flex items-center whitespace-nowrap">
                                    <CalendarDaysIcon className="h-3 w-3 mr-1" />
                                    <span>{formattedDeferUntil}</span>
                                </div>
                            )}
                        </div>

                        {onToggleCompletion && (
                            <div className="mt-2">
                                <TaskStatusControl
                                    task={task}
                                    onToggleCompletion={onToggleCompletion}
                                    onTaskUpdate={onTaskUpdate}
                                    hoverRevealQuickActions={false}
                                    showMobileVariant={false}
                                />
                            </div>
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
                            className={`rounded-lg shadow-sm bg-white dark:bg-gray-900 border cursor-pointer transition-all duration-200 ${
                                isTaskInProgress(subtask.status)
                                    ? 'border-blue-500/60 dark:border-blue-600/60'
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
                                        className={`text-sm truncate min-w-0 ${
                                            isTaskCompleted(subtask.status)
                                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {subtask.original_name || subtask.name}
                                    </span>
                                </div>

                                {/* Right side - Status indicator */}
                                <div className="flex items-center space-x-1">
                                    {isTaskCompleted(subtask.status) ? (
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

    const loadSubtasks = useCallback(async () => {
        if (!props.task.uid) return;

        setLoadingSubtasks(true);
        try {
            const subtasksData = await fetchSubtasks(props.task.uid);
            setSubtasks(subtasksData);
            setShowSubtasks(subtasksData.length > 0);
        } catch (error) {
            console.error('Failed to load subtasks:', error);
            setSubtasks([]);
            setShowSubtasks(false);
        } finally {
            setLoadingSubtasks(false);
        }
    }, [props.task.id]);

    useEffect(() => {
        const subtasksData = props.task.subtasks || [];
        const hasSubtasksFromData = subtasksData.length > 0;
        setSubtasks(subtasksData);
        setShowSubtasks(hasSubtasksFromData);

        if (!hasSubtasksFromData) {
            void loadSubtasks();
        }
    }, [props.task.id, props.task.subtasks, loadSubtasks]);

    return (
        <>
            <TaskHeader
                {...props}
                showSubtasks={showSubtasks}
                hasSubtasks={subtasks.length > 0 || loadingSubtasks}
                onSubtasksToggle={(e) => {
                    e.stopPropagation();
                    setShowSubtasks((prev) => !prev);
                }}
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
export default React.memo(TaskHeader);
