'use strict';

const sharesRepository = require('./repository');
const { execAction } = require('../../services/execAction');
const { isAdmin } = require('../../services/rolesService');
const {
    ValidationError,
    NotFoundError,
    ForbiddenError,
} = require('../../shared/errors');

class SharesService {
    async isResourceOwner(userId, resourceType, resourceUid) {
        const resource = await sharesRepository.findResourceOwner(
            resourceType,
            resourceUid
        );
        return resource && resource.user_id === userId;
    }

    async createShare(userId, data) {
        const { resource_type, resource_uid, target_user_email, access_level } =
            data;

        if (
            !resource_type ||
            !resource_uid ||
            !target_user_email ||
            !access_level
        ) {
            throw new ValidationError('Missing parameters');
        }

        // Only owner (or admin) can grant shares
        const userIsAdmin = await isAdmin(userId);
        const userIsOwner = await this.isResourceOwner(
            userId,
            resource_type,
            resource_uid
        );
        if (!userIsAdmin && !userIsOwner) {
            throw new ForbiddenError('Forbidden');
        }

        const target =
            await sharesRepository.findUserByEmail(target_user_email);
        if (!target) {
            throw new NotFoundError('Target user not found');
        }

        // Get resource to check owner
        const resource = await sharesRepository.findResourceOwner(
            resource_type,
            resource_uid
        );
        if (!resource) {
            throw new NotFoundError('Resource not found');
        }

        // Prevent sharing with the owner (owner already has full access)
        if (resource.user_id === target.id) {
            throw new ValidationError(
                'Cannot grant permissions to the owner. Owner already has full access.'
            );
        }

        await execAction({
            verb: 'share_grant',
            actorUserId: userId,
            targetUserId: target.id,
            resourceType: resource_type,
            resourceUid: resource_uid,
            accessLevel: access_level,
        });

        return null; // 204 No Content
    }

    async deleteShare(userId, data) {
        const { resource_type, resource_uid, target_user_id } = data;

        if (!resource_type || !resource_uid || !target_user_id) {
            throw new ValidationError('Missing parameters');
        }

        // Only owner (or admin) can revoke shares
        const userIsAdmin = await isAdmin(userId);
        const userIsOwner = await this.isResourceOwner(
            userId,
            resource_type,
            resource_uid
        );
        if (!userIsAdmin && !userIsOwner) {
            throw new ForbiddenError('Forbidden');
        }

        // Prevent revoking permissions from the owner
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

        // Only owner (or admin) can view shares
        const userIsAdmin = await isAdmin(userId);
        const userIsOwner = await this.isResourceOwner(
            userId,
            resourceType,
            resourceUid
        );
        if (!userIsAdmin && !userIsOwner) {
            throw new ForbiddenError('Forbidden');
        }

        // Get resource owner information
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

        // Attach emails and avatar images for display
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

        // Prepend owner to the list
        const allShares = ownerInfo ? [ownerInfo, ...withEmails] : withEmails;

        return { shares: allShares };
    }
}

module.exports = new SharesService();
