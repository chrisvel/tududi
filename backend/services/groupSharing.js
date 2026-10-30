const {
    sequelize,
    UserGroup,
    UserGroupMember,
    GroupShare,
    GroupPermission,
    Notification,
    User,
    Project,
    Task,
    Note,
    Area,
    Goal,
} = require('../models');
const permissionSources = require('./permissionSources');
const accountsService = require('./accountsService');
const {
    calculateProjectPerms,
    calculateTaskPerms,
    calculateNotePerms,
    calculateAreaPerms,
    calculateGoalPerms,
    projectSubtreeChanges,
} = require('./permissionsCalculators');
const { logError } = require('./logService');
const { NotFoundError } = require('../shared/errors');
const { unassignAfterAccessLoss } = require('./assignmentCleanup');

const LEVEL_RANK = { ro: 1, rw: 2 };
const INSERT_CHUNK_SIZE = 500;

const RESOURCES = {
    project: { model: Project, nameField: 'name' },
    task: { model: Task, nameField: 'name' },
    note: { model: Note, nameField: 'title' },
    area: { model: Area, nameField: 'name' },
    goal: { model: Goal, nameField: 'title' },
};

const CALCULATORS = {
    project: calculateProjectPerms,
    task: calculateTaskPerms,
    note: calculateNotePerms,
    area: calculateAreaPerms,
    goal: calculateGoalPerms,
};

function maxLevel(a, b) {
    return (LEVEL_RANK[a] || 0) >= (LEVEL_RANK[b] || 0) ? a : b;
}

function rowKey(resourceType, resourceUid) {
    return `${resourceType}:${resourceUid}`;
}

// The rows a grant on this resource fans out to (the resource itself plus the
// tasks, notes and projects underneath it), computed once and reused for every
// member. userId is filled in per member.
async function computeGrantRows(tx, share) {
    const calculate = CALCULATORS[share.resource_type];
    const { upserts } = await calculate(
        { tx },
        {
            verb: 'share_grant',
            actorUserId: share.granted_by_user_id,
            targetUserId: null,
            resourceType: share.resource_type,
            resourceUid: share.resource_uid,
            accessLevel: share.access_level,
        }
    );
    return upserts;
}

// How each member's rows start. A member who already holds accepted access at
// this level or higher (from a direct share or another group) is not asked
// again and not told. On a hosted instance, a grant made by an admin of the
// member's own account applies at once and the member is only told about it.
// Anything else starts as an invitation. Runs outside the write transaction
// because it reads through the shared facade. Sequential, since looking up an
// account can create one.
async function resolveInitialStatuses(share, userIds, sharerId) {
    const needed = LEVEL_RANK[share.access_level] || 0;
    const plans = new Map();
    for (const userId of userIds) {
        const held = await permissionSources.findAcceptedAccessLevel(
            userId,
            share.resource_type,
            share.resource_uid
        );
        if ((LEVEL_RANK[held] || 0) >= needed) {
            plans.set(userId, { status: 'accepted', notify: null });
        } else if (await accountsService.isAdminOfAccountOf(sharerId, userId)) {
            plans.set(userId, { status: 'accepted', notify: 'notice' });
        } else {
            plans.set(userId, { status: 'pending', notify: 'invitation' });
        }
    }
    return plans;
}

// Writes one member's rows for a grant. Levels only ever go up and an
// accepted row never drops back to pending, the same rules applyPerms uses
// for direct shares. Returns whether the member's root row is new, which is
// when they should be notified.
async function writeMemberRows(tx, share, userId, template, status) {
    const existing = await GroupPermission.findAll({
        where: { group_share_id: share.id, user_id: userId },
        transaction: tx,
    });
    const existingByKey = new Map(
        existing.map((r) => [rowKey(r.resource_type, r.resource_uid), r])
    );

    const toCreate = [];
    for (const u of template) {
        const row = existingByKey.get(rowKey(u.resourceType, u.resourceUid));
        if (row) {
            const nextLevel = maxLevel(row.access_level, u.accessLevel);
            const nextStatus = row.status === 'accepted' ? 'accepted' : status;
            if (nextLevel !== row.access_level || nextStatus !== row.status) {
                await row.update(
                    { access_level: nextLevel, status: nextStatus },
                    { transaction: tx }
                );
            }
        } else {
            toCreate.push({
                group_share_id: share.id,
                user_id: userId,
                resource_type: u.resourceType,
                resource_uid: u.resourceUid,
                access_level: u.accessLevel,
                propagation: u.propagation || 'direct',
                granted_by_user_id: share.granted_by_user_id,
                status,
            });
        }
    }

    for (let i = 0; i < toCreate.length; i += INSERT_CHUNK_SIZE) {
        await GroupPermission.bulkCreate(
            toCreate.slice(i, i + INSERT_CHUNK_SIZE),
            { transaction: tx }
        );
    }

    const rootKey = rowKey(share.resource_type, share.resource_uid);
    const rootCreated = toCreate.some(
        (r) => rowKey(r.resource_type, r.resource_uid) === rootKey
    );
    return rootCreated;
}

