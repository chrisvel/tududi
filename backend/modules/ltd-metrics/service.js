'use strict';
const repository = require('./repository');
const journal = require('../ltd-journal/service');
const { ValidationError, ForbiddenError } = require('../../shared/errors');
const EDITABLE = [
    'name',
    'unit',
    'baseline',
    'target',
    'direction',
    'weight',
    'source',
];
const snapshot = (metric) =>
    Object.fromEntries(
        ['id', 'uid', 'goal_id', ...EDITABLE, 'current_value'].map((key) => [
            key,
            metric[key],
        ])
    );
const actorFor = (userId, actor) => ({
    ...actor,
    user_id: userId,
    actor_type: actor?.actor_type || 'user',
});

function validate(data, create = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new ValidationError('Metric data is required');
    const updates = {};
    for (const field of EDITABLE)
        if (data[field] !== undefined) updates[field] = data[field];
    if (create || updates.name !== undefined) {
        if (
            typeof updates.name !== 'string' ||
            !updates.name.trim() ||
            updates.name.length > 255
        )
            throw new ValidationError(
                'Metric name is required (maximum 255 characters)'
            );
        updates.name = updates.name.trim();
    }
    for (const field of ['baseline', 'target']) {
        if (
            (create || updates[field] !== undefined) &&
            (typeof updates[field] !== 'number' ||
                !Number.isFinite(updates[field]))
        )
            throw new ValidationError(`${field} must be a finite number`);
    }
    if (
        updates.weight !== undefined &&
        (typeof updates.weight !== 'number' ||
            !Number.isFinite(updates.weight) ||
            updates.weight <= 0)
    )
        throw new ValidationError('weight must be a positive finite number');
    if (
        updates.direction !== undefined &&
        !['increase', 'decrease'].includes(updates.direction)
    )
        throw new ValidationError('Invalid metric direction');
    if (
        updates.source !== undefined &&
        !['manual', 'habit', 'task_count'].includes(updates.source)
    )
        throw new ValidationError('Invalid metric source');
    if (
        updates.unit !== undefined &&
        updates.unit !== null &&
        (typeof updates.unit !== 'string' || updates.unit.length > 255)
    )
        throw new ValidationError('unit must be text (maximum 255 characters)');
    if (data.current_value !== undefined)
        throw new ValidationError('Use a check-in to change current_value');
    return updates;
}
async function list(userId, goalUid) {
    const goal = await repository.goal(userId, goalUid);
    return repository.list(goal.id);
}
async function create(userId, goalUid, data, actor) {
    const fields = validate(data, true);
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const goal = await repository.goal(userId, goalUid, transaction);
            const metric = await repository.create(
                { ...fields, goal_id: goal.id, current_value: fields.baseline },
                transaction
            );
            await record({
                op: 'metric_create',
                entity_type: 'metric',
                entity_uid: metric.uid,
                before: null,
                after: snapshot(metric),
            });
            return metric;
        }
    );
}
async function update(userId, metricUid, data, actor) {
    const fields = validate(data);
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const metric = await repository.metric(
                userId,
                metricUid,
                transaction
            );
            const before = Object.fromEntries(
                Object.keys(fields).map((key) => [key, metric[key]])
            );
            await metric.update(fields, { transaction });
            await record({
                op: 'metric_update',
                entity_type: 'metric',
                entity_uid: metric.uid,
                before,
                after: fields,
            });
            return metric;
        }
    );
}
async function remove(userId, metricUid, actor) {
    const effectiveActor = actorFor(userId, actor);
    if (effectiveActor.actor_type !== 'user')
        throw new ForbiddenError('Only a human user can delete a metric');
    return journal.withJournal(effectiveActor, async (transaction, record) => {
        const metric = await repository.metric(userId, metricUid, transaction);
        const before = snapshot(metric);
        // Retain check-ins in the journal so human deletion is also reversible.
        before.checkins = (await metric.getCheckins({ transaction })).map(
            (entry) => entry.toJSON()
        );
        await require('../ltd-journal/repository').deleteCheckins(
            metric.id,
            transaction
        );
        await metric.destroy({ transaction });
        await record({
            op: 'metric_delete',
            entity_type: 'metric',
            entity_uid: metric.uid,
            before,
            after: null,
        });
    });
}
async function checkin(userId, metricUid, data, actor) {
    if (!data || typeof data.value !== 'number' || !Number.isFinite(data.value))
        throw new ValidationError('Check-in value must be a finite number');
    if (
        data.note != null &&
        (typeof data.note !== 'string' || data.note.length > 10000)
    )
        throw new ValidationError(
            'Check-in note must be text (maximum 10000 characters)'
        );
    const date =
        data.recorded_at === undefined
            ? new Date()
            : new Date(data.recorded_at);
    if (!Number.isFinite(date.getTime()))
        throw new ValidationError('Invalid check-in date');
    const effectiveActor = actorFor(userId, actor);
    return journal.withJournal(effectiveActor, async (transaction, record) => {
        const metric = await repository.metric(userId, metricUid, transaction);
        const before = { current_value: metric.current_value };
        const checkin = await repository.checkin(
            {
                metric_id: metric.id,
                value: data.value,
                note: data.note || null,
                recorded_at: date,
                source: ['ai', 'mcp'].includes(effectiveActor.actor_type)
                    ? effectiveActor.actor_type
                    : 'user',
            },
            transaction
        );
        await metric.update({ current_value: data.value }, { transaction });
        const entry = await record({
            op: 'checkin',
            entity_type: 'metric',
            entity_uid: metric.uid,
            before,
            after: { current_value: data.value, checkin_uid: checkin.uid },
        });
        return { metric, checkin, journal_uid: entry.uid };
    });
}
module.exports = { list, create, update, remove, checkin, validate };
