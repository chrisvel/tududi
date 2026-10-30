const { Op } = require('sequelize');
const { Area, Project, User, UserGroupMember } = require('../models');
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

// On a hosted instance, everyone in the same customer account (see
// accountsService), so a family can assign to each other whichever admin
// added them.
async function getAccountPartnerIds(userId) {
    const accounts = require('./accountsService');
    if (!accounts.isHosted()) return [];
    return accounts.getAccountUserIds(userId);
}

async function getWorkspaceUserIds(userId) {
    const [groupIds, shareIds, creationIds, accountIds] = await Promise.all([
        getGroupCoMemberIds(userId),
        getSharePartnerIds(userId),
        getCreationPartnerIds(userId),
        getAccountPartnerIds(userId),
    ]);
    const ids = new Set([
        ...groupIds,
        ...shareIds,
        ...creationIds,
        ...accountIds,
    ]);
    ids.delete(userId);
    return Array.from(ids);
}

// The projects and areas a user owns or holds accepted access to (directly
// or through a group), as { project: [uid], area: [uid] }. Projects inside an
// owned area count, since the area owner can see them.
async function getWorkResourceUids(userId) {
    const [ownedAreas, ownedProjects, granted] = await Promise.all([
        Area.findAll({
            where: { user_id: userId },
            attributes: ['id', 'uid'],
            raw: true,
        }),
        Project.findAll({
            where: { user_id: userId },
            attributes: ['uid'],
            raw: true,
        }),
        permissionSources.findAccepted(
            { user_id: userId, resource_type: ['project', 'area'] },
            ['resource_type', 'resource_uid']
        ),
    ]);
    const projectsInOwnedAreas = ownedAreas.length
        ? await Project.findAll({
              where: { area_id: ownedAreas.map((a) => a.id) },
              attributes: ['uid'],
              raw: true,
          })
        : [];

    const uids = { project: new Set(), area: new Set() };
    ownedAreas.forEach((a) => uids.area.add(a.uid));
    [...ownedProjects, ...projectsInOwnedAreas].forEach((p) =>
        uids.project.add(p.uid)
    );
    granted.forEach((r) => uids[r.resource_type].add(r.resource_uid));
    return { project: Array.from(uids.project), area: Array.from(uids.area) };
}

// Everyone who owns or holds accepted access to any of the given projects
// and areas.
async function getCoWorkerIds(userId) {
    const { project, area } = await getWorkResourceUids(userId);
    if (project.length === 0 && area.length === 0) return [];

    const [projectOwners, areaOwners, projectGrants, areaGrants] =
        await Promise.all([
            project.length
                ? Project.findAll({
                      where: { uid: project },
                      attributes: ['user_id'],
                      raw: true,
                  })
                : [],
            area.length
                ? Area.findAll({
                      where: { uid: area },
                      attributes: ['user_id'],
                      raw: true,
                  })
                : [],
            project.length
                ? permissionSources.findAccepted(
                      { resource_type: 'project', resource_uid: project },
                      ['user_id']
                  )
                : [],
            area.length
                ? permissionSources.findAccepted(
                      { resource_type: 'area', resource_uid: area },
                      ['user_id']
                  )
                : [],
        ]);
    return [...projectOwners, ...areaOwners, ...projectGrants, ...areaGrants]
        .map((row) => row.user_id)
        .filter(Boolean);
}

// Whether the user sees the whole roster of their workspace: always on a
// self-hosted instance, and on a hosted one only for an admin of the
// customer account or the superadmin.
async function seesWholeWorkspace(userId) {
    const accounts = require('./accountsService');
    if (!accounts.isHosted()) return true;
    const roles = require('./rolesService');
    return (
        (await roles.isAdmin(userId)) || (await roles.isAccountAdmin(userId))
    );
}

// The members a user is shown on the Everyone board, the People list and the
// share picker. On a hosted instance a member who is not an admin of the
// account sees only the people they share at least one project or area with
// (either direction, directly or through a group), never the whole account.
// Everyone else sees their workspace, as getWorkspaceUserIds returns it.
async function getVisibleMemberIds(userId) {
    const workspaceIds = await getWorkspaceUserIds(userId);
    if (await seesWholeWorkspace(userId)) return workspaceIds;

    const coWorkers = new Set(await getCoWorkerIds(userId));
    return workspaceIds.filter((id) => coWorkers.has(id));
}

module.exports = { getWorkspaceUserIds, getVisibleMemberIds };