async function describeResource(resourceType, resourceUid) {
    const { model, nameField } = RESOURCES[resourceType];
    const row = await model.findOne({
        where: { uid: resourceUid },
        attributes: [nameField],
        raw: true,
    });
    return row ? row[nameField] : null;
}

// One share_invitation per new pending member, reusing the direct-share
// invitation shape so the notification UI can accept or decline it. The
// invitation id is prefixed with "g" because group and direct rows live in
// different tables and their ids overlap.
async function notifyInvitees(share, group, userIds) {
    if (userIds.length === 0) return;
    try {
        const [actor, resourceName, rootRows] = await Promise.all([
            User.findByPk(share.granted_by_user_id, {
                attributes: ['id', 'email', 'name'],
            }),
            describeResource(share.resource_type, share.resource_uid),
            GroupPermission.findAll({
                where: {
                    group_share_id: share.id,
                    resource_type: share.resource_type,
                    resource_uid: share.resource_uid,
                    user_id: userIds,
                    status: 'pending',
                },
                attributes: ['id', 'user_id'],
                raw: true,
            }),
        ]);

        const inviterLabel = actor?.name || actor?.email || 'Someone';
        const resourceLabel = resourceName || share.resource_type;
        const accessLabel =
            share.access_level === 'rw' ? 'read & write' : 'read only';

        for (const row of rootRows) {
            await Notification.createNotification({
                userId: row.user_id,
                type: 'share_invitation',
                title: `${inviterLabel} shared a ${share.resource_type} with ${group.name}`,
                message: `"${resourceLabel}" was shared with the group "${group.name}" (${accessLabel}). Accept to add it to your workspace.`,
                data: {
                    invitationId: `g${row.id}`,
                    actionId: null,
                    resourceType: share.resource_type,
                    resourceUid: share.resource_uid,
                    resourceName,
                    accessLevel: share.access_level,
                    inviterEmail: actor?.email || null,
                    groupName: group.name,
                    groupUid: group.uid,
                },
            });
        }
    } catch (error) {
        // The grant is recorded; members can still find it under pending
        // shares if a notification fails.
        logError('Failed to create group share notifications:', error);
    }
}

// One notice per member a grant applied to at once (see
// resolveInitialStatuses). It has the invitation's shape without an
// invitation id, so the notification UI shows it without Accept or Decline.
async function notifyGrantees(share, group, userIds) {
    if (userIds.length === 0) return;
    try {
        const [actor, resourceName] = await Promise.all([
            User.findByPk(share.granted_by_user_id, {
                attributes: ['id', 'email', 'name'],
            }),
            describeResource(share.resource_type, share.resource_uid),
        ]);

        const inviterLabel = actor?.name || actor?.email || 'Someone';
        const resourceLabel = resourceName || share.resource_type;
        const accessLabel =
            share.access_level === 'rw' ? 'read & write' : 'read only';

        for (const userId of userIds) {
            await Notification.createNotification({
                userId,
                type: 'share_invitation',
                title: `${inviterLabel} shared a ${share.resource_type} with ${group.name}`,
                message: `"${resourceLabel}" was shared with the group "${group.name}" (${accessLabel}). It is in your workspace now.`,
                data: {
                    invitationId: null,
                    accepted: true,
                    actionId: null,
                    resourceType: share.resource_type,
                    resourceUid: share.resource_uid,
                    resourceName,
                    projectUid:
                        share.resource_type === 'project'
                            ? share.resource_uid
                            : undefined,
                    accessLevel: share.access_level,
                    inviterEmail: actor?.email || null,
                    groupName: group.name,
                    groupUid: group.uid,
                },
            });
        }
    } catch (error) {
        // The grant is recorded and already applies; a failed notice must
        // not undo it.
        logError('Failed to create group share notifications:', error);
    }
}

