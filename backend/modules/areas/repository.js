'use strict';

const { Area } = require('../../models');
const BaseRepository = require('../../shared/database/BaseRepository');

const PUBLIC_ATTRIBUTES = ['uid', 'name', 'description', 'color'];
const LIST_ATTRIBUTES = ['id', 'uid', 'name', 'description', 'color'];

class AreasRepository extends BaseRepository {
    constructor() {
        super(Area);
    }

    /**
     * Find all areas for a user, ordered by name.
     */
    async findAllByUser(userId) {
        return this.model.findAll({
            where: { user_id: userId },
            attributes: LIST_ATTRIBUTES,
            order: [['name', 'ASC']],
        });
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
