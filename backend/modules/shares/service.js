'use strict';

const sharesRepository = require('./repository');
const groupsRepository = require('../groups/repository');
const { execAction } = require('../../services/execAction');
const groupSharing = require('../../services/groupSharing');
const { isAdmin } = require('../../services/rolesService');
const { logError } = require('../../services/logService');
const { Notification } = require('../../models');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
} = require('../../shared/errors');

const SHAREABLE_TYPES = new Set(['project', 'task', 'note', 'area', 'goal']);
const ACCESS_LEVELS = new Set(['ro', 'rw']);
const GROUP_INVITATION_ID = /^g(\d+)$/;

function parseGroupInvitationId(idParam) {
    const match = GROUP_INVITATION_ID.exec(String(idParam));
    return match ? Number(match[1]) : null;
}

class SharesService {
    async isResourceOwner(userId, resourceType, resourceUid) {
        const resource = await sharesRepository.findResourceOwner(
            resourceType,
            resourceUid
        );
        return resource && resource.user_id === userId;
    }

    async assertCanManage(userId, resourceType, resourceUid) {
        const userIsAdmin = await isAdmin(userId);
        const userIsOwner = await this.isResourceOwner(
            userId,
            resourceType,
            resourceUid
        );
        if (!userIsAdmin && !userIsOwner) {
            throw new ForbiddenError('Forbidden');
        }
    }

    // Sharing is an invitation: the recipient sees nothing until they accept.
    // The response is the same whether or not the email belongs to an account,
    // so this endpoint cannot be used to check who has signed up. A share
    // targets either one user by email or a whole group by uid.
    async createShare(userId, data) {
        const {
            resource_type,
            resource_uid,
            target_user_email,
            target_group_uid,
            access_level,
        } = data;

        if (
            !resource_type ||
            !resource_uid ||
            !access_level ||
            (!target_user_email && !target_group_uid)
        ) {
            throw new ValidationError('Missing parameters');
        }
        if (target_user_email && target_group_uid) {
            throw new ValidationError(
                'Share with either a user or a group, not both'
            );
        }
        if (!SHAREABLE_TYPES.has(resource_type)) {
            throw new ValidationError('Unsupported resource type');
        }
        if (!ACCESS_LEVELS.has(access_level)) {
            throw new ValidationError('Invalid access level');
        }

        await this.assertCanManage(userId, resource_type, resource_uid);

        const resource = await sharesRepository.findResourceSummary(
            resource_type,
            resource_uid
        );
        if (!resource) {
            throw new NotFoundError('Resource not found');
        }

        if (target_group_uid) {
            const group = await groupsRepository.findByUid(target_group_uid);
            if (!group) {
                throw new NotFoundError('Group not found');
            }
            await groupSharing.grantToGroup({
                actorUserId: userId,
                group,
                resourceType: resource_type,
                resourceUid: resource_uid,
                accessLevel: access_level,
                ownerUserId: resource.user_id,
            });
            return null; // 204 No Content
        }

        const target =
            await sharesRepository.findUserByEmail(target_user_email);
        if (!target) {
            return null;
        }

        if (resource.user_id === target.id) {
            throw new ValidationError(
                'Cannot grant permissions to the owner. Owner already has full access.'
            );
        }

        const actionId = await execAction({
            verb: 'share_grant',
            actorUserId: userId,
            targetUserId: target.id,
            resourceType: resource_type,
            resourceUid: resource_uid,
            accessLevel: access_level,
            status: 'pending',
        });

        await this.notifyInvitee({
            actorUserId: userId,
            target,
            resource,
            resourceType: resource_type,
            accessLevel: access_level,
            actionId,
        });

        return null; // 204 No Content
    }

    async notifyInvitee({
        actorUserId,
        target,
        resource,
        resourceType,
        accessLevel,
        actionId,
    }) {
        try {
            const actor = await sharesRepository.findUserById(actorUserId, [
                'id',
                'email',
                'name',
            ]);
            const direct = await sharesRepository.findDirectPermission(
                target.id,
                resourceType,
                resource.uid
            );
            const inviterLabel = actor?.name || actor?.email || 'Someone';
            const resourceLabel = resource.name || resourceType;
            const accessLabel =
                accessLevel === 'rw' ? 'read & write' : 'read only';

            await Notification.createNotification({
                userId: target.id,
                type: 'share_invitation',
                title: `${inviterLabel} invited you to a ${resourceType}`,
                message: `"${resourceLabel}" was shared with you (${accessLabel}). Accept to add it to your workspace.`,
                data: {
                    invitationId: direct ? direct.id : null,
                    actionId,
                    resourceType,
                    resourceUid: resource.uid,
                    resourceName: resource.name,
                    accessLevel,
                    inviterEmail: actor?.email || null,
                },
            });
        } catch (error) {
            // The share itself is recorded; a failed notification must not
            // undo it. The invitee can still find it under pending shares.
            logError('Failed to create share invitation notification:', error);
        }
    }

