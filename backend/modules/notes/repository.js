'use strict';

const BaseRepository = require('../../shared/database/BaseRepository');
const { Op } = require('sequelize');
const { Note, NoteAttachment, Tag, Project } = require('../../models');

const PUBLIC_ATTRIBUTES = [
    'uid',
    'title',
    'content',
    'color',
    'createdAt',
    'updatedAt',
];

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
    attributes: ['id', 'name', 'uid', 'color'],
    through: { attributes: [] },
};

const PROJECT_INCLUDE_WITH_ID = {
    model: Project,
    required: false,
    attributes: ['id', 'name', 'uid', 'color'],
};

class NotesRepository extends BaseRepository {
    constructor() {
        super(Note);
    }

    /**
     * Find all notes by where clause with includes.
     */
    async findAllWithIncludes(whereClause, options = {}) {
        const {
            orderColumn = 'title',
            orderDirection = 'ASC',
            tagFilter,
        } = options;

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
     * Find a note with the fields the public-share flow needs.
     */
    async findForPublicShare(uid) {
        return this.model.findOne({
            where: { uid },
            attributes: [
                'id',
                'uid',
                'user_id',
                'public_token',
                'public_shared_at',
                'public_inherit_style',
            ],
        });
    }

    /**
     * Find the note a public link points at. Only the fields a reader of the
     * public page may see are selected.
     */
    async findByPublicToken(token) {
        return this.model.findOne({
            where: { public_token: token, public_shared_at: { [Op.ne]: null } },
            attributes: [
                'id',
                'user_id',
                'title',
                'content',
                'color',
                'background',
                'public_inherit_style',
                'updated_at',
            ],
        });
    }

    // A file attached to the note, by the name it is stored under.
    async findAttachment(noteId, storedFilename) {
        return NoteAttachment.findOne({
            where: { note_id: noteId, stored_filename: storedFilename },
            attributes: ['file_path', 'original_filename'],
            raw: true,
        });
    }

    // The titles and public links of a user's notes that are shared publicly.
    async findPublicTitlesForUser(userId) {
        return this.model.findAll({
            where: {
                user_id: userId,
                public_token: { [Op.ne]: null },
                public_shared_at: { [Op.ne]: null },
            },
            attributes: ['title', 'public_token'],
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

    /**
     * Find notes that contain [[noteTitle]] in their content (backlinks).
     */
    async findBacklinks(userId, noteTitle) {
        const { ciLike } = require('../../utils/db-dialect');
        return this.model.findAll({
            where: {
                user_id: userId,
                content: ciLike(`%[[${noteTitle}]]%`),
            },
            attributes: ['uid', 'title'],
            order: [['title', 'ASC']],
        });
    }
}

module.exports = new NotesRepository();
module.exports.PUBLIC_ATTRIBUTES = PUBLIC_ATTRIBUTES;