// Splits the members whose root row was just created by how they should hear
// about it.
function sortNotified(plans, createdUserIds) {
    const invited = [];
    const told = [];
    for (const userId of createdUserIds) {
        const notify = plans.get(userId)?.notify;
        if (notify === 'invitation') invited.push(userId);
        else if (notify === 'notice') told.push(userId);
    }
    return { invited, told };
}

// Grants a group access to a resource. Every current member gets rows (pending
// unless they already hold that access or the actor is an admin of their
// account), and members added later get theirs
// when they join. Re-sharing to the same group only raises the level.
async function grantToGroup({
    actorUserId,
    group,
    resourceType,
    resourceUid,
    accessLevel,
    ownerUserId,
}) {
    const existing = await GroupShare.findOne({
        where: {
            group_id: group.id,
            resource_type: resourceType,
            resource_uid: resourceUid,
        },
    });
    const level = existing
        ? maxLevel(existing.access_level, accessLevel)
        : accessLevel;

    const members = await UserGroupMember.findAll({
        where: { group_id: group.id },
        attributes: ['user_id'],
        raw: true,
    });
    const memberIds = members
        .map((m) => m.user_id)
        .filter((id) => id !== ownerUserId);

    const plans = await resolveInitialStatuses(
        {
            resource_type: resourceType,
            resource_uid: resourceUid,
            access_level: level,
        },
        memberIds,
        actorUserId
    );

    const { share, createdUserIds } = await sequelize.transaction(
        async (tx) => {
            const grant = existing
                ? await existing.update(
                      { access_level: level },
                      { transaction: tx }
                  )
                : await GroupShare.create(
                      {
                          group_id: group.id,
                          resource_type: resourceType,
                          resource_uid: resourceUid,
                          access_level: level,
                          granted_by_user_id: actorUserId,
                      },
                      { transaction: tx }
                  );

            const template = await computeGrantRows(tx, grant);
            const created = [];
            for (const userId of memberIds) {
                const rootCreated = await writeMemberRows(
                    tx,
                    grant,
                    userId,
                    template,
                    plans.get(userId).status
                );
                if (rootCreated) created.push(userId);
            }
            return { share: grant, createdUserIds: created };
        }
    );

    const { invited, told } = sortNotified(plans, createdUserIds);
    await notifyInvitees(share, group, invited);
    await notifyGrantees(share, group, told);
    return share;
}

// The (user, project) pairs a set of group rows reaches, for taking people
// off the open tasks of projects they can no longer open.
async function projectPairsOf(where, tx) {
    const rows = await GroupPermission.findAll({
        where: { ...where, resource_type: 'project' },
        attributes: ['user_id', 'resource_uid'],
        raw: true,
        transaction: tx,
    });
    return rows.map((r) => ({ userId: r.user_id, projectUid: r.resource_uid }));
}

async function revokeFromGroup({ group, resourceType, resourceUid }) {
    const pairs = await sequelize.transaction(async (tx) => {
        const share = await GroupShare.findOne({
            where: {
                group_id: group.id,
                resource_type: resourceType,
                resource_uid: resourceUid,
            },
            transaction: tx,
        });
        if (!share) {
            throw new NotFoundError(
                'This resource is not shared with the group'
            );
        }
        const lost = await projectPairsOf({ group_share_id: share.id }, tx);
        await GroupPermission.destroy({
            where: { group_share_id: share.id },
            transaction: tx,
        });
        await share.destroy({ transaction: tx });
        return lost;
    });
    await unassignAfterAccessLoss(pairs);
}

// The groups a resource is shared with, with how many members have accepted
// or still have to answer. Member identities are not exposed.
async function listForResource(resourceType, resourceUid) {
    const shares = await GroupShare.findAll({
        where: { resource_type: resourceType, resource_uid: resourceUid },
        include: [
            {
                model: UserGroup,
                as: 'Group',
                attributes: ['id', 'uid', 'name'],
                required: true,
            },
        ],
        order: [['id', 'ASC']],
    });

    return Promise.all(
        shares.map(async (share) => {
            const [memberCount, rootRows] = await Promise.all([
                UserGroupMember.count({
                    where: { group_id: share.group_id },
                }),
                GroupPermission.findAll({
                    where: {
                        group_share_id: share.id,
                        resource_type: resourceType,
                        resource_uid: resourceUid,
                    },
                    attributes: ['status'],
                    raw: true,
                }),
            ]);
            return {
                group_uid: share.Group.uid,
                group_name: share.Group.name,
                access_level: share.access_level,
                member_count: memberCount,
                accepted_count: rootRows.filter((r) => r.status === 'accepted')
                    .length,
                pending_count: rootRows.filter((r) => r.status === 'pending')
                    .length,
                created_at: share.created_at,
            };
        })
    );
}

