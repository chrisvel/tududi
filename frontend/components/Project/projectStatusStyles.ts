import { ProjectStatus } from '../../entities/Project';

// Soft tinted badge colors for a project's status, shared by the projects
// table and the project page header.
export const getProjectStatusTint = (
    status: ProjectStatus | undefined
): string => {
    switch (status) {
        case 'in_progress':
            return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
        case 'done':
            return 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300';
        case 'waiting':
            return 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300';
        case 'planned':
            return 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300';
        case 'cancelled':
            return 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300';
        default:
            return 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    }
};
