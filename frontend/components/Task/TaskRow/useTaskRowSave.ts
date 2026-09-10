import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Task, PriorityType } from '../../../entities/Task';
import { updateTask } from '../../../utils/tasksService';
import { useToast } from '../../Shared/ToastContext';

type RecurrencePayload = Partial<
    Pick<
        Task,
        | 'recurrence_type'
        | 'recurrence_interval'
        | 'recurrence_end_date'
        | 'recurrence_weekday'
        | 'recurrence_weekdays'
        | 'recurrence_month_day'
        | 'recurrence_week_of_month'
        | 'completion_based'
    >
>;

export interface TaskRowSetters {
    setTitle: (title: string) => Promise<void>;
    setNote: (note: string) => Promise<void>;
    setPriority: (priority: PriorityType) => Promise<void>;
    setDueDate: (dueDate: string | null) => Promise<void>;
    setDeferUntil: (deferUntil: string | null) => Promise<void>;
    setProject: (projectId: number | null) => Promise<void>;
    setTags: (tagNames: string[]) => Promise<void>;
    setAssignee: (personUid: string | null) => Promise<void>;
    setRecurrence: (payload: RecurrencePayload) => Promise<void>;
}

// Centralises task field edits made from the inline quick-edit row. Every setter
// sends a minimal field-only PATCH (never spreads the task, never includes a
// `subtasks` key, which the backend would treat as "delete all subtasks"), then
// merges the response back while preserving the already-loaded subtasks.
export const useTaskRowSave = (
    task: Task,
    onTaskUpdate: (task: Task) => Promise<void>
): TaskRowSetters => {
    const { t } = useTranslation();
    const { showErrorToast } = useToast();

    const save = useCallback(
        async (partial: Partial<Task>, errorKey: string, fallback: string) => {
            if (!task.uid) return;
            try {
                const response = await updateTask(task.uid, partial);
                const merged: Task = {
                    ...task,
                    ...response,
                    subtasks: response.subtasks || task.subtasks || [],
                };
                await onTaskUpdate(merged);
            } catch (error) {
                console.error('TaskRow save failed:', error);
                showErrorToast(t(errorKey, fallback));
                throw error;
            }
        },
        [task, onTaskUpdate, showErrorToast, t]
    );

    return {
        setTitle: (title) =>
            save(
                { name: title.trim() },
                'task.titleUpdateError',
                'Failed to update task'
            ),
        setNote: (note) =>
            save(
                { note: note.trim() },
                'task.contentUpdateError',
                'Failed to update note'
            ),
        setPriority: (priority) =>
            save(
                { priority },
                'task.priorityUpdateError',
                'Failed to update priority'
            ),
        setDueDate: (dueDate) =>
            save(
                { due_date: dueDate || null },
                'task.dueDateUpdateError',
                'Failed to update due date'
            ),
        setDeferUntil: (deferUntil) =>
            save(
                { defer_until: deferUntil || null },
                'task.deferUntilUpdateError',
                'Failed to update defer date'
            ),
        setProject: (projectId) =>
            save(
                { project_id: projectId },
                'task.projectUpdateError',
                'Failed to update project'
            ),
        setTags: (tagNames) =>
            save(
                { tags: tagNames.map((name) => ({ name })) as Task['tags'] },
                'task.tagsUpdateError',
                'Failed to update tags'
            ),
        setAssignee: (personUid) =>
            save(
                { assigned_to: personUid },
                'task.assigneeUpdateError',
                'Failed to update assignee'
            ),
        setRecurrence: (payload) =>
            save(
                payload,
                'task.recurrenceUpdateError',
                'Failed to update recurrence'
            ),
    };
};

export default useTaskRowSave;
