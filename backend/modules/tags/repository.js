'use strict';

const { Tag, sequelize } = require('../../models');
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
            attributes: ['id', 'uid', 'name'],
            order: [[sequelize.fn('LOWER', sequelize.col('name')), 'ASC']],
        });
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
            attributes: ['id', 'uid', 'name'],
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
        });
    }

    /**
     * Delete a tag and all its associations (tasks_tags, notes_tags, projects_tags).
     */
    async deleteWithAssociations(tag) {
        const transaction = await sequelize.transaction();

        try {
            // Remove associations from junction tables
            await Promise.all([
                sequelize.query('DELETE FROM tasks_tags WHERE tag_id = ?', {
                    replacements: [tag.id],
                    type: sequelize.QueryTypes.DELETE,
                    transaction,
                }),
                sequelize.query('DELETE FROM notes_tags WHERE tag_id = ?', {
                    replacements: [tag.id],
                    type: sequelize.QueryTypes.DELETE,
                    transaction,
                }),
                sequelize.query('DELETE FROM projects_tags WHERE tag_id = ?', {
                    replacements: [tag.id],
                    type: sequelize.QueryTypes.DELETE,
                    transaction,
                }),
            ]);

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
