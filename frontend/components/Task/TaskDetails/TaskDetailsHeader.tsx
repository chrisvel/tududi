import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    CheckIcon,
    XMarkIcon,
    FolderIcon,
    TagIcon,
    ChevronDownIcon,
    PauseCircleIcon,
    PlayCircleIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    CalendarDaysIcon,
    CalendarIcon,
    PlayIcon,
    FireIcon,
    ArrowUpIcon,
    ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';
import { Task, PriorityType } from '../../../entities/Task';
import { formatDateTime } from '../../../utils/dateUtils';

interface TaskDetailsHeaderProps {
    task: Task;
    onTitleUpdate: (newTitle: string) => Promise<void>;
    onStatusUpdate: (newStatus: number) => Promise<void>;
    onPriorityUpdate: (newPriority: PriorityType) => Promise<void>;
    onEdit: () => void;
    onDelete: () => void;
    getProjectLink?: (project: any) => string;
    getTagLink?: (tag: any) => string;
    activePill: string;
    onPillChange: (pill: string) => void;
    showOverdueIcon?: boolean;
    onOverdueIconClick?: () => void;
    isOverdueAlertVisible?: boolean;
    onDismissOverdueAlert?: () => void;
    onToggleTodayPlan?: () => void;
    onQuickStatusToggle?: () => void;
}

