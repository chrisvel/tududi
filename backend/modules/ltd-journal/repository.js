'use strict';
const { Op } = require('sequelize');
const {
    sequelize,
    LtdJournal,
    Goal,
    LtdGoalMetric,
    LtdMetricCheckin,
    Task,
    Project,
    LtdMilestone,
} = require('../../models');
const { NotFoundError } = require('../../shared/errors');
const metrics = require('../ltd-metrics/repository');
module.exports = {
    sequelize,
    create: (data, transaction) => LtdJournal.create(data, { transaction }),
    list: (userId) =>
        LtdJournal.findAll({
            where: { user_id: userId },
            order: [['id', 'DESC']],
            limit: 200,
        }),
    entries: (userId, uids, transaction) =>
        LtdJournal.findAll({
            where: { user_id: userId, uid: { [Op.in]: uids } },
            order: [['id', 'DESC']],
            transaction,
            lock: transaction.LOCK.UPDATE,
        }),
    async goal(userId, uid, transaction) {
        const goal = await Goal.findOne({
            where: { uid, user_id: userId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!goal) throw new NotFoundError('Goal not found');
        return goal;
    },
    async goalDependents(id, transaction) {
        const counts = await Promise.all([
            Goal.count({ where: { parent_goal_id: id }, transaction }),
            LtdGoalMetric.count({ where: { goal_id: id }, transaction }),
            Task.count({ where: { goal_id: id }, transaction }),
            Project.count({ where: { goal_id: id }, transaction }),
        ]);
        return counts.some((count) => count > 0);
    },
    metric: metrics.metric,
    metricExists: (uid, transaction) =>
        LtdGoalMetric.findOne({ where: { uid }, transaction }),
    createMetric: (data, transaction) =>
        LtdGoalMetric.create(data, { transaction }),
    createCheckins: (data, transaction) =>
        LtdMetricCheckin.bulkCreate(data, { transaction }),
    deleteCheckins: (metricId, transaction) =>
        LtdMetricCheckin.destroy({
            where: { metric_id: metricId },
            transaction,
        }),
    latestCheckin: (metricId, transaction) =>
        LtdMetricCheckin.findOne({
            where: { metric_id: metricId },
            order: [['id', 'DESC']],
            transaction,
        }),
    checkin: (uid, metricId, transaction) =>
        LtdMetricCheckin.findOne({
            where: { uid, metric_id: metricId },
            transaction,
        }),
    milestone: (userId, uid, transaction) =>
        LtdMilestone.findOne({
            where: { uid, user_id: userId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        }),
    createMilestone: (data, transaction) =>
        LtdMilestone.create(data, { transaction }),
    ownedGoalId: (userId, id, transaction) =>
        Goal.findOne({ where: { user_id: userId, id }, transaction }),
};
