import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarDaysIcon,
    CalendarIcon,
    ArrowPathIcon,
    ChevronDownIcon,
    PlayIcon,
    PauseCircleIcon,
    CheckIcon,
    ClockIcon,
    XCircleIcon,
} from '@heroicons/react/24/outline';
import { TagIcon, FolderIcon, FireIcon } from '@heroicons/react/24/solid';
import { useTranslation } from 'react-i18next';
import TaskPriorityIcon from './TaskPriorityIcon';
import { Project } from '../../entities/Project';
import { Task, StatusType } from '../../entities/Task';
import { fetchSubtasks } from '../../utils/tasksService';
import {
    isTaskInProgress,
    isTaskNotStarted,
    isTaskCompleted,
    getStatusString,
} from '../../constants/taskStatus';
import {
    getStatusBorderColorClasses,
    getStatusButtonColorClasses,
} from './statusStyles';

type StatusDropdownOption = {
    value: StatusType;
    label: string;
    displayLabel: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    activeClasses: string;
    inactiveClasses: string;
    activeIconClass: string;
    inactiveIconClass: string;
    completion?: boolean;
    hidden?: boolean;
};

interface TaskHeaderProps {
    task: Task;
    project?: Project;
    onTaskClick: (e: React.MouseEvent) => void;
    onToggleCompletion?: () => void;
    hideProjectName?: boolean;
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    onTaskUpdate?: (task: Task) => Promise<void>;
    isOverdue?: boolean;
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
    // Props for edit and delete functionality
    onEdit: _onEdit,
    onDelete: _onDelete,
    isUpcomingView = false,
}) => {
    const { t } = useTranslation();
    void _onToggleToday;
    void _onEdit;
    void _onDelete;
    const desktopCompletionMenuRef = useRef<HTMLDivElement>(null);
    const mobileCompletionMenuRef = useRef<HTMLDivElement>(null);
    const [completionMenuOpen, setCompletionMenuOpen] = useState<
        'desktop' | 'mobile' | null
    >(null);
    const [isCompletingTask, setIsCompletingTask] = useState(false);

    useEffect(() => {
        if (!completionMenuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const activeRef =
                completionMenuOpen === 'desktop'
                    ? desktopCompletionMenuRef.current
                    : mobileCompletionMenuRef.current;

            if (activeRef && activeRef.contains(target)) {
                return;
            }

            setCompletionMenuOpen(null);
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [completionMenuOpen]);

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

    // Check if task has metadata (project, tags, due_date, recurrence_type, recurring_parent_id, or defer_until)
    const hasMetadata =
        (project && !hideProjectName) ||
        (task.tags && task.tags.length > 0) ||
        task.due_date ||
        (task.recurrence_type && task.recurrence_type !== 'none') ||
        task.recurring_parent_id ||
        !!formattedDeferUntil;

    const taskCompleted = isTaskCompleted(task.status);

    const taskInProgress = isTaskInProgress(task.status);
    const currentStatusString = getStatusString(task.status);

    const completionButtonTextClass = taskCompleted
        ? 'text-green-600 dark:text-green-400'
        : taskInProgress
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400';

    const completionButtonHoverClass = taskCompleted
        ? 'hover:bg-green-50 dark:hover:bg-green-900/40'
        : taskInProgress
          ? 'hover:bg-blue-50 dark:hover:bg-blue-900/40'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800';

    // Highlighted background for the active status button part
    const completionButtonMainBgClass = taskCompleted
        ? 'bg-green-100 dark:bg-green-900/50'
        : taskInProgress
          ? 'bg-blue-100 dark:bg-blue-900/50'
          : 'bg-gray-200 dark:bg-gray-700';

    const completionButtonMainTextClass = taskCompleted
        ? 'text-green-900 dark:text-green-100 font-semibold'
        : taskInProgress
          ? 'text-blue-900 dark:text-blue-100 font-semibold'
          : 'text-gray-900 dark:text-gray-100 font-semibold';

    const completionButtonMainClasses = `inline-flex items-center gap-2 text-sm transition ${completionButtonMainTextClass} ${completionButtonMainBgClass} ${completionButtonHoverClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`;

    const completionButtonChevronClasses = `inline-flex items-center justify-center transition ${completionButtonTextClass} ${completionButtonHoverClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`;

    const statusButtonColorClasses = getStatusButtonColorClasses(task.status);
    const statusBorderColorClass = getStatusBorderColorClasses(task.status);

    const handleCompletionClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCompletionMenuOpen(null);

        if (onToggleCompletion) {
            // Add animation delay when marking as done (not when undoing)
            if (!taskCompleted) {
                setIsCompletingTask(true);
                // Wait for green animation to complete (1200ms)
                await new Promise((resolve) => setTimeout(resolve, 1200));
            }

            onToggleCompletion();

            // Reset animation state after completion
            setTimeout(() => {
                setIsCompletingTask(false);
            }, 100);
        }
    };

    const statusMenuOptions: StatusDropdownOption[] = [
        {
            value: 'not_started',
            label: t('task.status.notStarted', 'Not started'),
            displayLabel: t('task.status.notStarted', 'Not started'),
            Icon: PauseCircleIcon,
            activeClasses:
                'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold border-l-2 border-gray-500 dark:border-gray-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-gray-600 dark:text-gray-300',
            inactiveIconClass: 'text-gray-500 dark:text-gray-400',
        },
        {
            value: 'planned',
            label: t('task.status.planned', 'Planned'),
            displayLabel: t('task.status.planned', 'Planned'),
            Icon: CalendarIcon,
            activeClasses:
                'bg-purple-100 dark:bg-purple-900/50 text-purple-900 dark:text-purple-100 font-semibold border-l-2 border-purple-500 dark:border-purple-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-purple-600 dark:text-purple-300',
            inactiveIconClass: 'text-purple-500 dark:text-purple-400',
        },
        {
            value: 'in_progress',
            label: t('task.status.inProgress', 'In progress'),
            displayLabel: t('task.status.inProgress', 'In progress'),
            Icon: PlayIcon,
            activeClasses:
                'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 font-semibold border-l-2 border-blue-500 dark:border-blue-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-blue-600 dark:text-blue-300',
            inactiveIconClass: 'text-blue-500 dark:text-blue-400',
        },
        {
            value: 'waiting',
            label: t('task.status.waiting', 'Waiting'),
            displayLabel: t('task.status.waiting', 'Waiting'),
            Icon: ClockIcon,
            activeClasses:
                'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 font-semibold border-l-2 border-yellow-500 dark:border-yellow-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-yellow-600 dark:text-yellow-300',
            inactiveIconClass: 'text-yellow-500 dark:text-yellow-400',
        },
        {
            value: 'cancelled',
            label: t('task.status.cancelled', 'Cancelled'),
            displayLabel: t('task.status.cancelled', 'Cancelled'),
            Icon: XCircleIcon,
            activeClasses:
                'bg-red-100 dark:bg-red-900/50 text-red-900 dark:text-red-100 font-semibold border-l-2 border-red-500 dark:border-red-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-red-600 dark:text-red-300',
            inactiveIconClass: 'text-red-500 dark:text-red-400',
        },
        {
            value: 'done',
            label: t('task.status.setAsDone', 'Set as done'),
            displayLabel: t('task.status.done', 'Done'),
            Icon: CheckIcon,
            activeClasses:
                'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-100 font-semibold border-l-2 border-green-500 dark:border-green-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-green-600 dark:text-green-300',
            inactiveIconClass: 'text-green-500 dark:text-green-400',
            completion: true,
        },
        {
            value: 'archived',
            label: t('task.status.archived', 'Archived'),
            displayLabel: t('task.status.archived', 'Archived'),
            Icon: CheckIcon,
            activeClasses:
                'bg-gray-100 dark:bg-gray-900/50 text-gray-900 dark:text-gray-100 font-semibold border-l-2 border-gray-500 dark:border-gray-400',
            inactiveClasses:
                'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800',
            activeIconClass: 'text-gray-600 dark:text-gray-300',
            inactiveIconClass: 'text-gray-500 dark:text-gray-400',
            hidden: true,
        },
    ];

    const currentStatusOption = statusMenuOptions.find(
        (option) => option.value === currentStatusString
    );
    const CompletionIcon = currentStatusOption?.Icon ?? PauseCircleIcon;
    const completionButtonLabel =
        currentStatusOption?.displayLabel ||
        t('task.status.notStarted', 'Not started');
    const visibleStatusOptions = statusMenuOptions.filter(
        (option) => !option.hidden
    );

    const handleStatusSelection = async (
        e: React.MouseEvent,
        statusValue: StatusType
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setCompletionMenuOpen(null);
        if (onTaskUpdate && task.id) {
            const updatedTask = {
                ...task,
                status: statusValue,
            };
            await onTaskUpdate(updatedTask);
        }
    };

    const renderStatusMenuOptions = (menuType: 'desktop' | 'mobile') => {
        const lastIndex = visibleStatusOptions.length - 1;
        return visibleStatusOptions.map((option, index) => {
            const Icon = option.Icon;
            const isActive = currentStatusString === option.value;
            const roundedClass =
                index === 0
                    ? 'rounded-t-lg'
                    : index === lastIndex
                      ? 'rounded-b-lg'
                      : '';
            const iconClass = isActive
                ? option.activeIconClass
                : option.inactiveIconClass;
            const stateClasses = isActive
                ? option.activeClasses
                : option.inactiveClasses;

            return (
                <button
                    key={`${menuType}-${option.value}`}
                    type="button"
                    onClick={async (event) => {
                        if (option.completion) {
                            await handleCompletionClick(event);
                        } else {
                            await handleStatusSelection(event, option.value);
                        }
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${roundedClass} ${stateClasses}`}
                    disabled={option.completion ? isCompletingTask : false}
                >
                    <Icon className={`h-4 w-4 ${iconClass}`} />
                    <span className="flex-1">{option.label}</span>
                </button>
            );
        });
    };

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
            <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between">
                <div className="flex items-center space-x-3 mb-2 md:mb-0 w-full">
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
                            <div className="w-full">
                                {/* Full width title that wraps */}
                                <div className="w-full mb-0.5">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-300 break-words tracking-tight inline-flex items-center gap-1.5">
                                        {task.habit_mode && (
                                            <FireIcon
                                                className="h-4 w-4 text-orange-500 flex-shrink-0"
                                                title="Habit"
                                            />
                                        )}
                                        {task.original_name || task.name}
                                    </span>
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
                            <div className="flex items-center gap-1.5">
                                {task.habit_mode && (
                                    <FireIcon
                                        className="h-4 w-4 text-orange-500 flex-shrink-0"
                                        title="Habit"
                                    />
                                )}
                                <span className="text-md font-medium text-gray-900 dark:text-gray-300">
                                    {task.original_name || task.name}
                                </span>
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
                {!isUpcomingView && !task.habit_mode && (
                    <div className="flex items-center w-full">
                        {onToggleCompletion && (
                            <div className="relative ml-auto" ref={desktopCompletionMenuRef}>
                                <div
                                    className={`inline-flex items-stretch rounded-full border ${statusBorderColorClass} overflow-hidden`}
                                >
                                    <button
                                        type="button"
                                        onClick={
                                            taskInProgress ||
                                            (!taskCompleted &&
                                                (task.status ===
                                                    'not_started' ||
                                                    isTaskNotStarted(task.status)))
                                                ? (e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                  }
                                                : handleCompletionClick
                                        }
                                        className={`${completionButtonMainClasses} px-3 py-1 ${statusButtonColorClasses}`}
                                        title={
                                            taskCompleted
                                                ? t('common.undo', 'Undo')
                                                : taskInProgress
                                                  ? t(
                                                        'tasks.inProgress',
                                                        'In Progress'
                                                    )
                                                  : t(
                                                        'tasks.notStarted',
                                                        'Not Started'
                                                    )
                                        }
                                    >
                                        <CompletionIcon className="h-4 w-4" />
                                        {completionButtonLabel}
                                    </button>
                                    {taskInProgress && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleCompletionClick(e);
                                            }}
                                            className={`${isCompletingTask ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' : completionButtonChevronClasses} px-2 border-l ${statusBorderColorClass} transition-all duration-300`}
                                            title={t(
                                                'tasks.markAsDone',
                                                'Mark as done'
                                            )}
                                            disabled={isCompletingTask}
                                        >
                                            <CheckIcon
                                                className={`h-4 w-4 transition-all duration-300 ${isCompletingTask ? 'scale-125 text-green-600 dark:text-green-400' : ''}`}
                                            />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setCompletionMenuOpen((prev) =>
                                                prev === 'desktop'
                                                    ? null
                                                    : 'desktop'
                                            );
                                        }}
                                        className={`${completionButtonChevronClasses} px-2 border-l ${statusBorderColorClass}`}
                                        aria-haspopup="menu"
                                        aria-expanded={
                                            completionMenuOpen === 'desktop'
                                        }
                                    >
                                        <ChevronDownIcon className="h-4 w-4" />
                                    </button>
                                </div>
                                {completionMenuOpen === 'desktop' && (
                                    <div className={`absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border ${statusBorderColorClass} rounded-lg shadow-lg z-[9999]`}>
                                        {renderStatusMenuOptions('desktop')}
                                    </div>
                                )}
                            </div>
                        )}
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
                            <span className="break-words inline-flex items-center gap-1.5">
                                {task.habit_mode && (
                                    <FireIcon
                                        className="h-4 w-4 text-orange-500 flex-shrink-0"
                                        title="Habit"
                                    />
                                )}
                                {task.original_name || task.name}
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
                            <div
                                className="mt-2 relative"
                                ref={mobileCompletionMenuRef}
                            >
                                <div
                                    className={`inline-flex items-stretch rounded-full border ${statusBorderColorClass} overflow-hidden text-xs`}
                                >
                                    <button
                                        type="button"
                                        onClick={
                                            taskInProgress ||
                                            (!taskCompleted &&
                                                (task.status ===
                                                    'not_started' ||
                                                    isTaskNotStarted(task.status)))
                                                ? (e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                  }
                                                : handleCompletionClick
                                        }
                                        className={`${completionButtonMainClasses} px-2 py-1 ${statusButtonColorClasses}`}
                                    >
                                        <CompletionIcon className="h-3.5 w-3.5" />
                                        <span className="ml-1">
                                            {completionButtonLabel}
                                        </span>
                                    </button>
                                    {taskInProgress && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleCompletionClick(e);
                                            }}
                                            className={`${isCompletingTask ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' : completionButtonChevronClasses} px-2 border-l ${statusBorderColorClass} transition-all duration-300`}
                                            title={t(
                                                'tasks.markAsDone',
                                                'Mark as done'
                                            )}
                                            disabled={isCompletingTask}
                                        >
                                            <CheckIcon
                                                className={`h-3.5 w-3.5 transition-all duration-300 ${isCompletingTask ? 'scale-125 text-green-600 dark:text-green-400' : ''}`}
                                            />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setCompletionMenuOpen((prev) =>
                                                prev === 'mobile'
                                                    ? null
                                                    : 'mobile'
                                            );
                                        }}
                                        className={`${completionButtonChevronClasses} px-2 border-l ${statusBorderColorClass}`}
                                        aria-haspopup="menu"
                                        aria-expanded={
                                            completionMenuOpen === 'mobile'
                                        }
                                    >
                                        <ChevronDownIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {completionMenuOpen === 'mobile' && (
                                    <div className={`absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border ${statusBorderColorClass} rounded-lg shadow-lg z-[9999]`}>
                                        {renderStatusMenuOptions('mobile')}
                                    </div>
                                )}
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
                                        className={`text-sm flex-1 truncate ${
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
        if (!props.task.id) return;

        setLoadingSubtasks(true);
        try {
            const subtasksData = await fetchSubtasks(props.task.id);
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
        const subtasksData =
            props.task.subtasks || props.task.Subtasks || [];
        const hasSubtasksFromData = subtasksData.length > 0;
        setSubtasks(subtasksData);
        setShowSubtasks(hasSubtasksFromData);

        if (!hasSubtasksFromData) {
            void loadSubtasks();
        }
    }, [props.task.id, props.task.subtasks, props.task.Subtasks, loadSubtasks]);

    return (
        <>
            <TaskHeader {...props} />
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
