const { Op } = require('sequelize');
const { User, UserGroupMember } = require('../models');
const permissionSources = require('./permissionSources');

// The people a user works with: everyone they share something with (in either
// direction), everyone who is in a group with them, and the accounts they
// created or that created them. Shares are read through
// permissionSources so group grants count, and only top-level (direct) grants
// are needed, since an area, goal or project share always writes one.

async function getGroupCoMemberIds(userId) {
    const memberships = await UserGroupMember.findAll({
        where: { user_id: userId },
        attributes: ['group_id'],
        raw: true,
    });
    if (memberships.length === 0) return [];

    const coMembers = await UserGroupMember.findAll({
        where: { group_id: { [Op.in]: memberships.map((m) => m.group_id) } },
        attributes: ['user_id'],
        raw: true,
    });
    return coMembers.map((m) => m.user_id);
}

async function getSharePartnerIds(userId) {
    const [sharedToMe, sharedByMe] = await Promise.all([
        permissionSources.findAccepted(
            { user_id: userId, propagation: 'direct' },
            ['granted_by_user_id']
        ),
        permissionSources.findAccepted(
            { granted_by_user_id: userId, propagation: 'direct' },
            ['user_id']
        ),
    ]);
    return [
        ...sharedToMe.map((r) => r.granted_by_user_id),
        ...sharedByMe.map((r) => r.user_id),
    ];
}

// The accounts a user created, and the account that created them, so a new
// member is part of their creator's workspace before anything is shared.
async function getCreationPartnerIds(userId) {
    const [created, self] = await Promise.all([
        User.findAll({
            where: { created_by_user_id: userId },
            attributes: ['id'],
            raw: true,
        }),
        User.findByPk(userId, {
            attributes: ['created_by_user_id'],
            raw: true,
        }),
    ]);
    const ids = created.map((row) => row.id);
    if (self && self.created_by_user_id) ids.push(self.created_by_user_id);
    return ids;
}

async function getWorkspaceUserIds(userId) {
    const [groupIds, shareIds, creationIds] = await Promise.all([
        getGroupCoMemberIds(userId),
        getSharePartnerIds(userId),
        getCreationPartnerIds(userId),
    ]);
    const ids = new Set([...groupIds, ...shareIds, ...creationIds]);
    ids.delete(userId);
    return Array.from(ids);
}

module.exports = { getWorkspaceUserIds };
