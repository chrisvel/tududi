import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDraggable } from '@dnd-kit/core';
import {
    ArrowPathIcon,
    CheckIcon,
    FireIcon,
} from '@heroicons/react/24/outline';
import { Task } from '../../entities/Task';
import { toggleTaskCompletion } from '../../utils/tasksService';
import { getIntlLocale, parseDateString } from '../../utils/dateUtils';
import { toPriorityLevel } from '../Shared/PriorityBadge';
import { isTaskInProgress, isTaskWaiting } from '../../constants/taskStatus';
import { openTaskPanel } from '../../store/taskPanelStore';

// "Oct 26", with the year only when it isn't this year.
const shortDate = (date: Date): string =>
    date.toLocaleDateString(getIntlLocale(), {
        month: 'short',
        day: 'numeric',
        ...(date.getFullYear() !== new Date().getFullYear()
            ? { year: 'numeric' }
            : {}),
    });

interface BoardTaskRowProps {
    task: Task;
    overdue?: boolean;
    onTaskUpdate: (task: Task) => void;
    // The person column the row sits in, carried with the drag.
    personUid?: string;
    // The floating copy under the pointer while dragging.
    overlay?: boolean;
}

// A slim row for the narrow person columns: a done circle, the title, and
// one quiet line with the project and date. Everything else is a click away
// on the task page.
const BoardTaskRow: React.FC<BoardTaskRowProps> = ({
    task,
    overdue = false,
    onTaskUpdate,
    personUid,
    overlay = false,
}) => {
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: overlay ? `overlay-${task.uid}` : String(task.uid),
        data: { task, personUid },
        disabled: overlay || !task.uid,
    });

    const priority = toPriorityLevel(task.priority);
    const due = parseDateString(task.due_date?.slice(0, 10));
    const recurring = !!task.recurrence_type && task.recurrence_type !== 'none';
    const statusLabel = isTaskWaiting(task.status)
        ? t('task.status.waiting', 'Waiting')
        : isTaskInProgress(task.status)
          ? t('task.status.inProgress', 'In progress')
          : null;

    const open = () => {
        if (!task.uid) return;
        openTaskPanel(task.uid);
    };

    const complete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!task.uid || busy) return;
        setBusy(true);
        try {
            onTaskUpdate(await toggleTaskCompletion(task.uid, task));
        } finally {
            setBusy(false);
        }
    };

    return (
        <li
            ref={overlay ? undefined : setNodeRef}
            {...(overlay ? {} : attributes)}
            {...(overlay ? {} : listeners)}
            className={`group flex items-start gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer touch-manipulation ${
                overlay
                    ? 'bg-white shadow-lg cursor-grabbing dark:bg-gray-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            } ${isDragging ? 'opacity-30' : ''}`}
            onClick={open}
            data-testid={overlay ? undefined : 'board-task-row'}
        >
            <button
                type="button"
                onClick={complete}
                disabled={busy}
                aria-label={t('tasks.markAsDone', 'Mark as done')}
                title={t('tasks.markAsDone', 'Mark as done')}
                className="group/check mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset ring-gray-300 transition-colors hover:bg-green-50 hover:ring-green-500 dark:ring-gray-600 dark:hover:bg-green-900/30"
            >
                <CheckIcon className="h-2.5 w-2.5 text-green-600 opacity-0 group-hover/check:opacity-100" />
            </button>
            <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm leading-snug text-gray-900 dark:text-gray-100">
                    {priority === 'high' && (
                        <FireIcon
                            className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-red-500"
                            aria-label={t('priority.high', 'High')}
                        />
                    )}
                    {task.name}
                </p>
                {(task.Project?.name || due || recurring || statusLabel) && (
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {task.Project?.name && (
                            <span className="truncate">
                                {task.Project.name}
                            </span>
                        )}
                        {due && (
                            <span
                                className={`shrink-0 tabular-nums ${
                                    overdue
                                        ? 'text-red-600 dark:text-red-400'
                                        : ''
                                }`}
                            >
                                {task.Project?.name && (
                                    <span className="mr-1.5 text-gray-300 dark:text-gray-600">
                                        ·
                                    </span>
                                )}
                                {shortDate(due)}
                            </span>
                        )}
                        {recurring && (
                            <ArrowPathIcon
                                className="h-3 w-3 shrink-0"
                                aria-label={t('views.recurring', 'Recurring')}
                            />
                        )}
                        {statusLabel && (
                            <span className="shrink-0 rounded bg-gray-100 px-1 text-[11px] text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                {statusLabel}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
};

export default BoardTaskRow;
