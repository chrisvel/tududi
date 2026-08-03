'use strict';

const { InboxItem } = require('../../models');
const BaseRepository = require('../../shared/database/BaseRepository');

const PUBLIC_ATTRIBUTES = [
    'uid',
    'title',
    'content',
    'status',
    'source',
    'created_at',
    'updated_at',
];

class InboxRepository extends BaseRepository {
    constructor() {
        super(InboxItem);
    }

    async findAllActive(userId, { limit, offset } = {}) {
        const { Op } = require('sequelize');
        const options = {
            where: {
                user_id: userId,
                status: { [Op.notIn]: ['deleted', 'trashed'] },
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
        const { Op } = require('sequelize');
        return this.model.count({
            where: {
                user_id: userId,
                status: { [Op.notIn]: ['deleted', 'trashed'] },
            },
            raw: true,
        });
    }

    async countTrashed(userId) {
        return this.model.count({
            where: { user_id: userId, status: 'trashed' },
            raw: true,
        });
    }

    async markTrashed(item) {
        await item.update({ status: 'trashed' });
        return item;
    }

    async markRestored(item) {
        await item.update({ status: 'added' });
        return item;
    }

    async findByUid(userId, uid) {
        return this.model.findOne({
            where: {
                uid,
                user_id: userId,
            },
        });
    }

    async findByUidPublic(userId, uid) {
        return this.model.findOne({
            where: {
                uid,
                user_id: userId,
            },
            attributes: PUBLIC_ATTRIBUTES,
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
}

module.exports = new InboxRepository();
module.exports.PUBLIC_ATTRIBUTES = PUBLIC_ATTRIBUTES;
