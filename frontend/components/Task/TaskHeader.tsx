import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    CalendarDaysIcon,
    CalendarIcon,
    ArrowPathIcon,
    ListBulletIcon,
    PencilIcon,
    TrashIcon,
    EllipsisVerticalIcon,
    ChevronDownIcon,
    PlayIcon,
    PauseCircleIcon,
    CheckIcon,
} from '@heroicons/react/24/outline';
import { TagIcon, FolderIcon, FireIcon } from '@heroicons/react/24/solid';
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
    onToggleToday?: (taskId: number, task?: Task) => Promise<void>;
    onTaskUpdate?: (task: Task) => Promise<void>;
    isOverdue?: boolean;
    // Props for subtasks functionality
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
    onToggleToday,
    onTaskUpdate,
    // Props for subtasks functionality
    showSubtasks,
    hasSubtasks,
    onSubtasksToggle,
    // Props for edit and delete functionality
    onEdit,
    onDelete,
    isUpcomingView = false,
}) => {
    const { t } = useTranslation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownId = useRef(
        `dropdown-${Math.random().toString(36).substr(2, 9)}`
    ).current;
    const desktopCompletionMenuRef = useRef<HTMLDivElement>(null);
    const mobileCompletionMenuRef = useRef<HTMLDivElement>(null);
    const [completionMenuOpen, setCompletionMenuOpen] = useState<
        'desktop' | 'mobile' | null
    >(null);
    const [isCompletingTask, setIsCompletingTask] = useState(false);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isDropdownOpen && buttonRef.current) {
                const target = event.target as Node;
                const isOutsideButton = !buttonRef.current.contains(target);
                const currentDropdown = document.querySelector(
                    `[data-dropdown-id="${dropdownId}"]`
                );
                const isOutsideDropdown = !currentDropdown?.contains(target);

                if (isOutsideButton && isOutsideDropdown) {
                    setIsDropdownOpen(false);
                }
            }
        };

        // Listen for custom event to close this dropdown when another opens
        const handleCloseOtherDropdowns = (event: CustomEvent) => {
            if (event.detail.dropdownId !== dropdownId && isDropdownOpen) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener(
                'closeOtherDropdowns',
                handleCloseOtherDropdowns as EventListener
            );
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener(
                'closeOtherDropdowns',
                handleCloseOtherDropdowns as EventListener
            );
        };
    }, [isDropdownOpen, dropdownId]);

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
                await onToggleToday(task.id, task);
            } catch (error) {
                console.error('Failed to toggle today status:', error);
            }
        }
    };

    // Check if task has metadata (project, tags, due_date, recurrence_type, or recurring_parent_id)
    const hasMetadata =
        (project && !hideProjectName) ||
        (task.tags && task.tags.length > 0) ||
        task.due_date ||
        (task.recurrence_type && task.recurrence_type !== 'none') ||
        task.recurring_parent_id;

    const isTaskCompleted =
        task.status === 'done' ||
        task.status === 2 ||
        task.status === 'archived' ||
        task.status === 3;

    const isTaskInProgress = task.status === 'in_progress' || task.status === 1;

    const completionButtonBorderClass = isTaskCompleted
        ? 'border-green-200 dark:border-green-900'
        : isTaskInProgress
          ? 'border-blue-200 dark:border-blue-900'
          : 'border-gray-200 dark:border-gray-700';

    const completionButtonTextClass = isTaskCompleted
        ? 'text-green-600 dark:text-green-400'
        : isTaskInProgress
          ? 'text-blue-600 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-400';

    const completionButtonHoverClass = isTaskCompleted
        ? 'hover:bg-green-50 dark:hover:bg-green-900/40'
        : isTaskInProgress
          ? 'hover:bg-blue-50 dark:hover:bg-blue-900/40'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800';

    // Highlighted background for the active status button part
    const completionButtonMainBgClass = isTaskCompleted
        ? 'bg-green-100 dark:bg-green-900/50'
        : isTaskInProgress
          ? 'bg-blue-100 dark:bg-blue-900/50'
          : 'bg-gray-200 dark:bg-gray-700';

    const completionButtonMainTextClass = isTaskCompleted
        ? 'text-green-900 dark:text-green-100 font-semibold'
        : isTaskInProgress
          ? 'text-blue-900 dark:text-blue-100 font-semibold'
          : 'text-gray-900 dark:text-gray-100 font-semibold';

    const completionButtonMainClasses = `inline-flex items-center gap-2 text-sm transition ${completionButtonMainTextClass} ${completionButtonMainBgClass} ${completionButtonHoverClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`;

    const completionButtonChevronClasses = `inline-flex items-center justify-center transition ${completionButtonTextClass} ${completionButtonHoverClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500`;

    const CompletionIcon = isTaskCompleted
        ? CheckIcon
        : isTaskInProgress
          ? PlayIcon
          : CheckIcon;

    const handleCompletionClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setCompletionMenuOpen(null);

        if (onToggleCompletion) {
            // Add animation delay when marking as done (not when undoing)
            if (!isTaskCompleted) {
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
                            </div>
                        )}
                    </div>
                </div>
                {!isUpcomingView && !task.habit_mode && (
                    <div className="flex items-center w-full">
                        <div className="flex items-center gap-2 ml-auto">
                            <div className="hidden group-hover:flex items-center space-x-1 transition-opacity duration-200 opacity-0 group-hover:opacity-100">
                                {/* Today Plan Controls */}
                                {onToggleToday && (
                                    <button
                                        type="button"
                                        onClick={handleTodayToggle}
                                        className={`items-center justify-center ${
                                            Number(task.today_move_count) > 1
                                                ? 'px-2 h-6'
                                                : 'w-6 h-6'
                                        } rounded-full transition-all duration-200 ${
                                            task.today
                                                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 opacity-100 flex'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 flex'
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

                                {/* Show Subtasks Controls */}
                                {hasSubtasks &&
                                    !(
                                        task.status === 'archived' ||
                                        task.status === 3
                                    ) && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                if (onSubtasksToggle) {
                                                    onSubtasksToggle(e);
                                                }
                                            }}
                                            className={`flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 ${
                                                showSubtasks
                                                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 opacity-100'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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

                                {/* Three Dots Menu for Edit and Delete */}
                                {(onEdit || onDelete) && (
                                    <div className="relative">
                                        <button
                                            ref={buttonRef}
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newOpenState =
                                                    !isDropdownOpen;

                                                // Close other dropdowns when opening this one
                                                if (newOpenState) {
                                                    document.dispatchEvent(
                                                        new CustomEvent(
                                                            'closeOtherDropdowns',
                                                            {
                                                                detail: {
                                                                    dropdownId,
                                                                },
                                                            }
                                                        )
                                                    );
                                                }

                                                setIsDropdownOpen(newOpenState);
                                            }}
                                            className="flex items-center justify-center w-6 h-6 rounded-full transition-all duration-200 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
                                            title={t(
                                                'common.more',
                                                'More options'
                                            )}
                                        >
                                            <EllipsisVerticalIcon className="h-4 w-4" />
                                        </button>

                                        {/* Dropdown Menu */}
                                        {isDropdownOpen && (
                                            <div
                                                data-dropdown-id={dropdownId}
                                                className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[9999]"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <div className="py-1">
                                                    {/* Edit Button */}
                                                    {onEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onEdit(e);
                                                                setIsDropdownOpen(
                                                                    false
                                                                );
                                                            }}
                                                            className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                                            data-testid={`task-edit-desktop-${task.id}`}
                                                        >
                                                            <PencilIcon className="h-4 w-4" />
                                                            {t(
                                                                'tasks.edit',
                                                                'Edit task'
                                                            )}
                                                        </button>
                                                    )}

                                                    {/* Delete Button */}
                                                    {onDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDelete(e);
                                                                setIsDropdownOpen(
                                                                    false
                                                                );
                                                            }}
                                                            className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                                                            data-testid={`task-delete-desktop-${task.id}`}
                                                        >
                                                            <TrashIcon className="h-4 w-4" />
                                                            {t(
                                                                'tasks.delete',
                                                                'Delete task'
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {onToggleCompletion && (
                                <div
                                    className={`relative transition-opacity duration-200 ${
                                        task.habit_mode
                                            ? 'opacity-0 group-hover:opacity-100'
                                            : isTaskInProgress
                                              ? 'opacity-100'
                                              : 'opacity-0 group-hover:opacity-100'
                                    }`}
                                    ref={desktopCompletionMenuRef}
                                >
                                    <div
                                        className={`inline-flex items-stretch rounded-full border ${completionButtonBorderClass} overflow-hidden`}
                                    >
                                        <button
                                            type="button"
                                            onClick={
                                                isTaskInProgress ||
                                                (!isTaskCompleted &&
                                                    (task.status ===
                                                        'not_started' ||
                                                        task.status === 0))
                                                    ? (e) => {
                                                          e.preventDefault();
                                                          e.stopPropagation();
                                                      }
                                                    : handleCompletionClick
                                            }
                                            className={`${completionButtonMainClasses} px-3 py-1`}
                                            title={
                                                isTaskCompleted
                                                    ? t('common.undo', 'Undo')
                                                    : isTaskInProgress
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
                                            {isTaskCompleted
                                                ? t('tasks.done', 'Done')
                                                : isTaskInProgress
                                                  ? t(
                                                        'tasks.inProgress',
                                                        'In Progress'
                                                    )
                                                  : t(
                                                        'tasks.notStarted',
                                                        'Not Started'
                                                    )}
                                        </button>
                                        {!isTaskCompleted &&
                                            (task.status === 'not_started' ||
                                                task.status === 0) && (
                                                <button
                                                    type="button"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (
                                                            onTaskUpdate &&
                                                            task.id
                                                        ) {
                                                            const updatedTask =
                                                                {
                                                                    ...task,
                                                                    status: 'in_progress' as StatusType,
                                                                    today: true,
                                                                };
                                                            await onTaskUpdate(
                                                                updatedTask
                                                            );
                                                        }
                                                    }}
                                                    className={`${completionButtonChevronClasses} px-2 border-l ${completionButtonBorderClass}`}
                                                    title={t(
                                                        'tasks.setInProgress',
                                                        'Set in progress'
                                                    )}
                                                >
                                                    <PlayIcon className="h-4 w-4" />
                                                </button>
                                            )}
                                        {isTaskInProgress && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleCompletionClick(e);
                                                }}
                                                className={`${isCompletingTask ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' : completionButtonChevronClasses} px-2 border-l ${completionButtonBorderClass} transition-all duration-300`}
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
                                            className={`${completionButtonChevronClasses} px-2 border-l ${completionButtonBorderClass}`}
                                            aria-haspopup="menu"
                                            aria-expanded={
                                                completionMenuOpen === 'desktop'
                                            }
                                        >
                                            <ChevronDownIcon className="h-4 w-4" />
                                        </button>
                                    </div>
                                    {completionMenuOpen === 'desktop' && (
                                        <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999]">
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setCompletionMenuOpen(null);
                                                    if (
                                                        onTaskUpdate &&
                                                        task.id
                                                    ) {
                                                        const updatedTask = {
                                                            ...task,
                                                            status: 'not_started' as StatusType,
                                                        };
                                                        await onTaskUpdate(
                                                            updatedTask
                                                        );
                                                    }
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm rounded-t-lg flex items-center gap-2 ${
                                                    task.status ===
                                                        'not_started' ||
                                                    task.status === 0
                                                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold border-l-2 border-gray-500 dark:border-gray-400'
                                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                <PauseCircleIcon
                                                    className={`h-4 w-4 ${task.status === 'not_started' || task.status === 0 ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}
                                                />
                                                <span className="flex-1">
                                                    {t(
                                                        'task.status.notStarted',
                                                        'Not started'
                                                    )}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setCompletionMenuOpen(null);
                                                    if (
                                                        onTaskUpdate &&
                                                        task.id
                                                    ) {
                                                        const updatedTask = {
                                                            ...task,
                                                            status: 'in_progress' as StatusType,
                                                            today: true, // Add to today when setting in progress
                                                        };
                                                        await onTaskUpdate(
                                                            updatedTask
                                                        );
                                                    }
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                                                    task.status ===
                                                        'in_progress' ||
                                                    task.status === 1
                                                        ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 font-semibold border-l-2 border-blue-500 dark:border-blue-400'
                                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }`}
                                            >
                                                <PlayIcon
                                                    className={`h-4 w-4 ${task.status === 'in_progress' || task.status === 1 ? 'text-blue-600 dark:text-blue-300' : 'text-blue-500 dark:text-blue-400'}`}
                                                />
                                                <span className="flex-1">
                                                    {t(
                                                        'task.status.inProgress',
                                                        'In progress'
                                                    )}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setCompletionMenuOpen(null);
                                                    if (onToggleCompletion) {
                                                        // Add animation delay
                                                        setIsCompletingTask(
                                                            true
                                                        );
                                                        await new Promise(
                                                            (resolve) =>
                                                                setTimeout(
                                                                    resolve,
                                                                    1200
                                                                )
                                                        );
                                                        onToggleCompletion();
                                                        setTimeout(() => {
                                                            setIsCompletingTask(
                                                                false
                                                            );
                                                        }, 100);
                                                    }
                                                }}
                                                className={`w-full px-3 py-2 text-left text-sm rounded-b-lg flex items-center gap-2 ${
                                                    task.status === 'done' ||
                                                    task.status === 2
                                                        ? 'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-100 font-semibold border-l-2 border-green-500 dark:border-green-400'
                                                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                }`}
                                                disabled={isCompletingTask}
                                            >
                                                <CheckIcon
                                                    className={`h-4 w-4 ${task.status === 'done' || task.status === 2 ? 'text-green-600 dark:text-green-300' : 'text-green-500 dark:text-green-400'}`}
                                                />
                                                <span className="flex-1">
                                                    {t(
                                                        'task.status.setAsDone',
                                                        'Set as done'
                                                    )}
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
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
                        </div>

                        {onToggleCompletion && (
                            <div
                                className="mt-2 relative"
                                ref={mobileCompletionMenuRef}
                            >
                                <div
                                    className={`inline-flex items-stretch rounded-full border ${completionButtonBorderClass} overflow-hidden text-xs`}
                                >
                                    <button
                                        type="button"
                                        onClick={
                                            isTaskInProgress ||
                                            (!isTaskCompleted &&
                                                (task.status ===
                                                    'not_started' ||
                                                    task.status === 0))
                                                ? (e) => {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                  }
                                                : handleCompletionClick
                                        }
                                        className={`${completionButtonMainClasses} px-2 py-1`}
                                    >
                                        <CompletionIcon className="h-3.5 w-3.5" />
                                        <span className="ml-1">
                                            {isTaskCompleted
                                                ? t('tasks.done', 'Done')
                                                : isTaskInProgress
                                                  ? t(
                                                        'tasks.inProgress',
                                                        'In Progress'
                                                    )
                                                  : t(
                                                        'tasks.notStarted',
                                                        'Not Started'
                                                    )}
                                        </span>
                                    </button>
                                    {!isTaskCompleted &&
                                        (task.status === 'not_started' ||
                                            task.status === 0) && (
                                            <button
                                                type="button"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (
                                                        onTaskUpdate &&
                                                        task.id
                                                    ) {
                                                        const updatedTask = {
                                                            ...task,
                                                            status: 'in_progress' as StatusType,
                                                            today: true,
                                                        };
                                                        await onTaskUpdate(
                                                            updatedTask
                                                        );
                                                    }
                                                }}
                                                className={`${completionButtonChevronClasses} px-2 border-l ${completionButtonBorderClass}`}
                                                title={t(
                                                    'tasks.setInProgress',
                                                    'Set in progress'
                                                )}
                                            >
                                                <PlayIcon className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    {isTaskInProgress && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleCompletionClick(e);
                                            }}
                                            className={`${isCompletingTask ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400' : completionButtonChevronClasses} px-2 border-l ${completionButtonBorderClass} transition-all duration-300`}
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
                                        className={`${completionButtonChevronClasses} px-2 border-l ${completionButtonBorderClass}`}
                                        aria-haspopup="menu"
                                        aria-expanded={
                                            completionMenuOpen === 'mobile'
                                        }
                                    >
                                        <ChevronDownIcon className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                {completionMenuOpen === 'mobile' && (
                                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[9999]">
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setCompletionMenuOpen(null);
                                                if (onTaskUpdate && task.id) {
                                                    const updatedTask = {
                                                        ...task,
                                                        status: 'not_started' as StatusType,
                                                    };
                                                    await onTaskUpdate(
                                                        updatedTask
                                                    );
                                                }
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm rounded-t-lg flex items-center gap-2 ${
                                                task.status === 'not_started' ||
                                                task.status === 0
                                                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-semibold border-l-2 border-gray-500 dark:border-gray-400'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <PauseCircleIcon
                                                className={`h-4 w-4 ${task.status === 'not_started' || task.status === 0 ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}
                                            />
                                            <span className="flex-1">
                                                {t(
                                                    'task.status.notStarted',
                                                    'Not started'
                                                )}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setCompletionMenuOpen(null);
                                                if (onTaskUpdate && task.id) {
                                                    const updatedTask = {
                                                        ...task,
                                                        status: 'in_progress' as StatusType,
                                                        today: true, // Add to today when setting in progress
                                                    };
                                                    await onTaskUpdate(
                                                        updatedTask
                                                    );
                                                }
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${
                                                task.status === 'in_progress' ||
                                                task.status === 1
                                                    ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100 font-semibold border-l-2 border-blue-500 dark:border-blue-400'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            <PlayIcon
                                                className={`h-4 w-4 ${task.status === 'in_progress' || task.status === 1 ? 'text-blue-600 dark:text-blue-300' : 'text-blue-500 dark:text-blue-400'}`}
                                            />
                                            <span className="flex-1">
                                                {t(
                                                    'task.status.inProgress',
                                                    'In progress'
                                                )}
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setCompletionMenuOpen(null);
                                                if (onToggleCompletion) {
                                                    // Add animation delay
                                                    setIsCompletingTask(true);
                                                    await new Promise(
                                                        (resolve) =>
                                                            setTimeout(
                                                                resolve,
                                                                1200
                                                            )
                                                    );
                                                    onToggleCompletion();
                                                    setTimeout(() => {
                                                        setIsCompletingTask(
                                                            false
                                                        );
                                                    }, 100);
                                                }
                                            }}
                                            className={`w-full px-3 py-2 text-left text-sm rounded-b-lg flex items-center gap-2 ${
                                                task.status === 'done' ||
                                                task.status === 2
                                                    ? 'bg-green-100 dark:bg-green-900/50 text-green-900 dark:text-green-100 font-semibold border-l-2 border-green-500 dark:border-green-400'
                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                            }`}
                                            disabled={isCompletingTask}
                                        >
                                            <CheckIcon
                                                className={`h-4 w-4 ${task.status === 'done' || task.status === 2 ? 'text-green-600 dark:text-green-300' : 'text-green-500 dark:text-green-400'}`}
                                            />
                                            <span className="flex-1">
                                                {t(
                                                    'task.status.setAsDone',
                                                    'Set as done'
                                                )}
                                            </span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile 3-dot dropdown menu */}
                    {!task.habit_mode && (
                        <div className="flex items-center ml-2 relative">
                            <button
                                ref={buttonRef}
                                type="button"
                                data-dropdown-button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newOpenState = !isDropdownOpen;

                                    // Close other dropdowns when opening this one
                                    if (newOpenState) {
                                        document.dispatchEvent(
                                            new CustomEvent(
                                                'closeOtherDropdowns',
                                                {
                                                    detail: { dropdownId },
                                                }
                                            )
                                        );
                                    }

                                    setIsDropdownOpen(newOpenState);
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <EllipsisVerticalIcon className="h-5 w-5" />
                            </button>

                            {/* Dropdown Menu - Positioned Relatively */}
                            {isDropdownOpen && (
                                <div
                                    data-dropdown-id={dropdownId}
                                    className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] transform-gpu"
                                    style={{
                                        // Prevent dropdown from being cut off at the bottom of viewport
                                        transform:
                                            buttonRef.current &&
                                            buttonRef.current.getBoundingClientRect()
                                                .bottom +
                                                200 >
                                                window.innerHeight
                                                ? 'translateY(-100%) translateY(-8px)'
                                                : 'none',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="py-1">
                                        {/* Today Plan Controls */}
                                        {onToggleToday && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTodayToggle(e);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
                                            >
                                                <span>
                                                    {task.today
                                                        ? t(
                                                              'tasks.removeFromToday',
                                                              'Remove from today plan'
                                                          )
                                                        : t(
                                                              'tasks.addToToday',
                                                              'Add to today plan'
                                                          )}
                                                </span>
                                                {Number(task.today_move_count) >
                                                    1 && (
                                                    <span className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                                                        {Number(
                                                            task.today_move_count
                                                        )}
                                                    </span>
                                                )}
                                            </button>
                                        )}

                                        {/* Show Subtasks Controls */}
                                        {hasSubtasks &&
                                            !(
                                                task.status === 'archived' ||
                                                task.status === 3
                                            ) && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onSubtasksToggle) {
                                                            onSubtasksToggle(e);
                                                        }
                                                        setIsDropdownOpen(
                                                            false
                                                        );
                                                    }}
                                                    className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                >
                                                    {showSubtasks
                                                        ? t(
                                                              'tasks.hideSubtasks',
                                                              'Hide subtasks'
                                                          )
                                                        : t(
                                                              'tasks.showSubtasks',
                                                              'Show subtasks'
                                                          )}
                                                </button>
                                            )}

                                        {/* Edit Button */}
                                        {onEdit && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEdit(e);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="w-full px-4 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                                data-testid={`task-edit-mobile-${task.id}`}
                                            >
                                                {t('tasks.edit', 'Edit task')}
                                            </button>
                                        )}

                                        {/* Delete Button */}
                                        {onDelete && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDelete(e);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className="w-full px-4 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                data-testid={`task-delete-mobile-${task.id}`}
                                            >
                                                {t(
                                                    'tasks.delete',
                                                    'Delete task'
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
                                subtask.status === 'in_progress' ||
                                subtask.status === 1
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
                                            subtask.status === 'done' ||
                                            subtask.status === 2 ||
                                            subtask.status === 'archived' ||
                                            subtask.status === 3
                                                ? 'text-gray-500 dark:text-gray-400 line-through'
                                                : 'text-gray-900 dark:text-gray-100'
                                        }`}
                                    >
                                        {subtask.original_name || subtask.name}
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
export default React.memo(TaskHeader);
