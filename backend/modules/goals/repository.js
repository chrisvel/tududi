'use strict';

const { Goal, Area, Project, Task, sequelize } = require('../../models');
const { Op } = require('sequelize');
const permissionsService = require('../../services/permissionsService');

const visibleWhere = (resourceType, userId) =>
    permissionsService.ownershipOrPermissionWhere(resourceType, userId);

const AREA_INCLUDE = {
    model: Area,
    attributes: ['id', 'uid', 'name', 'color'],
};

class GoalsRepository {
    async _attachCounts(goals, userId) {
        if (goals.length === 0) return [];

        const goalIds = goals.map((g) => g.id);
        const [projectWhere, taskWhere] = await Promise.all([
            visibleWhere('project', userId),
            visibleWhere('task', userId),
        ]);

        const [projectCounts, taskCounts] = await Promise.all([
            Project.findAll({
                where: {
                    [Op.and]: [{ goal_id: { [Op.in]: goalIds } }, projectWhere],
                },
                attributes: [
                    'goal_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['goal_id'],
                raw: true,
            }),
            Task.findAll({
                where: {
                    [Op.and]: [
                        { goal_id: { [Op.in]: goalIds }, parent_task_id: null },
                        taskWhere,
                    ],
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

    // Goals the user owns or has been shared.
    async findAllByUser(userId) {
        const goals = await Goal.findAll({
            where: await visibleWhere('goal', userId),
            include: [AREA_INCLUDE],
            order: [['title', 'ASC']],
        });
        return this._attachCounts(goals, userId);
    }

    async findAllByArea(userId, areaId) {
        const goals = await Goal.findAll({
            where: {
                [Op.and]: [
                    { area_id: areaId },
                    await visibleWhere('goal', userId),
                ],
            },
            include: [AREA_INCLUDE],
            order: [['title', 'ASC']],
        });
        return this._attachCounts(goals, userId);
    }

    // A goal whoever owns it, with the projects and tasks in it that the user
    // can see. The caller checks access to the goal itself.
    async findVisibleByUid(userId, uid) {
        const [projectWhere, taskWhere] = await Promise.all([
            visibleWhere('project', userId),
            visibleWhere('task', userId),
        ]);
        return Goal.findOne({
            where: { uid },
            include: [
                AREA_INCLUDE,
                {
                    model: Project,
                    as: 'Projects',
                    where: projectWhere,
                    required: false,
                    attributes: ['id', 'uid', 'name', 'status', 'color'],
                },
                {
                    model: Task,
                    as: 'Tasks',
                    where: taskWhere,
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

    async findByUid(userId, uid) {
        return Goal.findOne({
            where: { uid, user_id: userId },
            include: [
                AREA_INCLUDE,
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
