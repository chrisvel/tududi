'use strict';

// Life-to-Day (T-704): the typed operations a Proposal may carry (blueprint
// 16.2) and how each is applied. Every write goes through the Journal with
// the proposal id, so Undo restores exactly the state before.
const { Area, Task } = require('../../models');
const goalsService = require('../goals/service');
const plannerRepository = require('../ltd-planner/repository');
const { withJournal } = require('../ltd-journal/service');
const {
    getSafeTimezone,
    processDueDateForStorage,
} = require('../../utils/timezone-utils');
const {
    NotFoundError,
    ConflictError,
    ValidationError,
} = require('../../shared/errors');

const aiOps = require('./ai-ops');
const TYPES = [
    'create_goal',
    'schedule_block',
    'update_task',
    'create_task',
    'move_block',
    // T-1104: life lessons from MCP, applied through the lessons service.
    'create_lesson',
    'update_lesson',
];

// A lesson op is checked again on apply: a goal deleted since is a 404.
async function applyLesson(user, op, actor) {
    const lessons = require('../ltd-lessons/service');
    const links = op.links?.map(({ type, uid }) => ({ type, uid }));
    if (op.type === 'create_lesson') {
        // eslint-disable-next-line no-unused-vars
        const { id, type, result, error, ...fields } = op;
        const { lesson } = await lessons.create(
            user.id,
            { ...fields, links },
            actor
        );
        return { lesson_uid: lesson.uid };
    }
    await lessons.update(
        user.id,
        op.lesson_uid,
        { ...op.changes, ...(links ? { links } : {}) },
        actor
    );
    return {};
}

async function createGoal(user, op, actor) {
    let areaId = null;
    if (op.area_uid) {
        const area = await Area.findOne({
            where: { uid: op.area_uid, user_id: user.id },
        });
        if (!area) throw new NotFoundError('Area not found');
        areaId = area.id;
    }
    const goal = await goalsService.create(
        user.id,
        {
            title: op.title,
            horizon: op.horizon,
            period_start: op.period_start,
            period_end: op.period_end,
            why: op.why || null,
            target_date: op.target_date || null,
            parent_goal_uid: op.parent_goal_uid || undefined,
            area_id: areaId,
        },
        actor
    );
    return { goal_uid: goal.uid };
}

const overlaps = (row, op) =>
    row.start_minute !== null &&
    op.start_minute < row.start_minute + row.duration_minutes &&
    row.start_minute < op.start_minute + op.duration_minutes;

// All blocks of one day in one Journal entry. A block whose task is gone,
// already planned, or whose slot was taken since is skipped, not forced.
async function scheduleBlocks(user, date, ops, actor) {
    const results = {};
    await withJournal(actor, async (transaction, record) => {
        const { plan, rows } = await plannerRepository.planRows(
            user.id,
            date,
            transaction
        );
        const tasks = await Task.findAll({
            where: { user_id: user.id, uid: ops.map((op) => op.task_uid) },
            transaction,
        });
        const byUid = new Map(tasks.map((task) => [task.uid, task]));
        const next = [...rows];
        for (const op of ops) {
            const task = byUid.get(op.task_uid);
            const error = !task
                ? 'Task not found'
                : next.some((row) => row.task_id === task.id)
                  ? 'Task is already planned on this day'
                  : next.some((row) => overlaps(row, op))
                    ? 'This time slot is no longer free'
                    : null;
            if (error) {
                results[op.id] = { error };
                continue;
            }
            next.push({
                task_id: task.id,
                start_minute: op.start_minute,
                duration_minutes: op.duration_minutes,
            });
            results[op.id] = {};
        }
        if (next.length === rows.length) return;
        const written = await plannerRepository.writeRows(
            user.id,
            date,
            next,
            transaction
        );
        await record({
            op: 'plan_blocks',
            entity_type: 'daily_plan',
            entity_uid: written.uid,
            before: { days: [{ date, rows, existed: !!plan }] },
            after: { days: [{ date, rows: next }] },
        });
    });
    return results;
}

// A due date change; refused when the date moved since the proposal.
async function updateTask(user, op, actor) {
    if (op.field !== 'due_date')
        throw new ValidationError('Only due dates can be changed');
    return withJournal(actor, async (transaction, record) => {
        const task = await Task.findOne({
            where: { uid: op.task_uid, user_id: user.id },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!task) throw new NotFoundError('Task not found');
        const current = task.due_date
            ? new Date(task.due_date).toISOString()
            : null;
        if (current !== (op.before ?? null))
            throw new ConflictError(
                'The due date changed after this proposal was made'
            );
        const due = processDueDateForStorage(
            op.after,
            getSafeTimezone(user.timezone)
        );
        await task.update({ due_date: due }, { transaction });
        await record({
            op: 'task_update',
            entity_type: 'task',
            entity_uid: task.uid,
            before: { due_date: current },
            after: { due_date: due ? due.toISOString() : null },
        });
        return {};
    });
}

// Applies the selected ops; returns { [opId]: { error? } }.
async function applyOps(user, ops, actor) {
    const results = {};
    const aiPlanOps = ops.filter((o) =>
        ['move_block', 'schedule_block'].includes(o.type)
    );
    if (actor.actor_type === 'ai' && aiPlanOps.length) {
        try {
            Object.assign(results, await aiOps.plan(user, aiPlanOps, actor));
        } catch (error) {
            for (const op of aiPlanOps)
                results[op.id] = { error: error.message };
        }
    }
    const byDate = new Map();
    for (const op of ops) {
        if (op.type !== 'schedule_block' || actor.actor_type === 'ai') continue;
        byDate.set(op.date, [...(byDate.get(op.date) || []), op]);
    }
    for (const [date, blocks] of byDate) {
        try {
            Object.assign(
                results,
                await scheduleBlocks(user, date, blocks, actor)
            );
        } catch (error) {
            for (const op of blocks) results[op.id] = { error: error.message };
        }
    }
    for (const op of ops) {
        if (['schedule_block', 'move_block'].includes(op.type)) continue;
        try {
            results[op.id] =
                op.type === 'create_task'
                    ? await aiOps.createTask(user, op, actor)
                    : op.type === 'create_goal'
                      ? await createGoal(user, op, actor)
                      : op.type.endsWith('_lesson')
                        ? await applyLesson(user, op, actor)
                        : await updateTask(user, op, actor);
        } catch (error) {
            results[op.id] = { error: error.message };
        }
    }
    return results;
}

module.exports = { TYPES, applyOps };
