'use strict';

const { Op } = require('sequelize');
const {
    sequelize,
    User,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
    Project,
    Area,
    Goal,
    Note,
    Task,
} = require('../../models');

const MEMBER_USER_ATTRIBUTES = [
    'id',
    'email',
    'name',
    'surname',
    'avatar_image',
];

const RESOURCE_NAME_LOOKUPS = {
    project: { model: Project, field: 'name' },
    area: { model: Area, field: 'name' },
    goal: { model: Goal, field: 'title' },
    note: { model: Note, field: 'title' },
    task: { model: Task, field: 'name' },
};

function countsByGroupId(rows) {
    const map = new Map();
    rows.forEach((r) => map.set(r.group_id, parseInt(r.count, 10)));
    return map;
}

class GroupsRepository {
    async findAllWithCounts() {
        const groups = await UserGroup.findAll({
            order: [[sequelize.fn('lower', sequelize.col('name')), 'ASC']],
            raw: true,
        });
        if (groups.length === 0) return [];

        const groupIds = groups.map((g) => g.id);
        const countBy = (model) =>
            model.findAll({
                where: { group_id: { [Op.in]: groupIds } },
                attributes: [
                    'group_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                ],
                group: ['group_id'],
                raw: true,
            });
        const [memberRows, shareRows] = await Promise.all([
            countBy(UserGroupMember),
            countBy(GroupShare),
        ]);
        const memberCounts = countsByGroupId(memberRows);
        const shareCounts = countsByGroupId(shareRows);

        return groups.map((g) => ({
            ...g,
            member_count: memberCounts.get(g.id) || 0,
            share_count: shareCounts.get(g.id) || 0,
        }));
    }

    async findByUid(uid) {
        return UserGroup.findOne({ where: { uid } });
    }

    async findByNameInsensitive(name, excludeId = null) {
        const where = {
            [Op.and]: [
                sequelize.where(
                    sequelize.fn('lower', sequelize.col('name')),
                    name.toLowerCase()
                ),
            ],
        };
        if (excludeId) {
            where[Op.and].push({ id: { [Op.ne]: excludeId } });
        }
        return UserGroup.findOne({ where });
    }

    async create(data) {
        return UserGroup.create(data);
    }

    async update(group, data) {
        return group.update(data);
    }

    async countMembers(groupId) {
        return UserGroupMember.count({ where: { group_id: groupId } });
    }

    async countShares(groupId) {
        return GroupShare.count({ where: { group_id: groupId } });
    }

    async listMembers(groupId) {
        const rows = await UserGroupMember.findAll({
            where: { group_id: groupId },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: MEMBER_USER_ATTRIBUTES,
                    required: true,
                },
            ],
            order: [['id', 'ASC']],
        });
        return rows.map((row) => row.User.get({ plain: true }));
    }

    async findUsersByIds(userIds) {
        return User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ['id'],
            raw: true,
        });
    }

    async findMemberUserIds(groupId, userIds) {
        const rows = await UserGroupMember.findAll({
            where: { group_id: groupId, user_id: { [Op.in]: userIds } },
            attributes: ['user_id'],
            raw: true,
        });
        return rows.map((r) => r.user_id);
    }

    async listShares(groupId) {
        const shares = await GroupShare.findAll({
            where: { group_id: groupId },
            order: [['id', 'ASC']],
            raw: true,
        });
        const namesByType = await this._resolveResourceNames(shares);
        return shares.map((s) => ({
            resource_type: s.resource_type,
            resource_uid: s.resource_uid,
            resource_name: namesByType[s.resource_type]?.[s.resource_uid],
            access_level: s.access_level,
        }));
    }

    async _resolveResourceNames(shares) {
        const uidsByType = {};
        shares.forEach((s) => {
            (uidsByType[s.resource_type] ||= []).push(s.resource_uid);
        });

        const result = {};
        await Promise.all(
            Object.entries(uidsByType).map(async ([type, uids]) => {
                const lookup = RESOURCE_NAME_LOOKUPS[type];
                if (!lookup) return;
                const rows = await lookup.model.findAll({
                    where: { uid: { [Op.in]: uids } },
                    attributes: ['uid', lookup.field],
                    raw: true,
                });
                result[type] = Object.fromEntries(
                    rows.map((r) => [r.uid, r[lookup.field]])
                );
            })
        );
        return result;
    }

    async destroyWithGrants(group) {
        return sequelize.transaction(async (transaction) => {
            const shares = await GroupShare.findAll({
                where: { group_id: group.id },
                attributes: ['id'],
                raw: true,
                transaction,
            });
            await GroupPermission.destroy({
                where: {
                    group_share_id: { [Op.in]: shares.map((s) => s.id) },
                },
                transaction,
            });
            await GroupShare.destroy({
                where: { group_id: group.id },
                transaction,
            });
            await UserGroupMember.destroy({
                where: { group_id: group.id },
                transaction,
            });
            await group.destroy({ transaction });
        });
    }
}

module.exports = new GroupsRepository();
