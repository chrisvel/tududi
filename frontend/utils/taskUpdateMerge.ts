import { Task } from '../entities/Task';
import { GroupedTasks } from './tasksService';

// Upcoming virtual rows share the parent uid. The save response is that
// parent, so copying it wholesale would stamp every day with one due date.
// Keep each occurrence's calendar day and identity; take the saved time.
export function mergeUpdatedTask(task: Task, serverTask: Task): Task {
    const merged: Task = {
        ...task,
        ...serverTask,
        subtasks: serverTask.subtasks || task.subtasks || [],
    };

    if (task.virtual_id) {
        merged.virtual_id = task.virtual_id;
        merged.is_virtual_occurrence = task.is_virtual_occurrence;
        merged.occurrence_index = task.occurrence_index;
        merged.due_date = task.due_date;
    }

    return merged;
}

export function mergeUpdatedTaskList(
    tasks: Task[],
    edited: Task,
    serverTask: Task
): Task[] {
    return tasks.map((task) =>
        sameUpdatedTask(task, edited)
            ? mergeUpdatedTask(task, serverTask)
            : task
    );
}

export function mergeUpdatedGroupedTasks(
    grouped: GroupedTasks | null,
    edited: Task,
    serverTask: Task
): GroupedTasks | null {
    if (!grouped) return grouped;

    const next: GroupedTasks = {};
    Object.entries(grouped).forEach(([groupName, tasks]) => {
        next[groupName] = mergeUpdatedTaskList(tasks, edited, serverTask);
    });
    return next;
}

function sameUpdatedTask(task: Task, edited: Task): boolean {
    if (edited.uid) return task.uid === edited.uid;
    return task.id === edited.id;
}
