import { StatusType } from '../../entities/Task';

type StatusKey =
    | 'not_started'
    | 'in_progress'
    | 'done'
    | 'archived'
    | 'waiting'
    | 'cancelled'
    | 'planned';

interface StatusStyle {
    button: string;
    border: string;
}

const STATUS_STYLES: Record<StatusKey, StatusStyle> = {
    planned: {
        button: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
        border: 'border-purple-200 dark:border-purple-800',
    },
    in_progress: {
        button: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
        border: 'border-blue-200 dark:border-blue-800',
    },
    waiting: {
        button: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-200 dark:border-yellow-800',
    },
    done: {
        button: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
        border: 'border-green-200 dark:border-green-800',
    },
    cancelled: {
        button: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
        border: 'border-red-200 dark:border-red-800',
    },
    archived: {
        button: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300',
        border: 'border-gray-200 dark:border-gray-800',
    },
    not_started: {
        button: 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300',
        border: 'border-gray-200 dark:border-gray-700',
    },
};

const resolveStatusKey = (status?: StatusType | number | null): StatusKey => {
    if (status === 'planned' || status === 6) return 'planned';
    if (status === 'in_progress' || status === 1) return 'in_progress';
    if (status === 'done' || status === 2) return 'done';
    if (status === 'archived' || status === 3) return 'archived';
    if (status === 'waiting' || status === 4) return 'waiting';
    if (status === 'cancelled' || status === 5) return 'cancelled';
    return 'not_started';
};

export const getStatusButtonColorClasses = (
    status?: StatusType | number | null
) => {
    const style = STATUS_STYLES[resolveStatusKey(status)];
    return style.button;
};

export const getStatusBorderColorClasses = (
    status?: StatusType | number | null
) => {
    const { border } = STATUS_STYLES[resolveStatusKey(status)];
    return border;
};
