'use strict';
// T-803: additive operations on the existing Proposal/Journal engine.
const { Task, Goal } = require('../../models');
const { withJournal } = require('../ltd-journal/service');
const planner = require('../ltd-planner/ai-plan');
const plans = require('../ltd-planner/repository');
const { ValidationError } = require('../../shared/errors');
async function createTask(user, op, actor) {
    return withJournal(actor, async (transaction, record) => {
        let parent = null,
            goal = null;
        if (op.parent_task_uid)
            parent = await Task.findOne({
                where: { user_id: user.id, uid: op.parent_task_uid },
                transaction,
            });
        if (op.goal_uid)
            goal = await Goal.findOne({
                where: { user_id: user.id, uid: op.goal_uid, status: 'active' },
                transaction,
            });
        if ((!parent && !goal) || (parent && [2, 3, 5].includes(parent.status)))
            throw new ValidationError('Parent no longer available');
        if (
            typeof op.title !== 'string' ||
            !op.title.trim() ||
            !Number.isInteger(op.est_min) ||
            op.est_min < 1 ||
            op.est_min > 480
        )
            throw new ValidationError('Invalid task step');
        const fields = {
            name: op.title,
            estimated_minutes: op.est_min,
            starter_step: op.starter_step,
            user_id: user.id,
            parent_task_id: parent?.id || null,
            project_id: parent?.project_id || null,
            goal_id: goal?.id || parent?.goal_id || null,
            status: 0,
        };
        const task = await Task.create(fields, { transaction });
        await record({
            op: 'ai_task_create',
            entity_type: 'task',
            entity_uid: task.uid,
            before: null,
            after: fields,
        });
        return { task_uid: task.uid };
    });
}
async function plan(user, ops, actor) {
    return withJournal(actor, async (transaction, record) => {
        const days = await planner.validate(user, ops, transaction);
        const before = [],
            after = [];
        let uid;
        for (const d of days) {
            const written = await plans.writeRows(
                user.id,
                d.date,
                d.rows,
                transaction
            );
            uid = written.uid;
            before.push({ date: d.date, rows: d.before, existed: !!d.plan });
            after.push({ date: d.date, rows: d.rows });
        }
        if (uid)
            await record({
                op: 'plan_blocks',
                entity_type: 'daily_plan',
                entity_uid: uid,
                before: { days: before },
                after: { days: after },
            });
        return Object.fromEntries(ops.map((o) => [o.id, {}]));
    });
}
module.exports = { createTask, plan };
