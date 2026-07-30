'use strict';

const { Goal, Area, Project, Task, sequelize } = require('../../models');
const { Op } = require('sequelize');

class GoalsRepository {
    async _attachCounts(goals, userId) {
        if (goals.length === 0) return [];

        const goalIds = goals.map((g) => g.id);

        const [projectCounts, taskCounts] = await Promise.all([
            Project.findAll({
                where: { goal_id: { [Op.in]: goalIds }, user_id: userId },
                attributes: [
                    'goal_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['goal_id'],
                raw: true,
            }),
            Task.findAll({
                where: {
                    goal_id: { [Op.in]: goalIds },
                    user_id: userId,
                    parent_task_id: null,
                },
                attributes: [
                    'goal_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['goal_id'],
                raw: true,
            }),
        ]);

        const projectMap = {};
        projectCounts.forEach((r) => {
            projectMap[r.goal_id] = parseInt(r.count, 10);
        });
        const taskMap = {};
        taskCounts.forEach((r) => {
            taskMap[r.goal_id] = parseInt(r.count, 10);
        });

        return goals.map((goal) => ({
            ...goal.toJSON(),
            projects_count: projectMap[goal.id] || 0,
            tasks_count: taskMap[goal.id] || 0,
        }));
    }

    async findAllByUser(userId) {
        const goals = await Goal.findAll({
            where: { user_id: userId },
            include: [
                { model: Area, attributes: ['id', 'uid', 'name', 'color'] },
            ],
            order: [['title', 'ASC']],
        });
        return this._attachCounts(goals, userId);
    }

    async findAllByArea(userId, areaId) {
        const goals = await Goal.findAll({
            where: { user_id: userId, area_id: areaId },
            include: [
                { model: Area, attributes: ['id', 'uid', 'name', 'color'] },
            ],
            order: [['title', 'ASC']],
        });
        return this._attachCounts(goals, userId);
    }

    async findByUid(userId, uid) {
        return Goal.findOne({
            where: { uid, user_id: userId },
            include: [
                { model: Area, attributes: ['id', 'uid', 'name', 'color'] },
                {
                    model: Project,
                    as: 'Projects',
                    where: { user_id: userId },
                    required: false,
                    attributes: ['id', 'uid', 'name', 'status', 'color'],
                },
                {
                    model: Task,
                    as: 'Tasks',
                    where: { user_id: userId },
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'name',
                        'status',
                        'priority',
                        'due_date',
                        'project_id',
                        'area_id',
                    ],
                },
            ],
        });
    }

    async create(data) {
        return Goal.create(data);
    }

    async update(goal, data) {
        return goal.update(data);
    }

    async delete(goal) {
        return goal.destroy();
    }

    async countActiveByUser(userId) {
        return Goal.count({ where: { user_id: userId, status: 'active' } });
    }
}

module.exports = new GoalsRepository();
