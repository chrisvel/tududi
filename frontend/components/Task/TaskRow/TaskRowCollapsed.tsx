import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    CalendarIcon,
    CalendarDaysIcon,
    ArrowPathIcon,
    ArrowUpIcon,
    CheckIcon,
    ListBulletIcon,
    ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { FolderIcon, FireIcon } from '@heroicons/react/24/solid';
import { Task } from '../../../entities/Task';
import { Project } from '../../../entities/Project';
import { isTaskCompleted } from '../../../constants/taskStatus';
import {
    parseDateString,
    getTodayDateString,
    getTomorrowDateString,
    getYesterdayDateString,
} from '../../../utils/dateUtils';
import TaskStatusControl from '../TaskStatusControl';

interface TaskRowCollapsedProps {
    task: Task;
    project?: Project | null;
    hideProjectName?: boolean;
    hideStatusControl?: boolean;
    compact?: boolean;
    onActivate: (e: React.MouseEvent | React.KeyboardEvent) => void;
    onToggleCompletion?: () => void;
    onTaskUpdate?: (task: Task) => Promise<void>;
    onMenuOpenChange?: (open: boolean) => void;
    hasSubtasks?: boolean;
    showSubtasks?: boolean;
    onSubtasksToggle?: (e: React.MouseEvent) => void;
    // When the row is expanded the title becomes an inline editable field.
    editable?: boolean;
    onSaveTitle?: (name: string) => void | Promise<void>;
    onEscape?: () => void;
}

const tagColorStyle = (color?: string): React.CSSProperties | undefined => {
    if (!color) return undefined;
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return { backgroundColor: `rgba(${r}, ${g}, ${b}, 0.2)`, color };
};