    async deleteShare(userId, data) {
        const {
            resource_type,
            resource_uid,
            target_user_id,
            target_group_uid,
        } = data;

        if (
            !resource_type ||
            !resource_uid ||
            (!target_user_id && !target_group_uid)
        ) {
            throw new ValidationError('Missing parameters');
        }
        if (target_user_id && target_group_uid) {
            throw new ValidationError(
                'Revoke from either a user or a group, not both'
            );
        }

        await this.assertCanManage(userId, resource_type, resource_uid);

        if (target_group_uid) {
            const group = await groupsRepository.findByUid(target_group_uid);
            if (!group) {
                throw new NotFoundError('Group not found');
            }
            await groupSharing.revokeFromGroup({
                group,
                resourceType: resource_type,
                resourceUid: resource_uid,
            });
            return null; // 204 No Content
        }

        const resource = await sharesRepository.findResourceOwner(
            resource_type,
            resource_uid
        );
        if (resource && resource.user_id === Number(target_user_id)) {
            throw new ValidationError(
                'Cannot revoke permissions from the owner.'
            );
        }

        await execAction({
            verb: 'share_revoke',
            actorUserId: userId,
            targetUserId: Number(target_user_id),
            resourceType: resource_type,
            resourceUid: resource_uid,
        });

        return null; // 204 No Content
    }

    async getShares(userId, resourceType, resourceUid) {
        if (!resourceType || !resourceUid) {
            throw new ValidationError('Missing parameters');
        }

        await this.assertCanManage(userId, resourceType, resourceUid);

        let ownerInfo = null;
        const resource = await sharesRepository.findResourceOwner(
            resourceType,
            resourceUid
        );

        if (resource) {
            const owner = await sharesRepository.findUserById(resource.user_id);
            if (owner) {
                ownerInfo = {
                    user_id: owner.id,
                    access_level: 'owner',
                    status: 'accepted',
                    created_at: null,
                    email: owner.email,
                    avatar_image: owner.avatar_image,
                    is_owner: true,
                };
            }
        }

        const rows = await sharesRepository.findPermissions(
            resourceType,
            resourceUid
        );

        const userIds = Array.from(new Set(rows.map((r) => r.user_id))).filter(
            Boolean
        );
        let usersById = {};
        if (userIds.length) {
            const users = await sharesRepository.findUsersByIds(userIds);
            usersById = users.reduce((acc, u) => {
                acc[u.id] = { email: u.email, avatar_image: u.avatar_image };
                return acc;
            }, {});
        }

        const withEmails = rows.map((r) => ({
            ...r,
            email: usersById[r.user_id]?.email || null,
            avatar_image: usersById[r.user_id]?.avatar_image || null,
            is_owner: false,
        }));

        const allShares = ownerInfo ? [ownerInfo, ...withEmails] : withEmails;

        const groupShares = await groupSharing.listForResource(
            resourceType,
            resourceUid
        );

        return { shares: allShares, group_shares: groupShares };
    }

    async listInvitations(userId) {
        const [rows, groupRows] = await Promise.all([
            sharesRepository.findPendingInvitations(userId),
            sharesRepository.findPendingGroupInvitations(userId),
        ]);

        const invitations = [];
        for (const row of groupRows) {
            const resource = await sharesRepository.findResourceSummary(
                row.resource_type,
                row.resource_uid
            );
            if (!resource) continue;

            const inviter = await sharesRepository.findUserById(
                row.granted_by_user_id,
                ['id', 'email', 'name']
            );

            invitations.push({
                id: `g${row.id}`,
                resource_type: row.resource_type,
                resource_uid: row.resource_uid,
                resource_name: resource.name,
                access_level: row.access_level,
                created_at: row.created_at,
                inviter_email: inviter?.email || null,
                inviter_name: inviter?.name || null,
                via_group: {
                    uid: row.GroupShare.Group.uid,
                    name: row.GroupShare.Group.name,
                },
            });
        }

        for (const row of rows) {
            const resource = await sharesRepository.findResourceSummary(
                row.resource_type,
                row.resource_uid
            );
            if (!resource) continue;

            const inviter = await sharesRepository.findUserById(
                row.granted_by_user_id,
                ['id', 'email', 'name']
            );

            invitations.push({
                id: row.id,
                resource_type: row.resource_type,
                resource_uid: row.resource_uid,
                resource_name: resource.name,
                access_level: row.access_level,
                created_at: row.created_at,
                inviter_email: inviter?.email || null,
                inviter_name: inviter?.name || null,
            });
        }

        invitations.sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        return { invitations };
    }

    // Invitation ids are the row id for a direct share and "g<row id>" for a
    // group grant.
    async findInvitation(userId, invitationId) {
        const groupRowId = parseGroupInvitationId(invitationId);
        const directId = Number(invitationId);
        if (
            groupRowId === null &&
            !(Number.isInteger(directId) && directId > 0)
        ) {
            throw new NotFoundError('Invitation not found');
        }

        const invitation =
            groupRowId !== null
                ? await sharesRepository.findPendingGroupInvitation(
                      userId,
                      groupRowId
                  )
                : await sharesRepository.findPendingInvitation(
                      userId,
                      directId
                  );
        if (!invitation) {
            throw new NotFoundError('Invitation not found');
        }
        return { invitation, viaGroup: groupRowId !== null };
    }

    async acceptInvitation(userId, invitationId) {
        const { invitation, viaGroup } = await this.findInvitation(
            userId,
            invitationId
        );

        if (viaGroup) {
            await sharesRepository.acceptGroupInvitationSet(invitation);
        } else {
            await sharesRepository.acceptInvitationSet(invitation);
        }
        return {
            resource_type: invitation.resource_type,
            resource_uid: invitation.resource_uid,
        };
    }

    async declineInvitation(userId, invitationId) {
        const { invitation, viaGroup } = await this.findInvitation(
            userId,
            invitationId
        );

        if (viaGroup) {
            await sharesRepository.deleteGroupInvitationSet(invitation);
        } else {
            await sharesRepository.deleteInvitationSet(invitation);
        }
        return null;
    }
}

module.exports = new SharesService();
