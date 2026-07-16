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
     * Find all areas visible to a user (owned or shared with them), with
     * counts of associated projects, goals, and tasks.
     */
    async findAllByUser(userId) {
        const whereClause = await permissionsService.ownershipOrPermissionWhere(
            'area',
            userId
        );
        const areas = await this.model.findAll({
            where: whereClause,
            attributes: LIST_ATTRIBUTES,
            order: [['name', 'ASC']],
        });

        if (areas.length === 0) return [];

        const areaIds = areas.map((a) => a.id);

        // Counts are scoped by area_id only: content assigned to an area
        // always belongs to the area's owner, and scoping by the requesting
        // user would show zero counts on areas shared with them.
        const [projectCounts, goalCounts, taskCounts] = await Promise.all([
            Project.findAll({
                where: { area_id: { [Op.in]: areaIds } },
                attributes: [
                    'area_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['area_id'],
                raw: true,
            }),
            Goal.findAll({
                where: { area_id: { [Op.in]: areaIds } },
                attributes: [
                    'area_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['area_id'],
                raw: true,
            }),
            Task.findAll({
                where: {
                    area_id: { [Op.in]: areaIds },
                    parent_task_id: null,
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
     * Find an area by UID regardless of owner (access must be checked by the
     * caller, e.g. via permissionsService.getAccess).
     */
    async findByUidAnyOwner(uid) {
        return this.model.findOne({
            where: { uid },
            attributes: PUBLIC_ATTRIBUTES,
        });
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
