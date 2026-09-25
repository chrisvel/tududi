'use strict';

// How "What could you do today?" is ordered. Profile > Planning lets the
// user reorder the buckets and explains the rest, so change both together.
//
// 1. Every task falls in one bucket: its group (overdue, due today, in
//    progress, everything else) split by whether it sits in a project.
// 2. Buckets follow the user's order, or DEFAULT_ORDER.
// 3. Inside a bucket: higher priority first, then the earlier due date, then
//    the older task, so the order is stable.
const GROUP_ORDER = ['overdue', 'due_today', 'in_progress', 'suggested'];

const DEFAULT_ORDER = GROUP_ORDER.flatMap((group) => [
    `${group}:project`,
    `${group}:none`,
]);

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

    const due = timeOf(a.due_date) - timeOf(b.due_date);
    if (due !== 0 && !Number.isNaN(due)) return due;

    const created = timeOf(a.created_at) - timeOf(b.created_at);
    if (created !== 0 && !Number.isNaN(created)) return created;

    return (a.id || 0) - (b.id || 0);
}

function rankCandidates(tasks) {
    return [...(tasks || [])].sort(compareCandidates);
}

const bucketOf = (group, task) =>
    `${group}:${task.project_id ? 'project' : 'none'}`;

// Keeps known buckets once each, in the given order, and appends any the
// saved order is missing, so an old or hand-edited setting still works.
function normalizeOrder(order) {
    if (!Array.isArray(order)) return [...DEFAULT_ORDER];
    const known = order.filter(
        (key, index) =>
            DEFAULT_ORDER.includes(key) && order.indexOf(key) === index
    );
    return [...known, ...DEFAULT_ORDER.filter((key) => !known.includes(key))];
}

// Returns [{ group, task }] for every task in `groups`, in bucket order.
function orderCandidates(groups, order = DEFAULT_ORDER) {
    const buckets = new Map(normalizeOrder(order).map((key) => [key, []]));
    for (const group of GROUP_ORDER) {
        for (const task of groups[group] || []) {
            buckets.get(bucketOf(group, task)).push({ group, task });
        }
    }
    return [...buckets.values()].flatMap((entries) =>
        entries.sort((a, b) => compareCandidates(a.task, b.task))
    );
}

module.exports = {
    GROUP_ORDER,
    DEFAULT_ORDER,
    compareCandidates,
    rankCandidates,
    normalizeOrder,
    orderCandidates,
};
