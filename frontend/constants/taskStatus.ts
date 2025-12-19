import { StatusType } from '../entities/Task';

export const TASK_STATUS = {
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    DONE: 2,
    ARCHIVED: 3,
    WAITING: 4,
    CANCELLED: 5,
    PLANNED: 6,
} as const;

export const TASK_STATUS_STRINGS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    DONE: 'done',
    ARCHIVED: 'archived',
    WAITING: 'waiting',
    CANCELLED: 'cancelled',
    PLANNED: 'planned',
} as const;

export const HABIT_STATUS_CANCELLED = 5;
export const HABIT_STATUS_CANCELLED_STRING = 'cancelled';

export type TaskStatusValue = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
export type TaskStatusString =
    (typeof TASK_STATUS_STRINGS)[keyof typeof TASK_STATUS_STRINGS];

export function getStatusString(status: StatusType | number): TaskStatusString {
    if (typeof status === 'string') {
        return status as TaskStatusString;
    }

    const statusNames: TaskStatusString[] = [
        'not_started',
        'in_progress',
        'done',
        'archived',
        'waiting',
        'cancelled',
        'planned',
    ];

    return statusNames[status] || 'not_started';
}

export function getStatusValue(status: StatusType | number): TaskStatusValue {
    if (typeof status === 'number') {
        return status as TaskStatusValue;
    }

    const statusMap: Record<string, TaskStatusValue> = {
        not_started: TASK_STATUS.NOT_STARTED,
        in_progress: TASK_STATUS.IN_PROGRESS,
        done: TASK_STATUS.DONE,
        archived: TASK_STATUS.ARCHIVED,
        waiting: TASK_STATUS.WAITING,
        cancelled: TASK_STATUS.CANCELLED,
        planned: TASK_STATUS.PLANNED,
    };

    return statusMap[status] ?? TASK_STATUS.NOT_STARTED;
}

export function getStatusLabel(status: StatusType | number): string {
    const statusString = getStatusString(status);

    const labels: Record<TaskStatusString, string> = {
        not_started: 'Not Started',
        in_progress: 'In Progress',
        done: 'Completed',
        archived: 'Archived',
        waiting: 'Waiting',
        cancelled: 'Cancelled',
        planned: 'Planned',
    };

    return labels[statusString] || 'Unknown';
}

export function isTaskDone(
    status: StatusType | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.DONE || status === 'done';
}

export function isTaskInProgress(
    status: StatusType | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.IN_PROGRESS || status === 'in_progress';
}

export function isTaskNotStarted(
    status: StatusType | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.NOT_STARTED || status === 'not_started';
}

export function isTaskArchived(
    status: StatusType | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.ARCHIVED || status === 'archived';
}

export function isTaskWaiting(
    status: StatusType | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.WAITING || status === 'waiting';
}

export function isTaskCancelled(
    status: StatusType | string | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.CANCELLED || status === 'cancelled';
}

export function isTaskPlanned(
    status: StatusType | number | undefined | null
): boolean {
    if (status === undefined || status === null) return false;
    return status === TASK_STATUS.PLANNED || status === 'planned';
}

export function isTaskActive(
    status: StatusType | number | undefined | null
): boolean {
    return (
        !isTaskDone(status) &&
        !isTaskArchived(status) &&
        !isTaskCancelled(status)
    );
}

export function isTaskCompleted(
    status: StatusType | number | undefined | null
): boolean {
    return isTaskDone(status) || isTaskArchived(status);
}

export function isTaskActionable(
    status: StatusType | number | undefined | null
): boolean {
    return (
        !isTaskDone(status) &&
        !isTaskArchived(status) &&
        !isTaskCancelled(status) &&
        !isTaskWaiting(status)
    );
}

export function isHabitArchived(
    status: StatusType | number | undefined | null
): boolean {
    return isTaskArchived(status) || isTaskCancelled(status);
}
