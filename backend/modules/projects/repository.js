'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const {
    Project,
    Task,
    Tag,
    Area,
    Note,
    User,
    Permission,
    sequelize,
} = require('../../models');
const { Op } = require('sequelize');

class ProjectsRepository extends BaseRepository {
    constructor() {
        super(Project);
    }

    /**
     * Find all projects with filters and includes.
     */
    async findAllWithFilters(whereClause) {
        return this.model.findAll({
            where: whereClause,
            include: [
                {
                    model: Task,
                    required: false,
                    attributes: ['id', 'status'],
                    where: {
                        parent_task_id: null,
                        recurring_parent_id: null,
                    },
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: User,
                    required: false,
                    attributes: ['uid'],
                },
            ],
            order: [['name', 'ASC']],
        });
    }

    /**
     * Get share counts for multiple projects.
     */
    async getShareCounts(projectUids) {
        if (projectUids.length === 0) return {};

        const shareCounts = await Permission.findAll({
            attributes: [
                'resource_uid',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            where: {
                resource_type: 'project',
                resource_uid: { [Op.in]: projectUids },
            },
            group: ['resource_uid'],
            raw: true,
        });

        const uidToCount = {};
        shareCounts.forEach((item) => {
            uidToCount[item.resource_uid] = parseInt(item.count, 10);
        });

        return uidToCount;
    }

    /**
     * Find project by UID (simple).
     */
    async findByUid(uid) {
        return this.model.findOne({
            where: { uid },
            attributes: ['id', 'uid', 'user_id'],
        });
    }

    /**
     * Find project by UID with full includes.
     */
    async findByUidWithIncludes(uid) {
        return this.model.findOne({
            where: { uid },
            include: [
                {
                    model: Task,
                    required: false,
                    where: {
                        parent_task_id: null,
                        recurring_parent_id: null,
                    },
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
                            through: { attributes: [] },
                            required: false,
                        },
                        {
                            model: Task,
                            as: 'Subtasks',
                            include: [
                                {
                                    model: Tag,
                                    attributes: ['id', 'name', 'uid'],
                                    through: { attributes: [] },
                                    required: false,
                                },
                            ],
                            required: false,
                        },
                    ],
                },
                {
                    model: Note,
                    required: false,
                    attributes: [
                        'id',
                        'uid',
                        'title',
                        'content',
                        'created_at',
                        'updated_at',
                    ],
                    include: [
                        {
                            model: Tag,
                            attributes: ['id', 'name', 'uid'],
                            through: { attributes: [] },
                        },
                    ],
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
            ],
        });
    }

    /**
     * Find project by UID with tags and area.
     */
    async findByUidWithTagsAndArea(uid) {
        return this.model.findOne({
            where: { uid },
            include: [
                {
                    model: Tag,
                    attributes: ['id', 'name', 'uid'],
                    through: { attributes: [] },
                },
                {
                    model: Area,
                    required: false,
                    attributes: ['id', 'uid', 'name'],
                },
            ],
        });
    }

    /**
     * Get share count for a single project.
     */
    async getShareCount(projectUid) {
        return Permission.count({
            where: {
                resource_type: 'project',
                resource_uid: projectUid,
            },
        });
    }

    /**
     * Find area by UID.
     */
    async findAreaByUid(uid) {
        return Area.findOne({
            where: { uid },
            attributes: ['id'],
        });
    }

    /**
     * Delete project with orphaning tasks and notes.
     */
    async deleteWithOrphaning(project, userId) {
        await sequelize.transaction(async (transaction) => {
            await sequelize.query('PRAGMA foreign_keys = OFF', { transaction });

            try {
                await Task.update(
                    { project_id: null },
                    {
                        where: { project_id: project.id, user_id: userId },
                        transaction,
                    }
                );

                await Note.update(
                    { project_id: null },
                    {
                        where: { project_id: project.id, user_id: userId },
                        transaction,
                    }
                );

                await project.destroy({ transaction });
            } finally {
                await sequelize.query('PRAGMA foreign_keys = ON', {
                    transaction,
                });
            }
        });
    }

    /**
     * Find existing tags by names for a user.
     */
    async findTagsByNames(userId, tagNames) {
        return Tag.findAll({
            where: { user_id: userId, name: tagNames },
        });
    }

    /**
     * Create a tag.
     */
    async createTag(name, userId) {
        return Tag.create({ name, user_id: userId });
    }
}

module.exports = new ProjectsRepository();
