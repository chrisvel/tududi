// "Quiet sheet" task lists: rows sit on one shared surface with soft
// dividers instead of floating as separate cards. Rows restyle themselves
// with the [.task-sheet_&] variant, so lists that leave this class off
// (Kanban, Eisenhower, Upcoming day columns) keep the card look.
export const TASK_SHEET_CLASS =
    'task-sheet rounded-2xl bg-white dark:bg-gray-900 p-1.5 divide-y divide-gray-100 dark:divide-white/[0.05]';
