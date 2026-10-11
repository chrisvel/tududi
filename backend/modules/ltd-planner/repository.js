'use strict';
const { Op } = require('sequelize');
const {
    sequelize,
    DailyPlan,
    DailyPlanItem,
    LtdFocusSession,
    Task,
} = require('../../models');
const { ConflictError } = require('../../shared/errors');

const rowOf = (item) => ({
    task_id: item.task_id,
    start_minute: item.start_minute,
    duration_minutes: item.duration_minutes,
});

async function planRows(userId, planDate, transaction) {
    const plan = await DailyPlan.findOne({
        where: { user_id: userId, plan_date: planDate },
        include: [{ model: DailyPlanItem, as: 'Items' }],
        order: [[{ model: DailyPlanItem, as: 'Items' }, 'position', 'ASC']],
        transaction,
    });
    return { plan, rows: (plan?.Items || []).map(rowOf) };
}

// Writes a day's items inside the caller's (journal) transaction.
async function writeRows(userId, planDate, rows, transaction) {
    const [plan] = await DailyPlan.findOrCreate({
        where: { user_id: userId, plan_date: planDate },
        defaults: { user_id: userId, plan_date: planDate },
        transaction,
    });
    await DailyPlanItem.destroy({
        where: { daily_plan_id: plan.id },
        transaction,
    });
    if (rows.length) {
        await DailyPlanItem.bulkCreate(
            rows.map((row, position) => ({
                ...row,
                position,
                daily_plan_id: plan.id,
            })),
            { transaction }
        );
    }
    return plan;
}

// Journal Undo for a Recovery: both days must still hold what Recovery
// wrote, otherwise newer edits would be lost.
async function restoreDays(userId, before, after, transaction) {
    for (const day of after.days) {
        const { rows } = await planRows(userId, day.date, transaction);
        if (JSON.stringify(rows) !== JSON.stringify(day.rows)) {
            throw new ConflictError(
                'This plan changed after the operation; undo newer changes first'
            );
        }
    }
    for (const day of before.days) {
        await writeRows(userId, day.date, day.rows, transaction);
    }
}

const finishedSessions = (userId, limit) =>
    LtdFocusSession.findAll({
        where: {
            user_id: userId,
            ended_at: { [Op.ne]: null },
            interrupted: false,
        },
        order: [['ended_at', 'DESC']],
        limit,
        raw: true,
    });

const sessionsBetween = (userId, start, end) =>
    LtdFocusSession.findAll({
        where: {
            user_id: userId,
            started_at: { [Op.between]: [start, end] },
        },
        raw: true,
    });

const tasksCompletedBetween = (userId, start, end) =>
    Task.findAll({
        where: {
            user_id: userId,
            completed_at: { [Op.between]: [start, end] },
        },
        attributes: ['id', 'uid', 'name', 'estimated_minutes'],
        raw: true,
    });

const tasksByIds = (userId, ids) =>
    ids.length
        ? Task.findAll({
              where: { user_id: userId, id: { [Op.in]: ids } },
              attributes: ['id', 'uid', 'name', 'estimated_minutes'],
              raw: true,
          })
        : [];

module.exports = {
    sequelize,
    planRows,
    writeRows,
    restoreDays,
    finishedSessions,
    sessionsBetween,
    tasksCompletedBetween,
    tasksByIds,
};
