'use strict';
const { Goal, User } = require('../../models');
const { ValidationError, NotFoundError } = require('../../shared/errors');

const HORIZONS = ['vision', 'five_year', 'year', 'season', 'month', 'week'];

// Lock the owner, including when a new root is created. This serializes
// hierarchy edits on PostgreSQL without putting graph rules in the database.
async function lockOwner(userId, transaction) {
    const user = await User.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
    });
    if (!user) throw new NotFoundError('User not found');
    return user;
}

function validateGraph(goals, goalId, changes) {
    const candidate = {
        id: goalId ?? -1,
        parent_goal_id: null,
        horizon: 'season',
        ...changes,
    };
    const nodes = new Map(goals.map((goal) => [goal.id, { ...goal }]));
    nodes.set(candidate.id, { ...nodes.get(candidate.id), ...candidate });
    // Do not clear an existing parent/horizon unless the caller supplied it.
    if (goalId != null)
        nodes.set(goalId, {
            ...goals.find((g) => g.id === goalId),
            ...changes,
        });
    for (const node of nodes.values()) {
        if (!HORIZONS.includes(node.horizon))
            throw new ValidationError('Invalid goal horizon');
        let current = node;
        const visited = new Set();
        let depth = 0;
        while (current) {
            if (visited.has(current.id))
                throw new ValidationError(
                    'Goal hierarchy cannot contain a cycle'
                );
            visited.add(current.id);
            if (++depth > 6)
                throw new ValidationError(
                    'Goal hierarchy cannot exceed six levels'
                );
            if (current.parent_goal_id == null) break;
            const parent = nodes.get(current.parent_goal_id);
            if (!parent) throw new ValidationError('Invalid parent goal');
            current = parent;
        }
    }
    for (const node of nodes.values()) {
        if (node.parent_goal_id == null) continue;
        const parent = nodes.get(node.parent_goal_id);
        if (
            HORIZONS.indexOf(parent.horizon) >= HORIZONS.indexOf(node.horizon)
        ) {
            throw new ValidationError(
                'Parent horizon must be longer than child horizon'
            );
        }
    }
}

async function validateHierarchy(userId, goalId, data, transaction) {
    const goals = await Goal.findAll({
        where: { user_id: userId },
        raw: true,
        transaction,
    });
    if (goalId != null && !goals.some((goal) => goal.id === goalId))
        throw new NotFoundError('Goal not found');
    validateGraph(goals, goalId, data);
}

async function resolveParent(userId, data, transaction) {
    if (data.parent_goal_uid !== undefined) {
        if (data.parent_goal_uid === null || data.parent_goal_uid === '')
            return null;
        const parent = await Goal.findOne({
            where: { user_id: userId, uid: data.parent_goal_uid },
            transaction,
        });
        if (!parent) throw new ValidationError('Invalid parent goal');
        if (
            data.parent_goal_id !== undefined &&
            data.parent_goal_id !== parent.id
        )
            throw new ValidationError('Conflicting parent goal identifiers');
        return parent.id;
    }
    if (data.parent_goal_id === undefined) return undefined;
    if (data.parent_goal_id === null || data.parent_goal_id === '') return null;
    if (!Number.isInteger(data.parent_goal_id) || data.parent_goal_id <= 0)
        throw new ValidationError('Invalid parent goal');
    return data.parent_goal_id;
}
function validatePeriod(data) {
    for (const name of ['period_start', 'period_end']) {
        const value = data[name];
        if (value == null) continue;
        if (
            typeof value !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
            Number.isNaN(Date.parse(value)) ||
            new Date(value).toISOString().slice(0, 10) !== value
        ) {
            throw new ValidationError('Goal periods must use valid ISO dates');
        }
    }
    if (
        data.period_start &&
        data.period_end &&
        data.period_start > data.period_end
    )
        throw new ValidationError(
            'Period end must be on or after period start'
        );
}
module.exports = {
    HORIZONS,
    lockOwner,
    validateGraph,
    validateHierarchy,
    resolveParent,
    validatePeriod,
};
