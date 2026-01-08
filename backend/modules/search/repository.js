'use strict';

const { Task, Tag, Project, Area, Note, sequelize } = require('../../models');
const { Op } = require('sequelize');

class SearchRepository {
    /**
     * Find tag IDs by names for a user.
     */
    async findTagIdsByNames(userId, tagNames) {
        if (tagNames.length === 0) return [];

        const tags = await Tag.findAll({
            where: {
                user_id: userId,
                name: { [Op.in]: tagNames },
            },
            attributes: ['id'],
        });
        return tags.map((tag) => tag.id);
    }

    /**
     * Count tasks matching conditions.
     */
    async countTasks(conditions, include) {
        return Task.count({
            where: conditions,
            include,
            distinct: true,
        });
    }

    /**
     * Find tasks matching conditions.
     */
    async findTasks(conditions, include, limit, offset) {
        return Task.findAll({
            where: conditions,
            include,
            limit,
            offset,
            order: [['updated_at', 'DESC']],
        });
    }

    /**
     * Count projects matching conditions.
     */
    async countProjects(conditions, include) {
        return Project.count({
            where: conditions,
            include: include?.length > 0 ? include : undefined,
            distinct: true,
        });
    }

    /**
     * Find projects matching conditions.
     */
    async findProjects(conditions, include, limit, offset) {
        return Project.findAll({
            where: conditions,
            include: include?.length > 0 ? include : undefined,
            limit,
            offset,
            order: [['updated_at', 'DESC']],
        });
    }

    /**
     * Count areas matching conditions.
     */
    async countAreas(conditions) {
        return Area.count({ where: conditions });
    }

    /**
     * Find areas matching conditions.
     */
    async findAreas(conditions, limit, offset) {
        return Area.findAll({
            where: conditions,
            limit,
            offset,
            order: [['updated_at', 'DESC']],
        });
    }

    /**
     * Count notes matching conditions.
     */
    async countNotes(conditions, include) {
        return Note.count({
            where: conditions,
            include: include?.length > 0 ? include : undefined,
            distinct: true,
        });
    }

    /**
     * Find notes matching conditions.
     */
    async findNotes(conditions, include, limit, offset) {
        return Note.findAll({
            where: conditions,
            include: include?.length > 0 ? include : undefined,
            limit,
            offset,
            order: [['updated_at', 'DESC']],
        });
    }

    /**
     * Count tags matching conditions.
     */
    async countTags(conditions) {
        return Tag.count({ where: conditions });
    }

    /**
     * Find tags matching conditions.
     */
    async findTags(conditions, limit, offset) {
        return Tag.findAll({
            where: conditions,
            limit,
            offset,
            order: [['name', 'ASC']],
        });
    }
}

module.exports = new SearchRepository();
