'use strict';

const { UniqueConstraintError } = require('sequelize');
const groupsRepository = require('./repository');
const adminService = require('../admin/service');
const accountsService = require('../../services/accountsService');
const groupSharing = require('../../services/groupSharing');
const { unassignAfterAccessLoss } = require('../../services/assignmentCleanup');
const { getGroupBoard } = require('../everyone/service');
const {
    validateCreateGroup,
    validateUpdateGroup,
    validateMemberIds,
    validateUserId,
} = require('./validation');
const {
    NotFoundError,
    ValidationError,
    ConflictError,
} = require('../../shared/errors');

const DUPLICATE_NAME_MESSAGE = 'A group with this name already exists';

function serializeGroup(group, counts = {}) {
    return {
        uid: group.uid,
        name: group.name,
        description: group.description || null,
        member_count: counts.member_count || 0,
        share_count: counts.share_count || 0,
        created_at: group.created_at,
        updated_at: group.updated_at,
    };
}

// On a hosted instance a group belongs to one customer account: its admins
// manage it and only its members can be put in it or share with it. The
// superadmin (scope.superadmin) manages every group, as an admin does on a
// self-hosted instance, where groups have no account.
class GroupsService {
    async listForPicker(requesterId) {
        const accountId = await accountsService.ensureAccountId(requesterId);
        if (accountsService.isHosted() && !accountId) return [];
        const groups = await groupsRepository.findAllWithCounts({ accountId });
        const mine = new Set(
            await groupsRepository.findGroupIdsForUser(requesterId)
        );
        return groups.map((g) => ({
            uid: g.uid,
            name: g.name,
            member_count: g.member_count,
            is_member: mine.has(g.id),
        }));
    }

    // The group page: open to the group's members and to admins who manage
    // it. Anyone else gets a 404, so a group's existence is not leaked.
    async getPage(requesterId, uid, timezone) {
        const group = await groupsRepository.findByUid(uid);
        if (!group) throw new NotFoundError('Group not found');

        const memberUsers = await groupsRepository.listMembers(group.id);
        const memberIds = memberUsers.map((m) => m.id);
        if (!memberIds.includes(requesterId)) {
            let scope;
            try {
                scope = await adminService.accessScope(requesterId);
            } catch (err) {
                throw new NotFoundError('Group not found');
            }
            await this._requireGroup(uid, scope);
        }

        const board = await getGroupBoard(requesterId, memberIds, timezone);
        return {
            group: {
                uid: group.uid,
                name: group.name,
                description: group.description || null,
                member_count: memberIds.length,
            },
            ...board,
        };
    }

    async listForAdmin(requesterId) {
        const scope = await adminService.accessScope(requesterId);
        const groups = await groupsRepository.findAllWithCounts({
            accountId: scope.superadmin ? null : scope.accountId,
        });
        return groups.map((g) => serializeGroup(g, g));
    }

    async getDetail(requesterId, uid) {
        const scope = await adminService.accessScope(requesterId);
        const group = await this._requireGroup(uid, scope);
        const [members, shares] = await Promise.all([
            groupsRepository.listMembers(group.id),
            groupsRepository.listShares(group.id),
        ]);
        return {
            group: serializeGroup(group, {
                member_count: members.length,
                share_count: shares.length,
            }),
            members: members.map((m) => ({
                user_id: m.id,
                email: m.email,
                name: m.name,
                surname: m.surname,
                avatar_image: m.avatar_image,
            })),
            shares,
        };
    }

    async create(requesterId, body) {
        const scope = await adminService.accessScope(requesterId);
        const data = validateCreateGroup(body);
        const accountId = scope.superadmin
            ? await accountsService.ensureAccountId(requesterId)
            : scope.accountId;
        await this._assertNameAvailable(data.name, null, accountId);
        try {
            const group = await groupsRepository.create({
                ...data,
                created_by_user_id: requesterId,
                account_id: accountId,
            });
            return serializeGroup(group);
        } catch (err) {
            throw this._translateWriteError(err);
        }
    }

    async update(requesterId, uid, body) {
        const scope = await adminService.accessScope(requesterId);
        const group = await this._requireGroup(uid, scope);
        const data = validateUpdateGroup(body);
        if (data.name) {
            await this._assertNameAvailable(
                data.name,
                group.id,
                group.account_id
            );
        }
        try {
            await groupsRepository.update(group, data);
        } catch (err) {
            throw this._translateWriteError(err);
        }
        return serializeGroup(group, {
            member_count: await groupsRepository.countMembers(group.id),
            share_count: await groupsRepository.countShares(group.id),
        });
    }

    async remove(requesterId, uid) {
        const scope = await adminService.accessScope(requesterId);
        const group = await this._requireGroup(uid, scope);
        const lost = await groupsRepository.destroyWithGrants(group);
        await unassignAfterAccessLoss(lost);
    }

    async addMembers(requesterId, uid, body) {
        const scope = await adminService.accessScope(requesterId);
        const group = await this._requireGroup(uid, scope);
        const userIds = validateMemberIds(body);

        const existingUsers = await groupsRepository.findUsersByIds(userIds);
        const outsideAccount =
            !scope.superadmin &&
            userIds.some((id) => !scope.userIds.includes(id));
        if (existingUsers.length !== userIds.length || outsideAccount) {
            throw new ValidationError('One or more users do not exist');
        }

        const alreadyMembers = await groupsRepository.findMemberUserIds(
            group.id,
            userIds
        );
        const toAdd = userIds.filter((id) => !alreadyMembers.includes(id));
        await groupSharing.addMembers({
            group,
            userIds: toAdd,
            addedByUserId: requesterId,
        });

        return { added: toAdd, already_members: alreadyMembers };
    }

    async removeMember(requesterId, uid, userIdParam) {
        const scope = await adminService.accessScope(requesterId);
        const group = await this._requireGroup(uid, scope);
        const userId = validateUserId(userIdParam);
        const removed = await groupSharing.removeMember({ group, userId });
        if (!removed) {
            throw new NotFoundError('User is not a member of this group');
        }
    }

    async _requireGroup(uid, scope = { superadmin: true }) {
        const group = await groupsRepository.findByUid(uid);
        if (!group) throw new NotFoundError('Group not found');
        if (!scope.superadmin && group.account_id !== scope.accountId) {
            throw new NotFoundError('Group not found');
        }
        return group;
    }

    // A hosted account's group names only clash within that account.
    async _assertNameAvailable(name, excludeId = null, accountId = null) {
        const clash = await groupsRepository.findByNameInsensitive(
            name,
            excludeId,
            accountsService.isHosted() ? accountId : null
        );
        if (clash) throw new ConflictError(DUPLICATE_NAME_MESSAGE);
    }

    _translateWriteError(err) {
        if (err instanceof UniqueConstraintError) {
            return new ConflictError(DUPLICATE_NAME_MESSAGE);
        }
        return err;
    }
}

module.exports = new GroupsService();
