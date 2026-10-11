'use strict';
const { Goal, LtdGoalMetric, LtdMetricCheckin } = require('../../models');
const { NotFoundError } = require('../../shared/errors');

async function goal(userId, goalUid, transaction) {
    const found = await Goal.findOne({
        where: { uid: goalUid, user_id: userId },
        transaction,
    });
    if (!found) throw new NotFoundError('Goal not found');
    return found;
}
async function metric(userId, metricUid, transaction) {
    const found = await LtdGoalMetric.findOne({
        where: { uid: metricUid },
        include: [
            {
                model: Goal,
                as: 'Goal',
                attributes: ['id', 'uid', 'user_id'],
                where: { user_id: userId },
            },
        ],
        transaction,
        ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!found) throw new NotFoundError('Metric not found');
    return found;
}
async function list(goalId) {
    return LtdGoalMetric.findAll({
        where: { goal_id: goalId },
        include: [{ model: LtdMetricCheckin, as: 'checkins' }],
        order: [
            ['id', 'ASC'],
            [
                { model: LtdMetricCheckin, as: 'checkins' },
                'recorded_at',
                'DESC',
            ],
        ],
    });
}
module.exports = {
    goal,
    metric,
    list,
    create: (data, transaction) => LtdGoalMetric.create(data, { transaction }),
    checkin: (data, transaction) =>
        LtdMetricCheckin.create(data, { transaction }),
};
