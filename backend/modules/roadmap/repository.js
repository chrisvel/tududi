'use strict';

const { Op } = require('sequelize');
const {
    Area,
    Goal,
    Project,
    Task,
    UserAreaOrder,
    UserProjectArea,
} = require('../../models');
const permissionsService = require('../../services/permissionsService');

const visibleWhere = (resourceType, userId) =>
    permissionsService.ownershipOrPermissionWhere(resourceType, userId);

class RoadmapRepository {
    async findAreaByUid(uid) {
        return Area.findOne({
            where: { uid },
            attributes: ['id', 'uid'],
            raw: true,
        });
    }

    async findVisibleAreas(userId) {
        return Area.findAll({
            where: await visibleWhere('area', userId),
            attributes: ['id', 'uid', 'name', 'color'],
            order: [['name', 'ASC']],
            raw: true,
        });
    }

    async findAreaPositions(userId) {
        const rows = await UserAreaOrder.findAll({
            where: { user_id: userId },
            attributes: ['area_id', 'position'],
            raw: true,
        });
        return new Map(rows.map((row) => [row.area_id, row.position]));
    }

    async findVisibleProjects(userId) {
        const projects = await Project.findAll({
            where: await visibleWhere('project', userId),
            attributes: [
                'id',
                'uid',
                'name',
                'status',
                'area_id',
                'user_id',
                'start_date_at',
                'due_date_at',
            ],
            order: [['name', 'ASC']],
        });
        return projects.map((project) => project.get({ plain: true }));
    }

    async findAreaOverrides(userId) {
        const rows = await UserProjectArea.findAll({
            where: { user_id: userId },
            attributes: ['project_id', 'area_id'],
            raw: true,
        });
        return new Map(rows.map((row) => [row.project_id, row.area_id]));
    }

    // Top-level tasks of the given projects. Finished ones stay in because
    // they set a project's early start.
    async findProjectTasks(userId, projectIds) {
        if (projectIds.length === 0) return [];
        const tasks = await Task.findAll({
            where: {
                [Op.and]: [
                    { project_id: { [Op.in]: projectIds } },
                    { parent_task_id: null },
                    { recurring_parent_id: null },
                    { habit_mode: false },
                    {
                        status: {
                            [Op.notIn]: [
                                Task.STATUS.ARCHIVED,
                                Task.STATUS.CANCELLED,
                            ],
                        },
                    },
                    await visibleWhere('task', userId),
                ],
            },
            attributes: [
                'uid',
                'name',
                'status',
                'project_id',
                'start_date',
                'due_date',
            ],
            order: [['id', 'ASC']],
        });
        return tasks.map((task) => task.get({ plain: true }));
    }

    async findDatedGoals(userId, areaId) {
        return Goal.findAll({
            where: {
                [Op.and]: [
                    await visibleWhere('goal', userId),
                    { target_date: { [Op.ne]: null } },
                    { status: { [Op.in]: ['active', 'achieved'] } },
                    ...(areaId ? [{ area_id: areaId }] : []),
                ],
            },
            attributes: ['uid', 'title', 'target_date', 'status'],
            include: [{ model: Area, attributes: ['uid'] }],
            order: [['target_date', 'ASC']],
        });
    }
}

module.exports = new RoadmapRepository();
