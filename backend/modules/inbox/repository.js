'use strict';

const { Op, fn, col, where } = require('sequelize');
const { InboxItem, Project, Tag } = require('../../models');
const {
    ownershipOrPermissionWhere,
} = require('../../services/permissionsService');
const BaseRepository = require('../../shared/database/BaseRepository');

const PUBLIC_ATTRIBUTES = [
    'uid',
    'title',
    'content',
    'status',
    'source',
    'ai_suggestion',
    'created_at',
    'updated_at',
];

class InboxRepository extends BaseRepository {
    constructor() {
        super(InboxItem);
    }

    async findAllActive(userId, { limit, offset } = {}) {
        const options = {
            where: {
                user_id: userId,
                status: { [Op.notIn]: ['deleted', 'trashed', 'processed'] },
            },
            order: [['created_at', 'DESC']],
        };

        if (limit !== undefined) {
            options.limit = limit;
            options.offset = offset || 0;
        }

        return this.model.findAll(options);
    }

    async countActive(userId) {
        return this.model.count({
            where: {
                user_id: userId,
                status: { [Op.notIn]: ['deleted', 'trashed', 'processed'] },
            },
            raw: true,
        });
    }

    async findByUid(userId, uid) {
        return this.model.findOne({
            where: {
                uid,
                user_id: userId,
            },
        });
    }

    async createForUser(userId, { content, title, source }) {
        return this.model.create({
            content,
            title,
            source,
            user_id: userId,
        });
    }

    async updateItem(item, data) {
        await item.update(data);
        return item;
    }

    async softDelete(item) {
        await item.update({ status: 'deleted' });
        return item;
    }

    async markProcessed(item) {
        await item.update({ status: 'processed' });
        return item;
    }

    async findActiveByUids(userId, uids) {
        return this.model.findAll({
            where: {
                user_id: userId,
                uid: { [Op.in]: uids },
                status: { [Op.notIn]: ['deleted', 'trashed', 'processed'] },
            },
            order: [['created_at', 'DESC']],
        });
    }

    // Open projects the user can file things into, for the AI to choose from.
    async findOpenProjectsForUser(userId, limit) {
        const accessWhere = await ownershipOrPermissionWhere('project', userId);
        return Project.findAll({
            where: {
                [Op.and]: [
                    accessWhere,
                    { status: { [Op.notIn]: ['done', 'cancelled'] } },
                ],
            },
            attributes: ['uid', 'name'],
            order: [['updated_at', 'DESC']],
            limit,
            raw: true,
        });
    }

    async findTagNamesForUser(userId, limit) {
        const tags = await Tag.findAll({
            where: { user_id: userId },
            attributes: ['name'],
            order: [['name', 'ASC']],
            limit,
            raw: true,
        });
        return tags.map((tag) => tag.name);
    }

    // A project the user owns or has been shared, matched by name the way
    // the +project token matches it (case-insensitive).
    async findAccessibleProjectUidByName(userId, name) {
        const accessWhere = await ownershipOrPermissionWhere('project', userId);
        const project = await Project.findOne({
            where: {
                [Op.and]: [
                    accessWhere,
                    where(fn('lower', col('name')), name.toLowerCase()),
                ],
            },
            attributes: ['uid'],
            raw: true,
        });
        return project ? project.uid : null;
    }
}

module.exports = new InboxRepository();
module.exports.PUBLIC_ATTRIBUTES = PUBLIC_ATTRIBUTES;
