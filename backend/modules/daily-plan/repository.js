'use strict';

const { Op } = require('sequelize');
const {
    DailyPlan,
    DailyPlanItem,
    Task,
    InboxItem,
    sequelize,
} = require('../../models');
const { TASK_INCLUDES } = require('../tasks/utils/constants');

class DailyPlanRepository {
    async findPlan(userId, planDate) {
        return DailyPlan.findOne({
            where: { user_id: userId, plan_date: planDate },
            include: [{ model: DailyPlanItem, as: 'Items' }],
            order: [[{ model: DailyPlanItem, as: 'Items' }, 'position', 'ASC']],
        });
    }

    async findOrCreatePlan(userId, planDate, transaction) {
        const [plan] = await DailyPlan.findOrCreate({
            where: { user_id: userId, plan_date: planDate },
            defaults: { user_id: userId, plan_date: planDate },
            transaction,
        });
        return plan;
    }

    // Only tasks the user can currently see; a task whose share was revoked
    // silently drops out of the plan.
    async findVisibleTasksByIds(visibleWhere, ids) {
        if (ids.length === 0) return [];
        return Task.findAll({
            where: { [Op.and]: [visibleWhere, { id: { [Op.in]: ids } }] },
            include: TASK_INCLUDES,
        });
    }

    async findVisibleTasksByUids(visibleWhere, uids) {
        if (uids.length === 0) return [];
        return Task.findAll({
            where: { [Op.and]: [visibleWhere, { uid: { [Op.in]: uids } }] },
            attributes: ['id', 'uid', 'estimated_minutes'],
        });
    }

    async replaceItems(userId, planDate, rows) {
        return sequelize.transaction(async (transaction) => {
            const plan = await this.findOrCreatePlan(
                userId,
                planDate,
                transaction
            );
            await DailyPlanItem.destroy({
                where: { daily_plan_id: plan.id },
                transaction,
            });
            if (rows.length > 0) {
                await DailyPlanItem.bulkCreate(
                    rows.map((row) => ({ ...row, daily_plan_id: plan.id })),
                    { transaction }
                );
            }
            return plan;
        });
    }

    async markStarted(userId, planDate) {
        const plan = await this.findOrCreatePlan(userId, planDate);
        if (!plan.started_at) {
            await plan.update({ started_at: new Date() });
        }
        return plan;
    }

    async saveWrapUp(userId, planDate, wrapUp) {
        const plan = await this.findOrCreatePlan(userId, planDate);
        await plan.update({ ai_wrap_up: wrapUp });
        return plan;
    }

    async deletePlan(userId, planDate) {
        return sequelize.transaction(async (transaction) => {
            const plan = await DailyPlan.findOne({
                where: { user_id: userId, plan_date: planDate },
                transaction,
            });
            if (!plan) return false;
            await DailyPlanItem.destroy({
                where: { daily_plan_id: plan.id },
                transaction,
            });
            await plan.destroy({ transaction });
            return true;
        });
    }

    async findOpenInboxItems(userId, limit) {
        const where = { user_id: userId, status: 'added' };
        const [items, count] = await Promise.all([
            InboxItem.findAll({
                where,
                attributes: ['uid', 'title', 'content', 'created_at'],
                order: [['created_at', 'DESC']],
                limit,
            }),
            InboxItem.count({ where }),
        ]);
        return { items, count };
    }
}

module.exports = new DailyPlanRepository();
