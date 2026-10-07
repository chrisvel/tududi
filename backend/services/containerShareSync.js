'use strict';

const { sequelize, Permission, Area, Goal, Project } = require('../models');
const { applyPerms } = require('./applyPerms');
const { projectSubtreeChanges } = require('./permissionsCalculators');
const { mirrorContainerGrants } = require('./groupSharing');
const { logError } = require('./logService');

async function findContainers(tx, project) {
    const containers = [];

    if (project.area_id) {
        const area = await Area.findByPk(project.area_id, {
            attributes: ['uid'],
            transaction: tx,
        });
        if (area) containers.push({ type: 'area', uid: area.uid });
    }

    if (project.goal_id) {
        const goal = await Goal.findByPk(project.goal_id, {
            attributes: ['uid'],
            transaction: tx,
        });
        if (goal) containers.push({ type: 'goal', uid: goal.uid });
    }

    return containers;
}

async function mirrorDirectShares(tx, project, containers) {
    const containerPerms = [];
    for (const container of containers) {
        containerPerms.push(
            ...(await Permission.findAll({
                where: {
                    resource_type: container.type,
                    resource_uid: container.uid,
                },
                transaction: tx,
                raw: true,
            }))
        );
    }

    if (containerPerms.length === 0) return;

    // One grant per target user: highest access wins, an accepted grant
    // beats a pending one.
    const byUser = new Map();
    for (const perm of containerPerms) {
        if (perm.user_id === project.user_id) continue;
        const current = byUser.get(perm.user_id);
        if (!current) {
            byUser.set(perm.user_id, perm);
            continue;
        }
        const better =
            (perm.access_level === 'rw' && current.access_level !== 'rw') ||
            (perm.status === 'accepted' && current.status !== 'accepted');
        if (better) byUser.set(perm.user_id, perm);
    }

    const changes = { upserts: [], deletes: [] };
    for (const perm of byUser.values()) {
        const before = changes.upserts.length;
        await projectSubtreeChanges(
            changes,
            {
                id: project.id,
                uid: project.uid,
                user_id: project.user_id,
            },
            {
                verb: 'share_grant',
                targetUserId: perm.user_id,
                actorUserId: perm.granted_by_user_id || project.user_id,
                accessLevel: perm.access_level,
            },
            'inherited'
        );
        for (let i = before; i < changes.upserts.length; i++) {
            changes.upserts[i].status = perm.status;
            changes.upserts[i].sourceActionId = perm.source_action_id;
        }
    }

    await applyPerms(tx, changes);
}

// When a project is created in (or moved into) a shared area or goal, mirror
// that container's shares onto the project and its task/note subtree, so a
// collaborator does not have to be re-invited for every new project. Rows are
// written with the same status and source_action_id as the container grant, so
// a still-pending invite does not leak the new project early and accepting or
// declining still moves the whole set together. Group grants on the container
// are mirrored the same way into group_permissions.
async function syncProjectSharesFromContainer(projectId) {
    try {
        await sequelize.transaction(async (tx) => {
            const project = await Project.findByPk(projectId, {
                attributes: ['id', 'uid', 'user_id', 'area_id', 'goal_id'],
                transaction: tx,
            });
            if (!project) return;

            const containers = await findContainers(tx, project);
            if (containers.length === 0) return;

            await mirrorDirectShares(tx, project, containers);
            await mirrorContainerGrants(tx, project, containers);
        });
    } catch (error) {
        // A failed mirror must not fail the project write; the owner can
        // re-share the container to reconcile.
        logError(error, `Failed to sync project shares (project ${projectId})`);
    }
}

module.exports = { syncProjectSharesFromContainer };
