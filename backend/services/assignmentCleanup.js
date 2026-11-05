'use strict';

const { Op } = require('sequelize');
const {
    Task,
    Project,
    Area,
    Goal,
    Person,
    User,
    Notification,
} = require('../models');
const permissionsService = require('./permissionsService');
const permissionSources = require('./permissionSources');
const { logError } = require('./logService');

// Assignment gives the assignee access to a task by itself, so a task stays
// open to someone after their access to its project ends unless it loses
// them as assignee. Called after every revoke with the users who may have
// lost access and the projects they may have lost: each pair is re-checked,
// and only users with no way left into the project are taken off its open
// tasks. The project owner gets one notification per project and user.

const CLOSED_STATUSES = [
    Task.STATUS.DONE,
    Task.STATUS.ARCHIVED,
    Task.STATUS.CANCELLED,
];

// The project uids a share on this resource reaches.
async function projectUidsUnder(resourceType, resourceUid) {
    if (resourceType === 'project') return [resourceUid];
    if (resourceType !== 'area' && resourceType !== 'goal') return [];
    const model = resourceType === 'area' ? Area : Goal;
    const container = await model.findOne({
        where: { uid: resourceUid },
        attributes: ['id'],
        raw: true,
    });
    if (!container) return [];
    const projects = await Project.findAll({
        where: { [`${resourceType}_id`]: container.id },
        attributes: ['uid'],
        raw: true,
    });
    return projects.map((p) => p.uid);
}

// Every task in the project, subtasks included (they don't always carry
// their own project_id).
async function projectTasks(projectId) {
    const tasks = [];
    const seen = new Set();
    let level = await Task.findAll({
        where: { project_id: projectId },
        attributes: ['id', 'uid', 'parent_task_id', 'status', 'assigned_to'],
        raw: true,
    });
    while (level.length > 0) {
        const fresh = level.filter((t) => !seen.has(t.id));
        if (fresh.length === 0) break;
        fresh.forEach((t) => seen.add(t.id));
        tasks.push(...fresh);
        level = await Task.findAll({
            where: { parent_task_id: { [Op.in]: fresh.map((t) => t.id) } },
            attributes: [
                'id',
                'uid',
                'parent_task_id',
                'status',
                'assigned_to',
            ],
            raw: true,
        });
    }
    return tasks;
}

// The task uids shared with the user on their own (not through the project),
// which keep the task and its subtasks theirs.
async function directlySharedTaskUids(userId, tasks) {
    if (tasks.length === 0) return new Set();
    const rows = await permissionSources.findAccepted(
        {
            user_id: userId,
            resource_type: 'task',
            resource_uid: tasks.map((t) => t.uid),
            propagation: 'direct',
        },
        ['resource_uid']
    );
    return new Set(rows.map((r) => r.resource_uid));
}

async function notifyProjectOwner(project, user, taskUids) {
    const count = taskUids.length;
    const userLabel = user?.name || user?.email || 'A member';
    const tasksLabel = count === 1 ? '1 task' : `${count} tasks`;
    await Notification.createNotification({
        userId: project.user_id,
        type: 'system',
        title: `${tasksLabel} in "${project.name}" were unassigned`,
        message: `${userLabel} no longer has access to "${project.name}", so their open tasks there were unassigned.`,
        data: {
            reason: 'assignee_lost_access',
            projectUid: project.uid,
            projectName: project.name,
            count,
            taskUids,
            unassignedUserId: user?.id || null,
            unassignedUserName: user?.name || null,
        },
    });
}

async function cleanupUserProject(user, personUids, project) {
    const access = await permissionsService.getAccess(
        user.id,
        'project',
        project.uid
    );
    if (access !== 'none') return;

    const tasks = await projectTasks(project.id);
    const assigned = tasks.filter(
        (t) =>
            personUids.includes(t.assigned_to) &&
            !CLOSED_STATUSES.includes(t.status)
    );
    if (assigned.length === 0) return;

    const direct = await directlySharedTaskUids(user.id, tasks);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const sharedOnItsOwn = (task) => {
        for (let t = task; t; t = byId.get(t.parent_task_id)) {
            if (direct.has(t.uid)) return true;
        }
        return false;
    };

    const unassigned = [];
    for (const task of assigned) {
        if (sharedOnItsOwn(task)) continue;
        // One update per task so task hooks (webhooks) still fire.
        const row = await Task.findByPk(task.id);
        if (!row || !personUids.includes(row.assigned_to)) continue;
        await row.update({ assigned_to: null });
        unassigned.push(row.uid);
    }

    if (unassigned.length > 0 && project.user_id !== user.id) {
        await notifyProjectOwner(project, user, unassigned);
    }
}

// pairs: [{ userId, projectUid }]. Never throws: the revoke has already
// happened and must not be reported as failed because of this.
async function unassignAfterAccessLoss(pairs) {
    try {
        const byUser = new Map();
        for (const { userId, projectUid } of pairs || []) {
            if (!userId || !projectUid) continue;
            if (!byUser.has(userId)) byUser.set(userId, new Set());
            byUser.get(userId).add(projectUid);
        }

        for (const [userId, projectUids] of byUser) {
            const persons = await Person.findAll({
                where: { linked_user_id: userId },
                attributes: ['uid'],
                raw: true,
            });
            if (persons.length === 0) continue;
            const personUids = persons.map((p) => p.uid);

            const user = await User.findByPk(userId, {
                attributes: ['id', 'name', 'email'],
                raw: true,
            });
            if (!user) continue;

            const projects = await Project.findAll({
                where: { uid: { [Op.in]: Array.from(projectUids) } },
                attributes: ['id', 'uid', 'name', 'user_id'],
                raw: true,
            });
            for (const project of projects) {
                await cleanupUserProject(user, personUids, project);
            }
        }
    } catch (error) {
        logError(error, 'Failed to unassign tasks after access ended');
    }
}

// The same, for one user losing a share on a project, area or goal.
async function unassignAfterShareRevoke(userId, resourceType, resourceUid) {
    try {
        const projectUids = await projectUidsUnder(resourceType, resourceUid);
        await unassignAfterAccessLoss(
            projectUids.map((projectUid) => ({ userId, projectUid }))
        );
    } catch (error) {
        logError(error, 'Failed to unassign tasks after a share was revoked');
    }
}

module.exports = {
    unassignAfterAccessLoss,
    unassignAfterShareRevoke,
};
