'use strict';

// How "What could you do today?" is ordered. Profile > Planning lets the
// user reorder the buckets and explains the rest, so change both together.
//
// 1. Every task falls in one bucket: its group (overdue, due today, in
//    progress, everything else) split by whether it sits in a project.
// 2. Groups follow the user's order: a group sits where its first bucket
//    does in the user's order, or DEFAULT_ORDER.
// 3. Inside a group: higher priority first, then the bucket order (so the
//    project split never puts a task above one with higher priority), then
//    the earlier due date, then the user's tie-break (planningSettings.js
//    tieBreak): the most recently changed task, the newest or the oldest.
//    The task id settles any remaining tie so the order is stable.
// Which tasks reach "everything else" at all, and how many, is decided by
// the other settings in planningSettings.js.
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

const timeOf = (value, missing = Infinity) => {
    if (!value) return missing;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? missing : time;
};

const TIE_BREAKERS = {
    recently_touched: (a, b) =>
        timeOf(b.updated_at, -Infinity) - timeOf(a.updated_at, -Infinity),
    newest: (a, b) =>
        timeOf(b.created_at, -Infinity) - timeOf(a.created_at, -Infinity),
    oldest: (a, b) => timeOf(a.created_at) - timeOf(b.created_at),
};

function compareCandidates(a, b, tieBreak = 'recently_touched') {
    const priority = priorityRank(b.priority) - priorityRank(a.priority);
    if (priority !== 0) return priority;

    const due = timeOf(a.due_date) - timeOf(b.due_date);
    if (due !== 0 && !Number.isNaN(due)) return due;

    const tie = (TIE_BREAKERS[tieBreak] || TIE_BREAKERS.recently_touched)(a, b);
    if (tie !== 0 && !Number.isNaN(tie)) return tie;

    return (a.id || 0) - (b.id || 0);
}

function rankCandidates(tasks, tieBreak) {
    return [...(tasks || [])].sort((a, b) => compareCandidates(a, b, tieBreak));
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

// Returns [{ group, task }] for every task in `groups`, in the order above.
function orderCandidates(groups, order = DEFAULT_ORDER, tieBreak) {
    const buckets = normalizeOrder(order);
    const groupRank = (group) =>
        buckets.findIndex((key) => key.startsWith(`${group}:`));
    const entries = GROUP_ORDER.flatMap((group) =>
        (groups[group] || []).map((task) => ({ group, task }))
    );
    return entries.sort(
        (a, b) =>
            groupRank(a.group) - groupRank(b.group) ||
            priorityRank(b.task.priority) - priorityRank(a.task.priority) ||
            buckets.indexOf(bucketOf(a.group, a.task)) -
                buckets.indexOf(bucketOf(b.group, b.task)) ||
            compareCandidates(a.task, b.task, tieBreak)
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