// Adds members and gives each of them access to everything already shared with
// the group, as invitations unless they already hold that access or whoever
// shared it is an admin of their account. The membership and their rows
// commit together.
async function addMembers({ group, userIds, addedByUserId }) {
    if (userIds.length === 0) return;

    const shares = await GroupShare.findAll({
        where: { group_id: group.id },
        order: [['id', 'ASC']],
    });

    const plans = [];
    for (const share of shares) {
        const resource = await RESOURCES[share.resource_type].model.findOne({
            where: { uid: share.resource_uid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!resource) continue;
        const eligible = userIds.filter((id) => id !== resource.user_id);
        plans.push({
            share,
            eligible,
            statuses: await resolveInitialStatuses(
                share,
                eligible,
                share.granted_by_user_id
            ),
        });
    }

    const toNotify = await sequelize.transaction(async (tx) => {
        await UserGroupMember.bulkCreate(
            userIds.map((userId) => ({
                group_id: group.id,
                user_id: userId,
                added_by_user_id: addedByUserId,
            })),
            { transaction: tx }
        );

        const written = [];
        for (const { share, eligible, statuses } of plans) {
            const template = await computeGrantRows(tx, share);
            const created = [];
            for (const userId of eligible) {
                const rootCreated = await writeMemberRows(
                    tx,
                    share,
                    userId,
                    template,
                    statuses.get(userId).status
                );
                if (rootCreated) created.push(userId);
            }
            written.push({ share, statuses, created });
        }
        return written;
    });

    for (const { share, statuses, created } of toNotify) {
        const { invited, told } = sortNotified(statuses, created);
        await notifyInvitees(share, group, invited);
        await notifyGrantees(share, group, told);
    }
}

// Removes a member and only the access that came through this group. Direct
// shares and other groups keep working. Returns whether they were a member.
async function removeMember({ group, userId }) {
    const pairs = await sequelize.transaction(async (tx) => {
        const removed = await UserGroupMember.destroy({
            where: { group_id: group.id, user_id: userId },
            transaction: tx,
        });
        if (!removed) return null;

        const shares = await GroupShare.findAll({
            where: { group_id: group.id },
            attributes: ['id'],
            raw: true,
            transaction: tx,
        });
        const where = {
            user_id: userId,
            group_share_id: shares.map((s) => s.id),
        };
        const lost = await projectPairsOf(where, tx);
        await GroupPermission.destroy({ where, transaction: tx });
        return lost;
    });
    if (!pairs) return false;
    await unassignAfterAccessLoss(pairs);
    return true;
}

// Called when a project lands in an area or goal that is shared with a group:
// copies each member's container access onto the project and everything in
// it. Rows keep the container grant's status, so a member who has not
// accepted the container yet does not see the new project early.
async function mirrorContainerGrants(tx, project, containers) {
    const containerRows = [];
    for (const container of containers) {
        containerRows.push(
            ...(await GroupPermission.findAll({
                where: {
                    resource_type: container.type,
                    resource_uid: container.uid,
                    propagation: 'direct',
                },
                transaction: tx,
                raw: true,
            }))
        );
    }

    const templatesByLevel = new Map();
    for (const row of containerRows) {
        if (row.user_id === project.user_id) continue;

        let template = templatesByLevel.get(row.access_level);
        if (!template) {
            const changes = { upserts: [], deletes: [] };
            await projectSubtreeChanges(
                changes,
                {
                    id: project.id,
                    uid: project.uid,
                    user_id: project.user_id,
                },
                {
                    verb: 'share_grant',
                    actorUserId: row.granted_by_user_id,
                    targetUserId: null,
                    accessLevel: row.access_level,
                },
                'inherited'
            );
            template = changes.upserts;
            templatesByLevel.set(row.access_level, template);
        }

        await writeMemberRows(
            tx,
            {
                id: row.group_share_id,
                granted_by_user_id: row.granted_by_user_id,
                resource_type: 'project',
                resource_uid: project.uid,
            },
            row.user_id,
            template,
            row.status
        );
    }
}

module.exports = {
    grantToGroup,
    revokeFromGroup,
    listForResource,
    addMembers,
    removeMember,
    mirrorContainerGrants,
};
