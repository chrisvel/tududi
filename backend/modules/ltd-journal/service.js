'use strict';
const repository = require('./repository');
const {
    ValidationError,
    NotFoundError,
    ConflictError,
    ForbiddenError,
} = require('../../shared/errors');
const ACTORS = ['user', 'ai', 'mcp', 'system', 'sync'];
const decode = (value) =>
    typeof value === 'string' ? JSON.parse(value) : value;
const normalize = (value) =>
    value instanceof Date ? value.toISOString() : value;
const same = (left, right) =>
    JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));

function invalidate(userId) {
    require('../ltd-progress/service').invalidate(userId);
}
async function withJournal(actor, fn) {
    if (!actor?.user_id || !ACTORS.includes(actor.actor_type || 'user'))
        throw new ValidationError('A valid journal actor is required');
    return repository.sequelize.transaction(async (transaction) => {
        await require('../ltd-progress/hierarchy').lockOwner(
            actor.user_id,
            transaction
        );
        const record = async (entry) => {
            if (!entry?.op || !entry.entity_type || !entry.entity_uid)
                throw new ValidationError(
                    'A journal operation and entity are required'
                );
            if (
                ['ai', 'mcp'].includes(actor.actor_type) &&
                /delete|destroy/i.test(entry.op)
            )
                throw new ForbiddenError('AI and MCP cannot hard-delete');
            return repository.create(
                {
                    ...entry,
                    user_id: actor.user_id,
                    actor_type: actor.actor_type || 'user',
                    actor_id:
                        actor.actor_id == null ? null : String(actor.actor_id),
                },
                transaction
            );
        };
        const result = await fn(transaction, record);
        transaction.afterCommit(() => invalidate(actor.user_id));
        return result;
    });
}
function assertUnchanged(entity, fields) {
    for (const [key, value] of Object.entries(fields || {})) {
        if (key === 'checkin_uid' || key === 'checkins') continue;
        if (!same(entity[key], value))
            throw new ConflictError(
                'This item changed after the operation; undo newer changes first'
            );
    }
}
async function restore(entry, userId, transaction) {
    const before = decode(entry.before);
    const after = decode(entry.after);
    if (entry.entity_type === 'goal') {
        const goal = await repository.goal(
            userId,
            entry.entity_uid,
            transaction
        );
        assertUnchanged(goal, after);
        if (entry.op === 'goal_create') {
            if (await repository.goalDependents(goal.id, transaction))
                throw new ConflictError(
                    'Undo the goal’s child goals, metrics and links first'
                );
            await goal.destroy({ transaction });
            return;
        }
        if (!before || !after)
            throw new ConflictError('This goal operation cannot be undone');
        await require('../ltd-progress/hierarchy').validateHierarchy(
            userId,
            goal.id,
            before,
            transaction
        );
        await goal.update(before, { transaction });
        return;
    }
    if (entry.entity_type === 'daily_plan' && entry.op === 'recovery') {
        // T-504: Recovery moved open plan items to tomorrow.
        await require('../ltd-planner/repository').restoreDays(
            userId,
            before,
            after,
            transaction
        );
        return;
    }
    if (entry.entity_type === 'milestone') {
        // T-601: Life timeline milestones.
        const milestone = await repository.milestone(
            userId,
            entry.entity_uid,
            transaction
        );
        if (entry.op === 'milestone_delete') {
            if (milestone) throw new ConflictError('Milestone already exists');
            // A goal deleted since then would have nulled the link anyway.
            const goalId =
                before.goal_id &&
                (await repository.ownedGoalId(
                    userId,
                    before.goal_id,
                    transaction
                ))
                    ? before.goal_id
                    : null;
            await repository.createMilestone(
                { ...before, user_id: userId, goal_id: goalId },
                transaction
            );
            return;
        }
        if (!milestone) throw new NotFoundError('Milestone not found');
        assertUnchanged(milestone, after);
        if (entry.op === 'milestone_create')
            await milestone.destroy({ transaction });
        else if (entry.op === 'milestone_update')
            await milestone.update(before, { transaction });
        else
            throw new ConflictError(
                'This milestone operation cannot be undone'
            );
        return;
    }
    if (entry.entity_type !== 'metric')
        throw new ConflictError('This operation cannot be undone');
    if (entry.op === 'metric_delete') {
        if (await repository.metricExists(entry.entity_uid, transaction))
            throw new ConflictError('Metric already exists');
        if (
            !(await repository.ownedGoalId(userId, before.goal_id, transaction))
        )
            throw new NotFoundError('Goal not found');
        const { checkins, ...fields } = before;
        const restored = await repository.createMetric(fields, transaction);
        await repository.createCheckins(
            (checkins || []).map((checkin) => ({
                ...checkin,
                metric_id: restored.id,
            })),
            transaction
        );
        return;
    }
    const metric = await repository.metric(
        userId,
        entry.entity_uid,
        transaction
    );
    assertUnchanged(metric, after);
    if (entry.op === 'checkin') {
        const checkin = await repository.checkin(
            after.checkin_uid,
            metric.id,
            transaction
        );
        if (!checkin) throw new ConflictError('Check-in no longer exists');
        const latest = await repository.latestCheckin(metric.id, transaction);
        if (latest.uid !== checkin.uid)
            throw new ConflictError('Undo newer check-ins first');
        await checkin.destroy({ transaction });
        await metric.update(before, { transaction });
    } else if (entry.op === 'metric_create') {
        // A later check-in with the same value still needs to be undone first.
        const checkins = await metric.getCheckins({ transaction });
        if (checkins.length)
            throw new ConflictError('Undo this metric’s check-ins first');
        await metric.destroy({ transaction });
    } else if (entry.op === 'metric_update') {
        await metric.update(before, { transaction });
    } else {
        throw new ConflictError('This metric operation cannot be undone');
    }
}
async function revert(userId, uids) {
    if (
        !Array.isArray(uids) ||
        !uids.length ||
        uids.length > 200 ||
        uids.some((uid) => typeof uid !== 'string' || !uid) ||
        new Set(uids).size !== uids.length
    )
        throw new ValidationError('Provide 1 to 200 unique journal UIDs');
    return repository.sequelize.transaction(async (transaction) => {
        await require('../ltd-progress/hierarchy').lockOwner(
            userId,
            transaction
        );
        const entries = await repository.entries(userId, uids, transaction);
        if (entries.length !== uids.length)
            throw new NotFoundError('Journal entry not found');
        for (const entry of entries) {
            if (entry.reverted_at)
                throw new ConflictError(
                    'This operation has already been undone'
                );
            await restore(entry, userId, transaction);
            await entry.update({ reverted_at: new Date() }, { transaction });
        }
        transaction.afterCommit(() => invalidate(userId));
        return entries;
    });
}
module.exports = { withJournal, revert, list: repository.list };
