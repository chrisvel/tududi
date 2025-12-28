import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckIcon,
    XMarkIcon,
    FolderIcon,
    TagIcon,
    ChevronDownIcon,
    ExclamationTriangleIcon,
    FireIcon,
    ArrowUpIcon,
    ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { Task, PriorityType } from '../../../entities/Task';
import { formatDateTime } from '../../../utils/dateUtils';
import TaskStatusControl from '../TaskStatusControl';
import { getStatusValue } from '../../../constants/taskStatus';

interface TaskDetailsHeaderProps {
    task: Task;
    onTitleUpdate: (newTitle: string) => Promise<void>;
    onStatusUpdate: (newStatus: number) => Promise<void>;
    onPriorityUpdate: (newPriority: PriorityType) => Promise<void>;
    onDelete: () => void;
    getProjectLink?: (project: any) => string;
    getTagLink?: (tag: any) => string;
    activePill: string;
    onPillChange: (pill: string) => void;
    showOverdueIcon?: boolean;
    showPastDueBadge?: boolean;
    onOverdueIconClick?: () => void;
    isOverdueAlertVisible?: boolean;
    onDismissOverdueAlert?: () => void;
    onQuickStatusToggle?: () => void;
    attachmentCount?: number;
    subtasksCount?: number;
}

