'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { Note, Tag, Project } = require('../../models');

const PUBLIC_ATTRIBUTES = ['uid', 'title', 'content', 'color', 'createdAt', 'updatedAt'];

const TAG_INCLUDE = {
    model: Tag,
    attributes: ['name', 'uid'],
    through: { attributes: [] },
};

const PROJECT_INCLUDE = {
    model: Project,
    required: false,
    attributes: ['name', 'uid'],
};

const TAG_INCLUDE_WITH_ID = {
    model: Tag,
    attributes: ['id', 'name', 'uid'],
    through: { attributes: [] },
};

const PROJECT_INCLUDE_WITH_ID = {
    model: Project,
    required: false,
    attributes: ['id', 'name', 'uid'],
};

class NotesRepository extends BaseRepository {
    constructor() {
        super(Note);
    }

    /**
     * Find all notes by where clause with includes.
     */
    async findAllWithIncludes(whereClause, options = {}) {
        const { orderColumn = 'title', orderDirection = 'ASC', tagFilter } = options;

        const includeClause = [
            tagFilter
                ? { ...TAG_INCLUDE, where: { name: tagFilter }, required: true }
                : TAG_INCLUDE,
            PROJECT_INCLUDE,
        ];

        return this.model.findAll({
            where: whereClause,
            include: includeClause,
            order: [[orderColumn, orderDirection]],
            distinct: true,
        });
    }

    /**
     * Find a note by UID with includes.
     */
    async findByUidWithIncludes(uid) {
        return this.model.findOne({
            where: { uid },
            include: [TAG_INCLUDE, PROJECT_INCLUDE],
        });
    }

    /**
     * Find a note by UID (simple, for existence check).
     */
    async findByUid(uid) {
        return this.model.findOne({
            where: { uid },
            attributes: ['id', 'uid', 'user_id'],
        });
    }

    /**
     * Find a note by ID with includes (for reloading after create/update).
     */
    async findByIdWithIncludes(id) {
        return this.model.findByPk(id, {
            include: [TAG_INCLUDE, PROJECT_INCLUDE],
        });
    }

    /**
     * Find a note by ID with detailed includes (including id attributes).
     */
    async findByIdWithDetailedIncludes(id) {
        return this.model.findByPk(id, {
            include: [TAG_INCLUDE_WITH_ID, PROJECT_INCLUDE_WITH_ID],
        });
    }

    /**
     * Create a note for a user.
     */
    async createForUser(userId, data) {
        return this.model.create({
            ...data,
            user_id: userId,
        });
    }
}

module.exports = new NotesRepository();
module.exports.PUBLIC_ATTRIBUTES = PUBLIC_ATTRIBUTES;