const TaskDetailsHeader: React.FC<TaskDetailsHeaderProps> = ({
    task,
    onTitleUpdate,
    onStatusUpdate,
    onPriorityUpdate,
    onEdit,
    onDelete,
    getProjectLink,
    getTagLink,
    activePill,
    onPillChange,
    showOverdueIcon = false,
    onOverdueIconClick,
    isOverdueAlertVisible = false,
    onDismissOverdueAlert,
    onToggleTodayPlan,
    onQuickStatusToggle,
}) => {
    const { t } = useTranslation();
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(task.name);
    const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
    const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
    const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const statusDropdownRef = useRef<HTMLDivElement>(null);
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
                statusDropdownOpen &&
                statusDropdownRef.current &&
                !statusDropdownRef.current.contains(e.target as Node)
            ) {
                setStatusDropdownOpen(false);
            }
            if (
                priorityDropdownOpen &&
                priorityDropdownRef.current &&
                !priorityDropdownRef.current.contains(e.target as Node)
            ) {
                setPriorityDropdownOpen(false);
            }
        };

        if (actionsMenuOpen || statusDropdownOpen || priorityDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () =>
                document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [actionsMenuOpen, statusDropdownOpen, priorityDropdownOpen]);

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

    const getStatusLabel = () => {
        const status = task.status;
        if (status === 'not_started' || status === 0) {
            return t('task.status.notStarted', 'Not started');
        } else if (status === 'in_progress' || status === 1) {
            return t('task.status.inProgress', 'In progress');
        } else if (status === 'done' || status === 2) {
            return t('task.status.done', 'Done');
        } else if (status === 'archived' || status === 3) {
            return t('task.status.archived', 'Archived');
        } else if (status === 'waiting' || status === 4) {
            return t('task.status.waiting', 'Waiting');
        }
        return t('task.status.notStarted', 'Not started');
    };

    const getStatusButtonClass = () => {
        const status = task.status;

        if (status === 'not_started' || status === 0) {
            return 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-2 sm:ml-2 border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60';
        }

        const baseClass =
            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-2 sm:ml-2 border';

        if (status === 'in_progress' || status === 1) {
            return `${baseClass} border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30`;
        } else if (status === 'done' || status === 2) {
            return `${baseClass} border-green-500 text-green-600 dark:border-green-400 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/30`;
        } else if (status === 'archived' || status === 3) {
            return `${baseClass} border-purple-500 text-purple-600 dark:border-purple-400 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30`;
        } else if (status === 'waiting' || status === 4) {
            return `${baseClass} border-yellow-500 text-yellow-600 dark:border-yellow-400 dark:text-yellow-300 hover:bg-yellow-50 dark:hover:bg-yellow-900/30`;
        }
        return `${baseClass} border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60`;
    };

    const handleStatusChange = async (newStatus: number | string) => {
        setStatusDropdownOpen(false);
        const statusNum = typeof newStatus === 'string' ? parseInt(newStatus) : newStatus;
        await onStatusUpdate(statusNum);
    };

    const getStatusIcon = (statusOverride?: number | string): React.ElementType => {
        const status =
            typeof statusOverride !== 'undefined' ? statusOverride : task.status;

        if (status === 'in_progress' || status === 1) {
            return PlayCircleIcon;
        } else if (status === 'done' || status === 2) {
            return CheckCircleIcon;
        }
        return PauseCircleIcon;
    };

    const getStatusIconClass = (statusOverride?: number | string) => {
        const status =
            typeof statusOverride !== 'undefined' ? statusOverride : task.status;

        if (status === 'in_progress' || status === 1) {
            return 'text-blue-500 dark:text-blue-400';
        } else if (status === 'done' || status === 2) {
            return 'text-green-500 dark:text-green-400';
        }
        return 'text-gray-500 dark:text-gray-400';
    };

    const getPriorityLabel = (priorityOverride?: PriorityType) => {
        const priority = typeof priorityOverride !== 'undefined' ? priorityOverride : task.priority;

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
            return 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-2 sm:ml-1 border border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60';
        }

        const baseClass = 'px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-2 sm:ml-1 border';

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

    const getPriorityIcon = (priorityOverride?: PriorityType): React.ElementType => {
        const priority = typeof priorityOverride !== 'undefined' ? priorityOverride : task.priority;

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
        const priority = typeof priorityOverride !== 'undefined' ? priorityOverride : task.priority;

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
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h2
                                            onClick={handleStartTitleEdit}
                                            className="text-2xl font-normal text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded px-2 py-1 -mx-2 transition-colors"
                                            title={t(
                                                'task.clickToEditTitle',
                                                'Click to edit title'
                                            )}
                                        >
                                            {task.name}
                                        </h2>

                                        {/* Status Dropdown Button - Next to title */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <div className="relative flex-shrink-0" ref={statusDropdownRef}>
                                                <button
                                                    className={getStatusButtonClass()}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setStatusDropdownOpen(!statusDropdownOpen);
                                                    }}
                                                    aria-haspopup="true"
                                                    aria-expanded={statusDropdownOpen}
                                                >
                                                    {React.createElement(getStatusIcon(), {
                                                        className: `h-4 w-4 ${getStatusIconClass()}`,
                                                    })}
                                                    <span className="capitalize">{getStatusLabel()}</span>
                                                    <ChevronDownIcon className="h-4 w-4" />
                                                </button>
                                                {statusDropdownOpen && (
                                                    <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-20">
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm rounded-t-lg flex items-center gap-2 ${
                                                                task.status === 0 || task.status === 'not_started'
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleStatusChange(0);
                                                            }}
                                                        >
                                                            <PauseCircleIcon
                                                                className={`h-4 w-4 ${getStatusIconClass(0)}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('task.status.notStarted', 'Not started')}
                                                            </span>
                                                            {(task.status === 0 || task.status === 'not_started') && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                                task.status === 1 || task.status === 'in_progress'
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleStatusChange(1);
                                                            }}
                                                        >
                                                            <PlayCircleIcon
                                                                className={`h-4 w-4 ${getStatusIconClass(1)}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('task.status.inProgress', 'In progress')}
                                                            </span>
                                                            {(task.status === 1 || task.status === 'in_progress') && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm rounded-b-lg flex items-center gap-2 ${
                                                                task.status === 2 || task.status === 'done'
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleStatusChange(2);
                                                            }}
                                                        >
                                                            <CheckCircleIcon
                                                                className={`h-4 w-4 ${getStatusIconClass(2)}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('task.status.setAsDone', 'Set as done')}
                                                            </span>
                                                            {(task.status === 2 || task.status === 'done') && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Priority Dropdown Button - Next to status */}
                                            <div className="relative flex-shrink-0" ref={priorityDropdownRef}>
                                                <button
                                                    className={getPriorityButtonClass()}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setPriorityDropdownOpen(!priorityDropdownOpen);
                                                    }}
                                                    aria-haspopup="true"
                                                    aria-expanded={priorityDropdownOpen}
                                                >
                                                    {React.createElement(getPriorityIcon(), {
                                                        className: `h-4 w-4 ${getPriorityIconClass()}`,
                                                    })}
                                                    <span className="capitalize">{getPriorityLabel()}</span>
                                                    <ChevronDownIcon className="h-4 w-4" />
                                                </button>
                                                {priorityDropdownOpen && (
                                                    <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-20">
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm rounded-t-lg flex items-center gap-2 ${
                                                                task.priority === null || task.priority === undefined
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handlePriorityChange(null);
                                                            }}
                                                        >
                                                            <XMarkIcon
                                                                className={`h-4 w-4 ${getPriorityIconClass(null)}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('priority.none', 'None')}
                                                            </span>
                                                            {(task.priority === null || task.priority === undefined) && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                                task.priority === 'low' || task.priority === 0
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handlePriorityChange('low');
                                                            }}
                                                        >
                                                            <ArrowDownIcon
                                                                className={`h-4 w-4 ${getPriorityIconClass('low')}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('priority.low', 'Low')}
                                                            </span>
                                                            {(task.priority === 'low' || task.priority === 0) && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${
                                                                task.priority === 'medium' || task.priority === 1
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handlePriorityChange('medium');
                                                            }}
                                                        >
                                                            <ArrowUpIcon
                                                                className={`h-4 w-4 ${getPriorityIconClass('medium')}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('priority.medium', 'Medium')}
                                                            </span>
                                                            {(task.priority === 'medium' || task.priority === 1) && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            className={`w-full text-left px-3 py-2 text-sm rounded-b-lg flex items-center gap-2 ${
                                                                task.priority === 'high' || task.priority === 2
                                                                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-medium'
                                                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                                                            }`}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handlePriorityChange('high');
                                                            }}
                                                        >
                                                            <FireIcon
                                                                className={`h-4 w-4 ${getPriorityIconClass('high')}`}
                                                            />
                                                            <span className="capitalize flex-1">
                                                                {t('priority.high', 'High')}
                                                            </span>
                                                            {(task.priority === 'high' || task.priority === 2) && (
                                                                <CheckIcon className="h-4 w-4" />
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            {formattedUpdatedAt && (
                                                <span className="text-xs text-gray-400 dark:text-gray-500 sm:pl-1 mt-1 sm:mt-0">
                                                    {t('task.lastUpdatedAt', 'Last updated at')}:{' '}
                                                    <span className="text-gray-500 dark:text-gray-400">
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
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    <TagIcon className="h-4 w-4" />
                                                    <div className="flex flex-wrap">
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
                                                                            1 && (
                                                                        <span>
                                                                            {', '}
                                                                        </span>
                                                                    )}
                                                                </React.Fragment>
                                                            )
                                                        )}
                                                    </div>
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
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'subtasks'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.subtasks', 'Subtasks')}
                        </button>
                        <button
                            onClick={() => onPillChange('schedule')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'schedule'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.schedule', 'Schedule')}
                        </button>
                        <button
                            onClick={() => onPillChange('attachments')}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                activePill === 'attachments'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            {t('task.attachments', 'Attachments')}
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
                    {(showOverdueIcon ||
                        onToggleTodayPlan ||
                        onQuickStatusToggle) && (
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
                            {onToggleTodayPlan && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        onToggleTodayPlan();
                                    }}
                                    className={`inline-flex items-center justify-center rounded-full transition-all duration-200 ${
                                        Number(task.today_move_count || 0) > 1
                                            ? 'px-3 h-8'
                                            : 'w-8 h-8'
                                    } ${
                                        task.today
                                            ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                                        <CalendarDaysIcon className="h-4 w-4" />
                                    ) : (
                                        <CalendarIcon className="h-4 w-4" />
                                    )}
                                    {Number(task.today_move_count || 0) > 1 && (
                                        <span className="ml-1 text-xs font-medium">
                                            {Number(task.today_move_count || 0)}
                                        </span>
                                    )}
                                </button>
                            )}
                            {onQuickStatusToggle &&
                                (task.status === 'not_started' ||
                                    task.status === 'in_progress' ||
                                    task.status === 0 ||
                                    task.status === 1) && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onQuickStatusToggle();
                                        }}
                                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 ${
                                            task.status === 'in_progress' ||
                                            task.status === 1
                                                ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 animate-pulse'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                                        <PlayIcon className="h-4 w-4" />
                                    </button>
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
                                    <span className="text-lg leading-none">...</span>
                                </button>
                                {actionsMenuOpen && (
                                    <div className="absolute right-0 top-full translate-y-2 w-40 rounded-lg shadow-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 z-30">
                                        <button
                                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-t-lg"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setActionsMenuOpen(false);
                                                onEdit();
                                            }}
                                        >
                                            {t('common.edit', 'Edit')}
                                        </button>
                                        <button
                                            className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-b-lg"
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
