'use strict';

const { Op } = require('sequelize');
const { User, Permission, Project, Task, Note } = require('../../models');

const RESOURCE_MODELS = { project: Project, task: Task, note: Note };
const RESOURCE_NAME_FIELDS = { project: 'name', task: 'name', note: 'title' };

class SharesRepository {
    async findResourceOwner(resourceType, resourceUid) {
        const model = RESOURCE_MODELS[resourceType];
        if (!model) return null;

        return model.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
    }

    async findResourceSummary(resourceType, resourceUid) {
        const model = RESOURCE_MODELS[resourceType];
        const nameField = RESOURCE_NAME_FIELDS[resourceType];
        if (!model) return null;

        const row = await model.findOne({
            where: { uid: resourceUid },
            attributes: ['uid', 'user_id', nameField],
            raw: true,
        });
        if (!row) return null;

        return {
            uid: row.uid,
            user_id: row.user_id,
            name: row[nameField] || null,
        };
    }

    async findUserByEmail(email) {
        return User.findOne({
            where: { email: String(email).trim().toLowerCase() },
        });
    }

    async findUserById(id, attributes = ['id', 'email', 'avatar_image']) {
        return User.findByPk(id, { attributes });
    }

    async findUsersByIds(ids) {
        return User.findAll({
            where: { id: ids },
            attributes: ['id', 'email', 'avatar_image'],
            raw: true,
        });
    }

    async findPermissions(resourceType, resourceUid) {
        return Permission.findAll({
            where: {
                resource_type: resourceType,
                resource_uid: resourceUid,
                propagation: 'direct',
            },
            attributes: ['user_id', 'access_level', 'status', 'created_at'],
            raw: true,
        });
    }

    async findDirectPermission(userId, resourceType, resourceUid) {
        return Permission.findOne({
            where: {
                user_id: userId,
                resource_type: resourceType,
                resource_uid: resourceUid,
                propagation: 'direct',
            },
            attributes: ['id', 'status'],
            raw: true,
        });
    }

    async findPendingInvitations(userId) {
        return Permission.findAll({
            where: {
                user_id: userId,
                propagation: 'direct',
                status: 'pending',
            },
            order: [['created_at', 'DESC']],
            raw: true,
        });
    }

    async findPendingInvitation(userId, permissionId) {
        return Permission.findOne({
            where: {
                id: permissionId,
                user_id: userId,
                propagation: 'direct',
                status: 'pending',
            },
        });
    }

    // A grant and everything it cascaded to (tasks and notes under a shared
    // project) share one source_action_id, so accepting or declining the
    // direct row must move the whole set together.
    invitationSetWhere(invitation) {
        const conditions = [{ id: invitation.id }];
        if (invitation.source_action_id) {
            conditions.push({ source_action_id: invitation.source_action_id });
        }
        return {
            user_id: invitation.user_id,
            status: 'pending',
            [Op.or]: conditions,
        };
    }

    async acceptInvitationSet(invitation) {
        return Permission.update(
            { status: 'accepted' },
            { where: this.invitationSetWhere(invitation) }
        );
    }

    async deleteInvitationSet(invitation) {
        return Permission.destroy({
            where: this.invitationSetWhere(invitation),
        });
    }
}

module.exports = new SharesRepository();
