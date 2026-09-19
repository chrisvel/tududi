'use strict';

const { UniqueConstraintError } = require('sequelize');
const groupsRepository = require('./repository');
const adminService = require('../admin/service');
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

class GroupsService {
    async listForPicker() {
        const groups = await groupsRepository.findAllWithCounts();
        return groups.map((g) => ({
            uid: g.uid,
            name: g.name,
            member_count: g.member_count,
        }));
    }

    async listForAdmin(requesterId) {
        await adminService.verifyAdmin(requesterId);
        const groups = await groupsRepository.findAllWithCounts();
        return groups.map((g) => serializeGroup(g, g));
    }

    async getDetail(requesterId, uid) {
        await adminService.verifyAdmin(requesterId);
        const group = await this._requireGroup(uid);
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
        await adminService.verifyAdmin(requesterId);
        const data = validateCreateGroup(body);
        await this._assertNameAvailable(data.name);
        try {
            const group = await groupsRepository.create({
                ...data,
                created_by_user_id: requesterId,
            });
            return serializeGroup(group);
        } catch (err) {
            throw this._translateWriteError(err);
        }
    }

    async update(requesterId, uid, body) {
        await adminService.verifyAdmin(requesterId);
        const group = await this._requireGroup(uid);
        const data = validateUpdateGroup(body);
        if (data.name) {
            await this._assertNameAvailable(data.name, group.id);
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
        await adminService.verifyAdmin(requesterId);
        const group = await this._requireGroup(uid);
        await groupsRepository.destroyWithGrants(group);
    }

    async addMembers(requesterId, uid, body) {
        await adminService.verifyAdmin(requesterId);
        const group = await this._requireGroup(uid);
        const userIds = validateMemberIds(body);

        const existingUsers = await groupsRepository.findUsersByIds(userIds);
        if (existingUsers.length !== userIds.length) {
            throw new ValidationError('One or more users do not exist');
        }

        const alreadyMembers = await groupsRepository.findMemberUserIds(
            group.id,
            userIds
        );
        const toAdd = userIds.filter((id) => !alreadyMembers.includes(id));
        await groupsRepository.addMembers(group.id, toAdd, requesterId);

        return { added: toAdd, already_members: alreadyMembers };
    }

    async removeMember(requesterId, uid, userIdParam) {
        await adminService.verifyAdmin(requesterId);
        const group = await this._requireGroup(uid);
        const userId = validateUserId(userIdParam);
        const removed = await groupsRepository.removeMember(group.id, userId);
        if (!removed) {
            throw new NotFoundError('User is not a member of this group');
        }
    }

    async _requireGroup(uid) {
        const group = await groupsRepository.findByUid(uid);
        if (!group) throw new NotFoundError('Group not found');
        return group;
    }

    async _assertNameAvailable(name, excludeId = null) {
        const clash = await groupsRepository.findByNameInsensitive(
            name,
            excludeId
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
