'use strict';

const { Tag, Task, Note, Project, sequelize } = require('../../models');
const { Op } = require('sequelize');
const BaseRepository = require('../../shared/database/BaseRepository');

class TagsRepository extends BaseRepository {
    constructor() {
        super(Tag);
    }

    /**
     * Find all tags for a user, ordered alphabetically (case-insensitive).
     */
    async findAllByUser(userId) {
        return this.model.findAll({
            where: { user_id: userId },
            attributes: [
                'id',
                'uid',
                'name',
                'tag_type',
                'pinned',
                'color',
                // CAST keeps the counts numeric on PostgreSQL, where COUNT(*)
                // is a bigint that the driver would otherwise return as a string.
                [
                    sequelize.literal(
                        `CAST((SELECT COUNT(*) FROM tasks_tags WHERE tasks_tags.tag_id = "Tag"."id") AS INTEGER)`
                    ),
                    'tasks_count',
                ],
                [
                    sequelize.literal(
                        `CAST((SELECT COUNT(*) FROM notes_tags WHERE notes_tags.tag_id = "Tag"."id") AS INTEGER)`
                    ),
                    'notes_count',
                ],
                [
                    sequelize.literal(
                        `CAST((SELECT COUNT(*) FROM projects_tags WHERE projects_tags.tag_id = "Tag"."id") AS INTEGER)`
                    ),
                    'projects_count',
                ],
                [
                    sequelize.literal(`CAST((
                        SELECT COUNT(*) FROM tasks_tags WHERE tasks_tags.tag_id = "Tag"."id"
                    ) + (
                        SELECT COUNT(*) FROM notes_tags WHERE notes_tags.tag_id = "Tag"."id"
                    ) + (
                        SELECT COUNT(*) FROM projects_tags WHERE projects_tags.tag_id = "Tag"."id"
                    ) AS INTEGER)`),
                    'usage_count',
                ],
            ],
            order: [[sequelize.fn('LOWER', sequelize.col('name')), 'ASC']],
        });
    }

    // Ids of this user's tags carried by any of the tasks, notes or projects
    // the where clauses pick (null skips that kind).
    async findIdsUsedBy(userId, { taskWhere, noteWhere, projectWhere }) {
        const include = [
            {
                model: this.model,
                attributes: ['id'],
                where: { user_id: userId },
                through: { attributes: [] },
                required: true,
            },
        ];
        const lookups = [
            [Task, taskWhere],
            [Note, noteWhere],
            [Project, projectWhere],
        ].map(([model, where]) =>
            where
                ? model.findAll({ where, attributes: ['id'], include })
                : Promise.resolve([])
        );
        const ids = new Set();
        (await Promise.all(lookups)).flat().forEach((item) => {
            (item.Tags || []).forEach((tag) => ids.add(tag.id));
        });
        return [...ids];
    }

    /**
     * Find a tag by uid or name for a specific user.
     */
    async findByIdentifier(userId, identifier) {
        return this.model.findOne({
            where: {
                user_id: userId,
                [Op.or]: [{ uid: identifier }, { name: identifier }],
            },
        });
    }

    /**
     * Find a tag by uid for a specific user.
     */
    async findByUid(userId, uid) {
        return this.model.findOne({
            where: { user_id: userId, uid },
            attributes: ['id', 'uid', 'name', 'tag_type', 'pinned', 'color'],
        });
    }

    /**
     * Find a tag by name for a specific user.
     */
    async findByName(userId, name) {
        return this.model.findOne({
            where: { user_id: userId, name },
        });
    }

    /**
     * Check if a tag name exists for a user (optionally excluding a specific tag).
     */
    async nameExists(userId, name, excludeId = null) {
        const where = { user_id: userId, name };
        if (excludeId) {
            where.id = { [Op.ne]: excludeId };
        }
        return this.exists(where);
    }

    /**
     * Create a new tag for a user.
     */
    async createForUser(userId, name) {
        return this.model.create({
            name,
            user_id: userId,
            tag_type: 'user',
        });
    }

    async createSystemTag(userId, name) {
        return this.model.create({
            name,
            user_id: userId,
            tag_type: 'system',
        });
    }

    /**
     * Delete a tag and all its associations (tasks_tags, notes_tags, projects_tags).
     */
    async deleteWithAssociations(tag) {
        const transaction = await sequelize.transaction();

        try {
            // Remove associations from junction tables. Sequential on purpose:
            // a transaction owns a single connection, so statements on it
            // must not be issued concurrently.
            for (const joinTable of [
                'tasks_tags',
                'notes_tags',
                'projects_tags',
            ]) {
                await sequelize.query(
                    `DELETE FROM ${joinTable} WHERE tag_id = ?`,
                    {
                        replacements: [tag.id],
                        type: sequelize.QueryTypes.DELETE,
                        transaction,
                    }
                );
            }

            await tag.destroy({ transaction });
            await transaction.commit();

            return true;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new TagsRepository();
