'use strict';

// Life-to-Day (T-601): Life timeline milestones (blueprint 13.3). Dates are
// ISO Gregorian days; Jalali is a display concern of the client. Writes go
// through the Journal so each one can be undone, and only a human may delete.
const { Op } = require('sequelize');
const { LtdMilestone, Goal } = require('../../models');
const journal = require('../ltd-journal/service');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
} = require('../../shared/errors');

const PRECISIONS = ['day', 'month', 'year'];
const KINDS = ['life_event', 'goal_milestone'];
const FIELDS = ['title', 'date', 'date_precision', 'kind', 'note', 'color'];
const MAX_NOTE = 10000;

// A real Gregorian day in YYYY-MM-DD form; 2026-02-30 is rejected. Years
// before 1600 are refused so a Jalali date (1403-07-01) cannot pass as ISO.
function isoDay(value, field) {
    if (
        typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        value < '1600' ||
        value >= '3000'
    )
        throw new ValidationError(
            `${field} must be a Gregorian ISO date (YYYY-MM-DD, 1600–2999)`
        );
    const parsed = new Date(`${value}T00:00:00Z`);
    if (
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== value
    )
        throw new ValidationError(`${field} is not a valid date`);
    return value;
}

function validate(data, create = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new ValidationError('Milestone data is required');
    const fields = {};
    for (const field of FIELDS)
        if (data[field] !== undefined) fields[field] = data[field];
    if (create || fields.title !== undefined) {
        if (
            typeof fields.title !== 'string' ||
            !fields.title.trim() ||
            fields.title.length > 255
        )
            throw new ValidationError(
                'Milestone title is required (maximum 255 characters)'
            );
        fields.title = fields.title.trim();
    }
    if (create || fields.date !== undefined) isoDay(fields.date, 'date');
    if (
        fields.date_precision !== undefined &&
        !PRECISIONS.includes(fields.date_precision)
    )
        throw new ValidationError('date_precision must be day, month or year');
    if (fields.kind !== undefined && !KINDS.includes(fields.kind))
        throw new ValidationError('kind must be life_event or goal_milestone');
    if (
        fields.note != null &&
        (typeof fields.note !== 'string' || fields.note.length > MAX_NOTE)
    )
        throw new ValidationError(
            `note must be text (maximum ${MAX_NOTE} characters)`
        );
    if (fields.note === '') fields.note = null;
    if (
        fields.color != null &&
        (typeof fields.color !== 'string' || fields.color.length > 32)
    )
        throw new ValidationError('color must be text (maximum 32 characters)');
    if (fields.color === '') fields.color = null;
    if (
        data.goal_uid !== undefined &&
        data.goal_uid !== null &&
        (typeof data.goal_uid !== 'string' || !data.goal_uid)
    )
        throw new ValidationError('goal_uid must be a goal UID or null');
    return fields;
}

// Another user's goal is indistinguishable from a missing one: 404, never a
// silent unlinked save.
async function ownGoal(userId, goalUid, transaction) {
    if (goalUid == null) return null;
    const goal = await Goal.findOne({
        where: { uid: goalUid, user_id: userId },
        attributes: ['id', 'uid'],
        transaction,
    });
    if (!goal) throw new NotFoundError('Goal not found');
    return goal;
}

async function find(userId, uid, transaction) {
    const milestone = await LtdMilestone.findOne({
        where: { uid, user_id: userId },
        include: [{ model: Goal, as: 'Goal', attributes: ['uid'] }],
        transaction,
        // PostgreSQL refuses FOR UPDATE on the nullable side of the join.
        ...(transaction
            ? { lock: { level: transaction.LOCK.UPDATE, of: LtdMilestone } }
            : {}),
    });
    if (!milestone) throw new NotFoundError('Milestone not found');
    return milestone;
}

function serialize(milestone, goalUid = milestone.Goal?.uid ?? null) {
    return {
        uid: milestone.uid,
        title: milestone.title,
        date: milestone.date,
        date_precision: milestone.date_precision,
        kind: milestone.kind,
        goal_uid: milestone.goal_id == null ? null : goalUid,
        note: milestone.note,
        color: milestone.color,
        created_at: milestone.created_at,
        updated_at: milestone.updated_at,
    };
}

// The journal keeps raw columns so Undo can restore the row as it was.
const snapshot = (milestone) =>
    Object.fromEntries(
        ['uid', 'user_id', 'goal_id', ...FIELDS].map((key) => [
            key,
            milestone[key],
        ])
    );

const actorFor = (userId, actor) => ({
    ...actor,
    user_id: userId,
    actor_type: actor?.actor_type || 'user',
});

async function list(userId, query = {}) {
    const date = {};
    if (query.from !== undefined) date[Op.gte] = isoDay(query.from, 'from');
    if (query.to !== undefined) date[Op.lte] = isoDay(query.to, 'to');
    if (
        query.from !== undefined &&
        query.to !== undefined &&
        query.from > query.to
    )
        throw new ValidationError('from must not be after to');
    const rows = await LtdMilestone.findAll({
        where: {
            user_id: userId,
            ...(Reflect.ownKeys(date).length ? { date } : {}),
        },
        include: [{ model: Goal, as: 'Goal', attributes: ['uid'] }],
        order: [
            ['date', 'ASC'],
            ['id', 'ASC'],
        ],
    });
    return rows.map((row) => serialize(row));
}

async function create(userId, data, actor) {
    const fields = validate(data, true);
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const goal = await ownGoal(userId, data.goal_uid, transaction);
            const milestone = await LtdMilestone.create(
                {
                    ...fields,
                    date_precision: fields.date_precision || 'day',
                    kind:
                        fields.kind || (goal ? 'goal_milestone' : 'life_event'),
                    goal_id: goal?.id ?? null,
                    user_id: userId,
                },
                { transaction }
            );
            await record({
                op: 'milestone_create',
                entity_type: 'milestone',
                entity_uid: milestone.uid,
                before: null,
                after: snapshot(milestone),
            });
            return serialize(milestone, goal?.uid ?? null);
        }
    );
}

async function update(userId, uid, data, actor) {
    const fields = validate(data);
    return journal.withJournal(
        actorFor(userId, actor),
        async (transaction, record) => {
            const milestone = await find(userId, uid, transaction);
            let goalUid = milestone.Goal?.uid ?? null;
            if (data.goal_uid !== undefined) {
                const goal = await ownGoal(userId, data.goal_uid, transaction);
                fields.goal_id = goal?.id ?? null;
                goalUid = goal?.uid ?? null;
            }
            const before = Object.fromEntries(
                Object.keys(fields).map((key) => [key, milestone[key]])
            );
            await milestone.update(fields, { transaction });
            await record({
                op: 'milestone_update',
                entity_type: 'milestone',
                entity_uid: milestone.uid,
                before,
                after: fields,
            });
            return serialize(milestone, goalUid);
        }
    );
}

async function remove(userId, uid, actor) {
    const effectiveActor = actorFor(userId, actor);
    if (effectiveActor.actor_type !== 'user')
        throw new ForbiddenError('Only a human user can delete a milestone');
    return journal.withJournal(effectiveActor, async (transaction, record) => {
        const milestone = await find(userId, uid, transaction);
        const before = snapshot(milestone);
        await milestone.destroy({ transaction });
        const entry = await record({
            op: 'milestone_delete',
            entity_type: 'milestone',
            entity_uid: milestone.uid,
            before,
            after: null,
        });
        return { journal_uid: entry.uid };
    });
}

module.exports = { list, create, update, remove, validate, isoDay };
