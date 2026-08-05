import React, { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Task, StatusType } from '../../entities/Task';
import { getStatusString } from '../../constants/taskStatus';

interface TaskStatusControlProps {
    task: Task;
    onToggleCompletion?: () => void;
    onTaskUpdate?: (task: Task) => Promise<void>;
    hoverRevealQuickActions?: boolean;
    showMobileVariant?: boolean;
    className?: string;
    variant?: 'pill' | 'square';
    showQuickActions?: boolean;
    onMenuOpenChange?: (isOpen: boolean) => void;
}

type StatusKey = 'not_started' | 'planned' | 'in_progress' | 'waiting' | 'cancelled' | 'done' | 'archived';

const STATUS_CONFIG: Record<StatusKey, { color: string; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }> = {
    not_started: {
        color: 'text-gray-400 dark:text-gray-500',
        label: 'Not started',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M9.5 9v6M14.5 9v6" />
            </svg>
        ),
    },
    planned: {
        color: 'text-purple-400 dark:text-purple-400',
        label: 'Planned',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
            </svg>
        ),
    },
    in_progress: {
        color: 'text-blue-400 dark:text-blue-400',
        label: 'In progress',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" {...props}>
                <path d="M7 4.7c0-.9 1-1.4 1.7-.9l11 6.3c.7.4.7 1.4 0 1.8l-11 6.3c-.7.4-1.7-.1-1.7-.9V4.7z" />
            </svg>
        ),
    },
    waiting: {
        color: 'text-amber-400 dark:text-amber-400',
        label: 'Waiting',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
            </svg>
        ),
    },
    cancelled: {
        color: 'text-red-400 dark:text-red-400',
        label: 'Cancelled',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}>
                <circle cx="12" cy="12" r="8.5" />
                <path d="M9 9l6 6M15 9l-6 6" />
            </svg>
        ),
    },
    done: {
        color: 'text-green-400 dark:text-green-400',
        label: 'Done',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
        ),
    },
    archived: {
        color: 'text-green-400 dark:text-green-400',
        label: 'Archived',
        Icon: (props) => (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
        ),
    },
};

const STATUS_OPTIONS: StatusKey[] = ['not_started', 'planned', 'in_progress', 'waiting', 'cancelled', 'done'];

const TaskStatusControl: React.FC<TaskStatusControlProps> = ({
    task,
    onToggleCompletion,
    onTaskUpdate,
    className = '',
    onMenuOpenChange,
}) => {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        onMenuOpenChange?.(menuOpen);
    }, [menuOpen, onMenuOpenChange]);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);

    const currentStatus = getStatusString(task.status) as StatusKey;
    const config = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.not_started;
    const { Icon: CurrentIcon, color: currentColor } = config;

    const getLabel = (key: StatusKey): string => {
        const labels: Record<StatusKey, string> = {
            not_started: t('task.status.notStarted', 'Not started'),
            planned: t('task.status.planned', 'Planned'),
            in_progress: t('task.status.inProgress', 'In progress'),
            waiting: t('task.status.waiting', 'Waiting'),
            cancelled: t('task.status.cancelled', 'Cancelled'),
            done: t('tasks.done', 'Done'),
            archived: t('task.status.archived', 'Archived'),
        };
        return labels[key];
    };

    const getDropdownLabel = (key: StatusKey): string => {
        if (key === 'done') return t('tasks.setAsDone', 'Set as done');
        return getLabel(key);
    };

    const handleSelect = async (e: React.MouseEvent, value: StatusKey) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        if (value === 'done' && onToggleCompletion) {
            onToggleCompletion();
            return;
        }
        if (onTaskUpdate && task.id) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { subtasks: _subtasks, ...taskWithoutSubtasks } = task;
            await onTaskUpdate({
                ...taskWithoutSubtasks,
                status: value as StatusType,
                name: task.original_name || task.name,
            });
        }
    };

    return (
        <div className={`relative ${menuOpen ? 'z-[10000]' : ''} ${className}`} ref={menuRef}>
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen((prev) => !prev);
                }}
                className={`group/status flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/60 ${currentColor}`}
            >
                <CurrentIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-[11.5px] font-medium whitespace-nowrap">{getLabel(currentStatus)}</span>
                <ChevronDownIcon className="h-2.5 w-2.5 opacity-0 group-hover/status:opacity-60 transition-opacity" />
            </button>

            {menuOpen && (
                <div className="absolute right-0 top-full mt-1 min-w-[160px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700/80 rounded-lg shadow-lg z-[9999] p-1">
                    {STATUS_OPTIONS.map((key) => {
                        const { Icon, color } = STATUS_CONFIG[key];
                        const isActive = currentStatus === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={(e) => handleSelect(e, key)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${color}`} />
                                <span className={`text-[12.5px] ${color} ${isActive ? 'font-bold' : 'font-medium'}`}>
                                    {getDropdownLabel(key)}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TaskStatusControl;