const TaskDetailsHeader: React.FC<TaskDetailsHeaderProps> = ({
    task,
    onTitleUpdate,
    onStatusUpdate,
    onPriorityUpdate,
    onDelete,
    getProjectLink,
    getTagLink,
    activePill,
    onPillChange,
    showOverdueIcon = false,
    showPastDueBadge = false,
    onOverdueIconClick,
    isOverdueAlertVisible = false,
    onDismissOverdueAlert,
    onQuickStatusToggle,
    attachmentCount = 0,
    subtasksCount = 0,
}) => {
    const { t } = useTranslation();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.name);
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const priorityDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setEditedTitle(task.name);
    }, [task.name]);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditingTitle]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                actionsMenuOpen &&
                actionsMenuRef.current &&
                !actionsMenuRef.current.contains(e.target as Node)
            ) {
                setActionsMenuOpen(false);
            }
            if (
                priorityDropdownOpen &&
                priorityDropdownRef.current &&
                !priorityDropdownRef.current.contains(e.target as Node)
            ) {
                setPriorityDropdownOpen(false);
            }
        };

        if (actionsMenuOpen || priorityDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [actionsMenuOpen, priorityDropdownOpen]);

    const handleStartTitleEdit = () => {
        setIsEditingTitle(true);
    };

    const handleSaveTitle = async () => {
        if (editedTitle.trim() && editedTitle !== task.name) {
            await onTitleUpdate(editedTitle.trim());
        }
        setIsEditingTitle(false);
    };

    const handleCancelTitleEdit = () => {
        setEditedTitle(task.name);
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveTitle();
        } else if (e.key === 'Escape') {
            handleCancelTitleEdit();
        }
    };

    const handleStatusControlUpdate = async (updatedTask: Task) => {
        const currentStatusValue = getStatusValue(task.status);
        const nextStatusValue = getStatusValue(updatedTask.status);

        if (currentStatusValue !== nextStatusValue) {
            await onStatusUpdate(nextStatusValue);
        }
    };

    const getPriorityLabel = (priorityOverride?: PriorityType) => {
        const priority =
            typeof priorityOverride !== 'undefined'
                ? priorityOverride
                : task.priority;

        if (priority === 'low' || priority === 0) {
            return t('priority.low', 'Low');
        } else if (priority === 'medium' || priority === 1) {
            return t('priority.medium', 'Medium');
        } else if (priority === 'high' || priority === 2) {
            return t('priority.high', 'High');
        }
        return t('priority.none', 'None');
    };

    const getPriorityButtonClass = () => {
        const priority = task.priority;

        if (priority === null || priority === undefined) {
            return 'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 sm:gap-2 sm:ml-1 border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60';
        }

        const baseClass =
            'px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 sm:gap-2 sm:ml-1 border';

        if (priority === 'low' || priority === 0) {
            return `${baseClass} border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30`;
        } else if (priority === 'medium' || priority === 1) {
            return `${baseClass} border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30`;
        } else if (priority === 'high' || priority === 2) {
            return `${baseClass} border-red-500 text-red-600 dark:border-red-400 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30`;
        }
        return `${baseClass} border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60`;
    };

    const handlePriorityChange = async (newPriority: PriorityType) => {
        setPriorityDropdownOpen(false);
        await onPriorityUpdate(newPriority);
    };

    const getPriorityIcon = (
        priorityOverride?: PriorityType
    ): React.ElementType => {
        const priority =
            typeof priorityOverride !== 'undefined'
                ? priorityOverride
                : task.priority;

        if (priority === 'low' || priority === 0) {
            return ArrowDownIcon;
        } else if (priority === 'medium' || priority === 1) {
            return ArrowUpIcon;
        } else if (priority === 'high' || priority === 2) {
            return FireIcon;
        }
        return XMarkIcon;
    };

    const getPriorityIconClass = (priorityOverride?: PriorityType) => {
        const priority =
            typeof priorityOverride !== 'undefined'
                ? priorityOverride
                : task.priority;

        if (priority === 'low' || priority === 0) {
            return 'text-blue-500 dark:text-blue-400';
        } else if (priority === 'medium' || priority === 1) {
            return 'text-yellow-500 dark:text-yellow-400';
        } else if (priority === 'high' || priority === 2) {
            return 'text-red-500 dark:text-red-400';
        }
        return 'text-gray-500 dark:text-gray-400';
    };

    const formattedUpdatedAt = task.updated_at
        ? formatDateTime(new Date(task.updated_at))
        : null;

    return (
        <div className="mb-6">
            <div className="rounded-lg shadow-sm bg-white dark:bg-gray-900 border-2 border-gray-50 dark:border-gray-800 px-6 py-5">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        {isEditingTitle ? (
                            <div className="flex items-center space-x-2">
                                <input
                                    ref={titleInputRef}
                                    type="text"
                                    value={editedTitle}
                                    onChange={(e) =>
                                        setEditedTitle(e.target.value)
                                    }
                                    onKeyDown={handleTitleKeyDown}
                                    onBlur={handleSaveTitle}
                                    className="text-2xl font-normal text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 border-2 border-blue-500 dark:border-blue-400 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                                    placeholder={t(
                                        'task.titlePlaceholder',
                                        'Enter task title'
                                    )}
                                />
                                <button
                                    onClick={handleSaveTitle}
                                    className="p-1.5 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 rounded-full transition-colors duration-200"
                                    title={t('common.save', 'Save')}
                                >
                                    <CheckIcon className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={handleCancelTitleEdit}
                                    className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 rounded-full transition-colors duration-200"
                                    title={t('common.cancel', 'Cancel')}
                                >
                                    <XMarkIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-3 flex-wrap min-w-0">
                                    <h2
                                        onClick={handleStartTitleEdit}
                                        className="text-2xl font-normal text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 transition-colors truncate min-w-0"
                                        title={t(
                                            'task.clickToEditTitle',
                                            'Click to edit title'
                                        )}
                                    >
                                        {task.name}
                                    </h2>

                                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                                        <TaskStatusControl
                                            task={task}
                                            onToggleCompletion={
                                                onQuickStatusToggle
                                            }
                                            onTaskUpdate={
                                                handleStatusControlUpdate
                                            }
                                            hoverRevealQuickActions={false}
                                            showMobileVariant={false}
                                            variant="square"
                                            className="flex-shrink-0"
                                        />

                                        {/* Priority Dropdown Button - Next to status */}
                                        <div
                                            className="relative flex-shrink-0"
                                            ref={priorityDropdownRef}
                                        >
                                            <button
                                                className={getPriorityButtonClass()}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setPriorityDropdownOpen(
                                                        !priorityDropdownOpen
                                                    );
                                                }}
                                                aria-haspopup="true"
                                                aria-expanded={
                                                    priorityDropdownOpen
                                                }
                                            >
                                                {React.createElement(
                                                    getPriorityIcon(),
                                                    {
                                                        className: `h-4 w-4 ${getPriorityIconClass()}`,
                                                    }
                                                )}
                                                <span className="capitalize hidden sm:inline">
                                                    {getPriorityLabel()}
                                                </span>
                                                <ChevronDownIcon className="h-4 w-4" />
                                            </button>
                                            {priorityDropdownOpen && (
                                                <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-20">
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm rounded-t-lg flex items-center gap-2 ${
                                                            task.priority ===
                                                                null ||
                                                            task.priority ===
                                                                undefined
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                null
                                                            );
                                                        }}
                                                    >
                                                        <XMarkIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass(null)}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.none',
                                                                'None'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            null ||
                                                            task.priority ===
                                                                undefined) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                            task.priority ===
                                                                'low' ||
                                                            task.priority === 0
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                'low'
                                                            );
                                                        }}
                                                    >
                                                        <ArrowDownIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass('low')}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.low',
                                                                'Low'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            'low' ||
                                                            task.priority ===
                                                                0) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                            task.priority ===
                                                                'medium' ||
                                                            task.priority === 1
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                'medium'
                                                            );
                                                        }}
                                                    >
                                                        <ArrowUpIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass('medium')}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.medium',
                                                                'Medium'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            'medium' ||
                                                            task.priority ===
                                                                1) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                    <button
                                                        className={`w-full text-left px-3 py-2 text-sm rounded-b-lg flex items-center gap-2 ${
                                                            task.priority ===
                                                                'high' ||
                                                            task.priority === 2
                                                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                        }`}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handlePriorityChange(
                                                                'high'
                                                            );
                                                        }}
                                                    >
                                                        <FireIcon
                                                            className={`h-4 w-4 ${getPriorityIconClass('high')}`}
                                                        />
                                                        <span className="capitalize flex-1">
                                                            {t(
                                                                'priority.high',
                                                                'High'
                                                            )}
                                                        </span>
                                                        {(task.priority ===
                                                            'high' ||
                                                            task.priority ===
                                                                2) && (
                                                            <CheckIcon className="h-4 w-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Past Due Badge - Right of priority button */}
                                        {showPastDueBadge && (
                                            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex-shrink-0">
                                                <ExclamationTriangleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                                <span className="text-xs font-medium text-red-700 dark:text-red-300 hidden sm:inline">
                                                    {t(
                                                        'task.pastDue',
                                                        'Past Due'
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        {formattedUpdatedAt && (
                                            <span className="text-xs text-gray-400 dark:text-gray-600 sm:pl-1 mt-1 sm:mt-0">
                                                {t(
                                                    'task.updatedAt',
                                                    'Updated at'
                                                )}
                                                :{' '}
                                                <span className="text-gray-400 dark:text-gray-600">
                                                    {formattedUpdatedAt}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* Project and tags display below title */}
                                {(task.Project ||
                                    (task.tags && task.tags.length > 0)) && (
                                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 mt-2 px-2 -mx-2 gap-2 flex-wrap">
                                        {task.Project && (
                                            <Link
                                                to={
                                                    getProjectLink
                                                        ? getProjectLink(
                                                              task.Project
                                                          )
                                                        : '#'
                                                }
                                                className="flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-200 hover:underline transition-colors"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <FolderIcon className="h-4 w-4" />
                                                <span>{task.Project.name}</span>
                                            </Link>
                                        )}
                                        {task.tags && task.tags.length > 0 && (
                                            <div className="flex items-center">
                                                <TagIcon className="h-4 w-4 mr-1" />
                                                <span>
                                                    {task.tags.map(
                                                        (
                                                            tag: any,
                                                            index: number
                                                        ) => (
                                                            <React.Fragment
                                                                key={
                                                                    tag.uid ||
                                                                    tag.id ||
                                                                    tag.name
                                                                }
                                                            >
                                                                <Link
                                                                    to={
                                                                        getTagLink
                                                                            ? getTagLink(
                                                                                  tag
                                                                              )
                                                                            : '#'
                                                                    }
                                                                    className="hover:text-gray-900 dark:hover:text-gray-200 hover:underline transition-colors"
                                                                    onClick={(
                                                                        e
                                                                    ) =>
                                                                        e.stopPropagation()
                                                                    }
                                                                >
                                                                    {tag.name}
                                                                </Link>
                                                                {index <
                                                                    task.tags!
                                                                        .length -
                                                                        1 &&
                                                                    ', '}
                                                            </React.Fragment>
                                                        )
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Divider - Edge to edge */}
                <div className="mt-4 mb-4 -mx-6 border-t border-gray-200 dark:border-gray-700"></div>

                {/* Pills Navigation */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex gap-2 flex-wrap">
                        <button
                            onClick={() => onPillChange('overview')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'overview'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.overview', 'Overview')}
                        </button>
                        <button
                            onClick={() => onPillChange('subtasks')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
                                activePill === 'subtasks'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.subtasks', 'Subtasks')}
                            {subtasksCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full border border-white dark:border-gray-900"></span>
                            )}
                        </button>
                        <button
                            onClick={() => onPillChange('recurrence')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
                                activePill === 'recurrence'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.recurrence', 'Recurrence')}
                            {task.recurrence_type &&
                                task.recurrence_type !== 'none' && (
                                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full border border-white dark:border-gray-900"></span>
                                )}
                        </button>
                        <button
                            onClick={() => onPillChange('attachments')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative ${
                                activePill === 'attachments'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.attachments', 'Attachments')}
                            {attachmentCount > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full border border-white dark:border-gray-900"></span>
                            )}
                        </button>
                        <button
                            onClick={() => onPillChange('activity')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'activity'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.activity', 'Activity')}
                        </button>
                    </div>
                    {(showOverdueIcon || onQuickStatusToggle) && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            {showOverdueIcon && (
                                <div
                                    className="relative flex items-center z-20"
                                    data-overdue-toggle
                                >
                                    <button
                                        data-overdue-toggle
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onOverdueIconClick?.();
                                        }}
                                        className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs transition-colors ${
                                            isOverdueAlertVisible
                                                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-400 dark:bg-amber-900/30 dark:text-amber-300'
                                                : 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-900/40'
                                        }`}
                                        title={t(
                                            'task.showOverdueWarning',
                                            'Show overdue warning'
                                        )}
                                        aria-label={t(
                                            'task.showOverdueWarning',
                                            'Show overdue warning'
                                        )}
                                    >
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                    </button>
                                    {isOverdueAlertVisible && (
                                        <div
                                            data-overdue-toggle
                                            className="absolute right-0 top-full translate-y-2 w-[30rem] max-w-lg z-30"
                                        >
                                            <div className="relative rounded-lg shadow-2xl bg-amber-50 dark:bg-amber-900 border border-amber-200 dark:border-amber-600 px-4 py-3 text-xs text-amber-800 dark:text-amber-100">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onDismissOverdueAlert?.();
                                                    }}
                                                    className="absolute top-2 right-2 text-amber-600 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-100 transition-colors"
                                                    aria-label={t(
                                                        'common.close',
                                                        'Close'
                                                    )}
                                                >
                                                    <XMarkIcon className="h-3.5 w-3.5" />
                                                </button>
                                                <div className="flex items-start space-x-2 pr-4">
                                                    <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 dark:text-amber-300 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <p className="font-medium">
                                                            {t(
                                                                'task.overdueAlert',
                                                                "This task was in your plan yesterday and wasn't completed."
                                                            )}
                                                        </p>
                                                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-200">
                                                            {t(
                                                                'task.overdueYesterday',
                                                                'Consider prioritizing this task or breaking it into smaller steps.'
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            <div
                                className="relative flex items-center"
                                ref={actionsMenuRef}
                            >
                                <button
                                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setActionsMenuOpen(!actionsMenuOpen);
                                    }}
                                    aria-haspopup="true"
                                    aria-expanded={actionsMenuOpen}
                                    aria-label={t(
                                        'common.moreActions',
                                        'More actions'
                                    )}
                                >
                                    <span className="text-lg leading-none">
                                        ...
                                    </span>
                                </button>
                                {actionsMenuOpen && (
                                    <div className="absolute right-0 top-full translate-y-2 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-30">
                                        <button
                                            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setActionsMenuOpen(false);
                                                onDelete();
                                            }}
                                        >
                                            {t('common.delete', 'Delete')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDetailsHeader;
