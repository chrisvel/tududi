'use strict';

// First and last day of a task or project, as YYYY-MM-DD strings. One date
// alone stands for both ends, so a task with only a due date counts as a day.
function dateSpan(start, end) {
    const first = start || end;
    const last = end || start;
    if (!first) return { start: null, end: null };
    return first <= last
        ? { start: first, end: last }
        : { start: last, end: first };
}

// Earliest start and latest end across spans, ignoring undated ones.
function rollUp(spans) {
    let start = null;
    let end = null;
    for (const span of spans) {
        if (!span.start) continue;
        if (start === null || span.start < start) start = span.start;
        if (end === null || span.end > end) end = span.end;
    }
    return { start, end };
}

function overlaps(span, windowFrom, windowTo) {
    return !!span.start && span.start <= windowTo && span.end >= windowFrom;
}

function taskKind(startDate, dueDate) {
    if (startDate && dueDate) return 'range';
    if (dueDate) return 'due';
    if (startDate) return 'start';
    return 'none';
}

// A project's row: dates from its tasks, or its own dates when no task has
// one. Only tasks touching the window are sent; the dates cover all of them.
function buildProjectRow(project, tasks, windowFrom, windowTo) {
    const fromTasks = rollUp(tasks.map((task) => task.span));
    const dates = fromTasks.start
        ? fromTasks
        : dateSpan(project.start_date, project.due_date);
    return {
        uid: project.uid,
        name: project.name,
        status: project.status,
        start: dates.start,
        end: dates.end,
        dated_from_tasks: !!fromTasks.start,
        task_count: tasks.length,
        tasks: tasks
            .filter((task) => overlaps(task.span, windowFrom, windowTo))
            .map((task) => ({
                uid: task.uid,
                name: task.name,
                status: task.status,
                start_date: task.start_date,
                due_date: task.due_date,
                kind: taskKind(task.start_date, task.due_date),
            })),
    };
}

// Cancelled projects never show. Finished ones only when they ran during the
// window, so past quarters stay accurate without piling up in the current one.
function isProjectShown(project, row, windowFrom, windowTo) {
    if (project.status === 'cancelled') return false;
    if (project.status === 'done') return overlaps(row, windowFrom, windowTo);
    return true;
}

// The area a project sits in for this user: a shared project can be moved to
// one of their own areas, the same rule the Projects page applies.
function placedAreaId(project, userId, overrides) {
    if (project.user_id !== userId && overrides.has(project.id)) {
        return overrides.get(project.id);
    }
    return project.area_id;
}

module.exports = {
    dateSpan,
    rollUp,
    overlaps,
    taskKind,
    buildProjectRow,
    isProjectShown,
    placedAreaId,
};