const slug = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const TaskRowCollapsed: React.FC<TaskRowCollapsedProps> = ({
    task,
    project,
    hideProjectName = false,
    hideStatusControl = false,
    compact = false,
    onActivate,
    onToggleCompletion,
    onTaskUpdate,
    onMenuOpenChange,
    hasSubtasks,
    showSubtasks,
    onSubtasksToggle,
    editable = false,
    onSaveTitle,
    onEscape,
}) => {
    const { t } = useTranslation();
    const currentName = task.original_name || task.name;
    const titleInputRef = useRef<HTMLInputElement>(null);
    const [draftName, setDraftName] = useState(currentName);

    useEffect(() => {
        setDraftName(currentName);
    }, [currentName, editable]);

    useEffect(() => {
        if (editable) {
            const id = window.setTimeout(
                () => titleInputRef.current?.focus(),
                60
            );
            return () => window.clearTimeout(id);
        }
    }, [editable]);

    const commitTitle = () => {
        const trimmed = draftName.trim();
        if (trimmed && trimmed !== currentName) {
            void onSaveTitle?.(trimmed);
        } else if (!trimmed) {
            setDraftName(currentName);
        }
    };

    const formatDue = (d: string) => {
        if (d === getTodayDateString())
            return t('dateIndicators.today', 'TODAY');
        if (d === getTomorrowDateString())
            return t('dateIndicators.tomorrow', 'TOMORROW');
        if (d === getYesterdayDateString())
            return t('dateIndicators.yesterday', 'YESTERDAY');
        const date = parseDateString(d);
        return date
            ? date.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
              })
            : d;
    };

    const formatDefer = (v: string): string | null => {
        const date = new Date(v);
        if (Number.isNaN(date.getTime())) return null;
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

    const formatRecurrence = (type: string) => {
        switch (type) {
            case 'daily':
                return t('recurrence.daily', 'Daily');
            case 'weekly':
                return t('recurrence.weekly', 'Weekly');
            case 'monthly':
            case 'monthly_weekday':
            case 'monthly_last_day':
                return t('recurrence.monthly', 'Monthly');
            default:
                return t('recurrence.recurring', 'Recurring');
        }
    };

    const deferText = task.defer_until ? formatDefer(task.defer_until) : null;
    const showProject = project && project.name && !hideProjectName;
    const hasMeta =
        !compact &&
        (showProject ||
            (task.tags && task.tags.length > 0) ||
            !!task.due_date ||
            (isTaskCompleted(task.status) && !!task.completed_at) ||
            (task.recurrence_type && task.recurrence_type !== 'none') ||
            !!task.recurring_parent_id ||
            !!deferText ||
            !!task.parent_task);

    const projectHref = project
        ? project.uid
            ? `/project/${project.uid}-${slug(project.name)}`
            : `/project/${project.id}`
        : '#';

    const stop = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div
            className={`group flex items-start gap-3 px-4 ${
                hasMeta ? 'py-2' : 'py-3'
            } cursor-pointer`}
            role="button"
            tabIndex={0}
            onClick={onActivate}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActivate(e);
                }
            }}
        >
            <div className="flex flex-1 min-w-0 flex-col">
                <div className="flex items-center gap-1.5 min-w-0">
                    {task.habit_mode && (
                        <FireIcon
                            className="h-4 w-4 text-orange-500 flex-shrink-0"
                            title={t('tasks.habit', 'Habit')}
                        />
                    )}
                    {editable && onSaveTitle ? (
                        <input
                            ref={titleInputRef}
                            value={draftName}
                            onClick={stop}
                            onChange={(e) => setDraftName(e.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitTitle();
                                    titleInputRef.current?.blur();
                                } else if (e.key === 'Escape') {
                                    setDraftName(currentName);
                                    onEscape?.();
                                }
                            }}
                            className="flex-1 min-w-0 bg-transparent text-[15px] font-medium tracking-tight text-gray-900 dark:text-gray-100 border-0 p-0 focus:outline-none focus:ring-0"
                            placeholder={t(
                                'forms.task.namePlaceholder',
                                'Task name'
                            )}
                        />
                    ) : (
                        <span
                            className={`text-[15px] font-medium tracking-tight truncate ${
                                isTaskCompleted(task.status)
                                    ? 'text-gray-400 dark:text-gray-500 line-through'
                                    : 'text-gray-900 dark:text-gray-200'
                            }`}
                        >
                            {currentName}
                        </span>
                    )}
                    {hasSubtasks && onSubtasksToggle && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onSubtasksToggle(e);
                            }}
                            aria-pressed={!!showSubtasks}
                            title={
                                showSubtasks
                                    ? t('tasks.hideSubtasks', 'Hide subtasks')
                                    : t('tasks.showSubtasks', 'Show subtasks')
                            }
                            className={`ml-1 flex items-center gap-0.5 h-5 px-1.5 rounded-full border transition-colors ${
                                showSubtasks
                                    ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-100'
                                    : 'text-gray-400 border-transparent hover:border-gray-200 hover:text-gray-600 dark:hover:border-gray-600'
                            }`}
                        >
                            <ListBulletIcon className="h-3.5 w-3.5" />
                            <ChevronDownIcon
                                className={`h-3 w-3 transition-transform ${
                                    showSubtasks ? 'rotate-180' : ''
                                }`}
                            />
                        </button>
                    )}
                </div>

                {hasMeta && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        {task.parent_task && (
                            <span className="flex items-center">
                                <ArrowUpIcon className="h-3 w-3 mr-1 flex-shrink-0" />
                                <Link
                                    to={`/task/${task.parent_task.uid}`}
                                    onClick={stop}
                                    className="hover:underline max-w-[12rem] truncate"
                                >
                                    {task.parent_task.name}
                                </Link>
                            </span>
                        )}
                        {showProject && (
                            <span className="flex items-center">
                                <FolderIcon className="h-3 w-3 mr-1" />
                                <Link
                                    to={projectHref}
                                    onClick={stop}
                                    className="hover:underline max-w-[12rem] truncate"
                                >
                                    {project!.name}
                                </Link>
                            </span>
                        )}
                        {task.tags && task.tags.length > 0 && (
                            <span className="flex flex-wrap items-center gap-1.5">
                                {task.tags.map((tag) => (
                                    <Link
                                        key={tag.uid || tag.name}
                                        to={`/tag/${tag.uid ? `${tag.uid}-` : ''}${slug(tag.name)}`}
                                        onClick={stop}
                                        className="inline-flex items-center px-2 py-px rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                        style={tagColorStyle(tag.color)}
                                    >
                                        {tag.name}
                                    </Link>
                                ))}
                            </span>
                        )}
                        {task.due_date && (
                            <span className="flex items-center whitespace-nowrap">
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {formatDue(task.due_date)}
                            </span>
                        )}
                        {isTaskCompleted(task.status) && task.completed_at && (
                            <span className="flex items-center whitespace-nowrap">
                                <CheckIcon className="h-3 w-3 mr-1" />
                                {formatDue(task.completed_at.split('T')[0])}
                            </span>
                        )}
                        {task.recurrence_type &&
                            task.recurrence_type !== 'none' && (
                                <span className="flex items-center">
                                    <ArrowPathIcon className="h-3 w-3 mr-1" />
                                    {formatRecurrence(task.recurrence_type)}
                                </span>
                            )}
                        {task.recurring_parent_id && (
                            <span className="flex items-center">
                                <ArrowPathIcon className="h-3 w-3 mr-1" />
                                {t('recurrence.instance', 'Recurring instance')}
                            </span>
                        )}
                        {deferText && (
                            <span className="flex items-center whitespace-nowrap">
                                <CalendarDaysIcon className="h-3 w-3 mr-1" />
                                {deferText}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {!hideStatusControl && !task.habit_mode && onToggleCompletion && (
                <div className="flex-shrink-0" onClick={stop}>
                    <TaskStatusControl
                        task={task}
                        onToggleCompletion={onToggleCompletion}
                        onTaskUpdate={onTaskUpdate}
                        showMobileVariant={false}
                        onMenuOpenChange={onMenuOpenChange}
                    />
                </div>
            )}
        </div>
    );
};

export default TaskRowCollapsed;
