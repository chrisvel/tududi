// TaskItem is now a thin wrapper around TaskRow (the universal task row with
// inline quick-edit). Kept so the many existing `./TaskItem` imports keep
// working; new code should import from `./TaskRow`.
export { default } from './TaskRow';
export type { TaskRowProps as TaskItemProps } from './TaskRow';
