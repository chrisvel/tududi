'use strict';

const { Op, fn, col, where } = require('sequelize');
const { Area, InboxItem, Project } = require('../../models');
const {
    getAccess,
    ownershipOrPermissionWhere,
} = require('../../services/permissionsService');
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

    // An area the user can add tasks to (own or shared read-write), matched
    // by name the way the ~area token matches it (case-insensitive).
    async findWritableAreaByName(userId, name) {
        const accessWhere = await ownershipOrPermissionWhere('area', userId);
        const areas = await Area.findAll({
            where: {
                [Op.and]: [
                    accessWhere,
                    where(fn('lower', col('name')), name.toLowerCase()),
                ],
            },
            attributes: ['uid', 'name'],
            raw: true,
        });
        for (const area of areas) {
            const access = await getAccess(userId, 'area', area.uid);
            if (access === 'rw' || access === 'admin') {
                return { uid: area.uid, name: area.name };
            }
        }
        return null;
    }
}

module.exports = new InboxRepository();
module.exports.PUBLIC_ATTRIBUTES = PUBLIC_ATTRIBUTES;
