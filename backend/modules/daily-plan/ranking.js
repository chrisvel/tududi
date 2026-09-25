'use strict';

// How "What could you do today?" is ordered. Profile > Planning explains
// these same rules to the user, so change both together.
//
// 1. Groups, in this order: overdue, due today, in progress, everything else.
// 2. Inside a group: higher priority first.
// 3. Then tasks in a project before tasks without one.
// 4. Then the earlier due date, then the older task, so the order is stable.
const GROUP_ORDER = ['overdue', 'due_today', 'in_progress', 'suggested'];

const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

const priorityRank = (priority) => {
    if (priority === null || priority === undefined) return 0;
    if (typeof priority === 'number') {
        if (priority >= 2) return PRIORITY_RANK.high;
        if (priority === 1) return PRIORITY_RANK.medium;
        if (priority === 0) return PRIORITY_RANK.low;
        return 0;
    }
    return PRIORITY_RANK[String(priority).toLowerCase()] || 0;
};

const timeOf = (value) => {
    if (!value) return Infinity;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? Infinity : time;
};

function compareCandidates(a, b) {
    const priority = priorityRank(b.priority) - priorityRank(a.priority);
    if (priority !== 0) return priority;

    const inProject = (b.project_id ? 1 : 0) - (a.project_id ? 1 : 0);
    if (inProject !== 0) return inProject;

    const due = timeOf(a.due_date) - timeOf(b.due_date);
    if (due !== 0 && !Number.isNaN(due)) return due;

    const created = timeOf(a.created_at) - timeOf(b.created_at);
    if (created !== 0 && !Number.isNaN(created)) return created;

    return (a.id || 0) - (b.id || 0);
}

function rankCandidates(tasks) {
    return [...(tasks || [])].sort(compareCandidates);
}

module.exports = {
    GROUP_ORDER,
    compareCandidates,
    rankCandidates,
};
