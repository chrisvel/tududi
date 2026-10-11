'use strict';
const { Op } = require('sequelize');
const models = require('../../models');

async function snapshot(userId) {
    const {
        Goal,
        Area,
        Task,
        Project,
        User,
        DailyPlan,
        DailyPlanItem,
        RecurringCompletion,
        LtdGoalMetric,
    } = models;
    const [goals, tasks, projects, user, plans] = await Promise.all([
        Goal.findAll({
            where: { user_id: userId },
            raw: true,
            nest: true,
            include: [
                {
                    model: Area,
                    where: { user_id: userId },
                    required: false,
                    attributes: ['id', 'uid', 'name', 'color'],
                },
            ],
            order: [['id', 'ASC']],
        }),
        Task.findAll({ where: { user_id: userId }, raw: true }),
        Project.findAll({ where: { user_id: userId }, raw: true }),
        User.findByPk(userId, { raw: true }),
        DailyPlan.findAll({ where: { user_id: userId }, raw: true }),
    ]);
    const [metrics, completions, planItems] = await Promise.all([
        goals.length
            ? LtdGoalMetric.findAll({
                  where: { goal_id: { [Op.in]: goals.map((g) => g.id) } },
                  raw: true,
              })
            : [],
        tasks.length
            ? RecurringCompletion.findAll({
                  where: { task_id: { [Op.in]: tasks.map((t) => t.id) } },
                  raw: true,
              })
            : [],
        plans.length
            ? DailyPlanItem.findAll({
                  where: { daily_plan_id: { [Op.in]: plans.map((p) => p.id) } },
                  raw: true,
              })
            : [],
    ]);
    return {
        goals,
        tasks,
        projects,
        user,
        plans,
        planItems,
        metrics,
        completions,
    };
}
module.exports = { snapshot };
