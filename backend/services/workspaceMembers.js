const { Op } = require('sequelize');
const { UserGroupMember } = require('../models');
const permissionSources = require('./permissionSources');

// The people a user works with: everyone they share something with (in either
// direction) and everyone who is in a group with them. Shares are read through
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

async function getWorkspaceUserIds(userId) {
    const [groupIds, shareIds] = await Promise.all([
        getGroupCoMemberIds(userId),
        getSharePartnerIds(userId),
    ]);
    const ids = new Set([...groupIds, ...shareIds]);
    ids.delete(userId);
    return Array.from(ids);
}

module.exports = { getWorkspaceUserIds };
