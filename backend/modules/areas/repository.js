'use strict';

const { Area, Project, Goal, Task, sequelize } = require('../../models');
const { Op } = require('sequelize');
const BaseRepository = require('../../shared/database/BaseRepository');
const permissionsService = require('../../services/permissionsService');

const PUBLIC_ATTRIBUTES = ['uid', 'name', 'description', 'color'];
const LIST_ATTRIBUTES = ['id', 'uid', 'name', 'description', 'color'];

class AreasRepository extends BaseRepository {
    constructor() {
        super(Area);
    }

    /**
     * Find all areas a user owns or has been shared, with counts of the
     * projects, goals, and tasks in them that the user can see.
     */
    async findAllByUser(userId) {
        const [areaWhere, projectWhere, goalWhere, taskWhere] =
            await Promise.all([
                permissionsService.ownershipOrPermissionWhere('area', userId),
                permissionsService.ownershipOrPermissionWhere(
                    'project',
                    userId
                ),
                permissionsService.ownershipOrPermissionWhere('goal', userId),
                permissionsService.ownershipOrPermissionWhere('task', userId),
            ]);

        const areas = await this.model.findAll({
            where: areaWhere,
            attributes: LIST_ATTRIBUTES,
            order: [['name', 'ASC']],
        });

        if (areas.length === 0) return [];

        const areaIds = areas.map((a) => a.id);

        const [projectCounts, goalCounts, taskCounts] = await Promise.all([
            Project.findAll({
                where: {
                    [Op.and]: [{ area_id: { [Op.in]: areaIds } }, projectWhere],
                },
                attributes: [
                    'area_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['area_id'],
                raw: true,
            }),
            Goal.findAll({
                where: {
                    [Op.and]: [{ area_id: { [Op.in]: areaIds } }, goalWhere],
                },
                attributes: [
                    'area_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['area_id'],
                raw: true,
            }),
            Task.findAll({
                where: {
                    [Op.and]: [
                        { area_id: { [Op.in]: areaIds }, parent_task_id: null },
                        taskWhere,
                    ],
                },
                attributes: [
                    'area_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['area_id'],
                raw: true,
            }),
        ]);

        const projectMap = {};
        projectCounts.forEach((r) => {
            projectMap[r.area_id] = parseInt(r.count, 10);
        });
        const goalMap = {};
        goalCounts.forEach((r) => {
            goalMap[r.area_id] = parseInt(r.count, 10);
        });
        const taskMap = {};
        taskCounts.forEach((r) => {
            taskMap[r.area_id] = parseInt(r.count, 10);
        });

        return areas.map((area) => ({
            ...area.toJSON(),
            projects_count: projectMap[area.id] || 0,
            goals_count: goalMap[area.id] || 0,
            tasks_count: taskMap[area.id] || 0,
        }));
    }

    /**
     * Find an area by UID for a specific user.
     */
    async findByUid(userId, uid) {
        return this.model.findOne({
            where: {
                uid,
                user_id: userId,
            },
        });
    }

    /**
     * Find an area by UID with public attributes only.
     */
    async findByUidPublic(userId, uid) {
        return this.model.findOne({
            where: {
                uid,
                user_id: userId,
            },
            attributes: PUBLIC_ATTRIBUTES,
        });
    }

    /**
     * Find an area by UID whoever owns it; the caller checks access, so
     * areas shared with the user are found too.
     */
    async findAnyByUid(uid, attributes) {
        return this.model.findOne({ where: { uid }, attributes });
    }

    /**
     * Create a new area for a user.
     */
    async createForUser(userId, { name, description, color }) {
        return this.model.create({
            name,
            description: description || '',
            color: color || null,
            user_id: userId,
        });
    }
}

module.exports = new AreasRepository();
module.exports.PUBLIC_ATTRIBUTES = PUBLIC_ATTRIBUTES;
module.exports.LIST_ATTRIBUTES = LIST_ATTRIBUTES;
