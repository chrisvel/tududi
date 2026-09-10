const { Project, Task, Note, Area, Goal } = require('../models');

function emptyChanges() {
    return { upserts: [], deletes: [] };
}

function pushUpsert(changes, u) {
    changes.upserts.push(u);
}
function pushDelete(changes, d) {
    changes.deletes.push(d);
}

async function collectProjectDescendants(projectId) {
    // tasks (all levels) and notes
    const rootTasks = await Task.findAll({
        where: { project_id: projectId },
        attributes: ['id', 'uid', 'parent_task_id'],
        raw: true,
    });
    const notes = await Note.findAll({
        where: { project_id: projectId },
        attributes: ['uid'],
        raw: true,
    });

    const taskUids = new Set();
    const queue = [...rootTasks];
    for (const t of rootTasks) taskUids.add(t.uid);
    while (queue.length) {
        const node = queue.shift();
        const children = await Task.findAll({
            where: { parent_task_id: node.id },
            attributes: ['id', 'uid'],
            raw: true,
        });
        for (const c of children) {
            if (!taskUids.has(c.uid)) {
                taskUids.add(c.uid);
                queue.push({ id: c.id });
            }
        }
    }
    return {
        taskUids: Array.from(taskUids),
        noteUids: notes.map((n) => n.uid),
    };
}

async function collectTaskSubtree(taskId, seedUid) {
    const taskUids = new Set(seedUid ? [seedUid] : []);
    const queue = [{ id: taskId }];
    while (queue.length) {
        const node = queue.shift();
        const children = await Task.findAll({
            where: { parent_task_id: node.id },
            attributes: ['id', 'uid'],
            raw: true,
        });
        for (const c of children) {
            if (!taskUids.has(c.uid)) {
                taskUids.add(c.uid);
                queue.push({ id: c.id });
            }
        }
    }
    return Array.from(taskUids);
}

// Emit the permission changes for one project and everything under it (tasks at
// all depths, notes). `projectPropagation` is 'direct' for a plain project share
// and 'inherited' when the project is being cascaded from an area or goal grant.
async function projectSubtreeChanges(
    changes,
    project,
    action,
    projectPropagation
) {
    const { taskUids, noteUids } = await collectProjectDescendants(project.id);

    if (action.verb === 'share_grant') {
        pushUpsert(changes, {
            userId: action.targetUserId,
            resourceType: 'project',
            resourceUid: project.uid,
            accessLevel: action.accessLevel,
            propagation: projectPropagation,
            grantedByUserId: action.actorUserId,
        });
        for (const tuid of taskUids)
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
        for (const nuid of noteUids)
            pushUpsert(changes, {
                userId: action.targetUserId,
                resourceType: 'note',
                resourceUid: nuid,
                accessLevel: action.accessLevel,
                propagation: 'inherited',
                grantedByUserId: action.actorUserId,
            });
    } else if (action.verb === 'share_revoke') {
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType: 'project',
            resourceUid: project.uid,
        });
        for (const tuid of taskUids)
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'task',
                resourceUid: tuid,
            });
        for (const nuid of noteUids)
            pushDelete(changes, {
                userId: action.targetUserId,
                resourceType: 'note',
                resourceUid: nuid,
            });
    }
}

function taskUidChange(changes, action, taskUid, propagation) {
    if (action.verb === 'share_grant') {
        pushUpsert(changes, {
            userId: action.targetUserId,
            resourceType: 'task',
            resourceUid: taskUid,
            accessLevel: action.accessLevel,
            propagation,
            grantedByUserId: action.actorUserId,
        });
    } else if (action.verb === 'share_revoke') {
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType: 'task',
            resourceUid: taskUid,
        });
    }
}

async function calculateProjectPerms(ctx, action) {
    const changes = emptyChanges();
    const project = await Project.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id', 'uid', 'user_id'],
        transaction: ctx.tx,
    });
    if (!project) return changes;

    await projectSubtreeChanges(changes, project, action, 'direct');
    return changes;
}

async function calculateTaskPerms(ctx, action) {
    // Handle single task subtree (task + subtasks)
    const changes = emptyChanges();
    const task = await Task.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id'],
        transaction: ctx.tx,
    });
    if (!task) return changes;

    const taskUids = await collectTaskSubtree(task.id, action.resourceUid);
    for (const tuid of taskUids) {
        taskUidChange(
            changes,
            action,
            tuid,
            tuid === action.resourceUid ? 'direct' : 'inherited'
        );
    }

    return changes;
}

async function calculateNotePerms(ctx, action) {
    const changes = emptyChanges();
    if (action.verb === 'share_grant') {
        pushUpsert(changes, {
            userId: action.targetUserId,
            resourceType: 'note',
            resourceUid: action.resourceUid,
            accessLevel: action.accessLevel,
            propagation: 'direct',
            grantedByUserId: action.actorUserId,
        });
    } else if (action.verb === 'share_revoke') {
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType: 'note',
            resourceUid: action.resourceUid,
        });
    }
    return changes;
}

function containerRowChange(changes, action, resourceType, resourceUid) {
    if (action.verb === 'share_grant') {
        pushUpsert(changes, {
            userId: action.targetUserId,
            resourceType,
            resourceUid,
            accessLevel: action.accessLevel,
            propagation: 'direct',
            grantedByUserId: action.actorUserId,
        });
    } else if (action.verb === 'share_revoke') {
        pushDelete(changes, {
            userId: action.targetUserId,
            resourceType,
            resourceUid,
        });
    }
}

// Sharing an area cascades to every project the area owner keeps in it, and each
// project's own task/note subtree. The area row itself is 'direct' so the share
// list, revoke and accept/decline set-move can find it; the projects and their
// children are 'inherited'. Projects added to the area later are covered by
// containerShareSync.syncProjectSharesFromContainer, not here.
async function calculateAreaPerms(ctx, action) {
    const changes = emptyChanges();
    const area = await Area.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id', 'uid', 'user_id'],
        transaction: ctx.tx,
    });
    if (!area) return changes;

    containerRowChange(changes, action, 'area', area.uid);

    const projects = await Project.findAll({
        where: { area_id: area.id, user_id: area.user_id },
        attributes: ['id', 'uid', 'user_id'],
        transaction: ctx.tx,
        raw: true,
    });
    for (const project of projects) {
        await projectSubtreeChanges(changes, project, action, 'inherited');
    }

    return changes;
}

// Sharing a goal cascades to its linked projects (and their subtrees) and to
// tasks assigned directly to the goal (plus their subtasks). Same 'direct' goal
// row + 'inherited' children shape as area sharing.
async function calculateGoalPerms(ctx, action) {
    const changes = emptyChanges();
    const goal = await Goal.findOne({
        where: { uid: action.resourceUid },
        attributes: ['id', 'uid', 'user_id'],
        transaction: ctx.tx,
    });
    if (!goal) return changes;

    containerRowChange(changes, action, 'goal', goal.uid);

    const projects = await Project.findAll({
        where: { goal_id: goal.id, user_id: goal.user_id },
        attributes: ['id', 'uid', 'user_id'],
        transaction: ctx.tx,
        raw: true,
    });
    for (const project of projects) {
        await projectSubtreeChanges(changes, project, action, 'inherited');
    }

    // Tasks attached straight to the goal (no project). Walk each subtask tree.
    const goalTasks = await Task.findAll({
        where: { goal_id: goal.id, parent_task_id: null },
        attributes: ['id', 'uid'],
        transaction: ctx.tx,
        raw: true,
    });
    for (const gt of goalTasks) {
        const taskUids = await collectTaskSubtree(gt.id, gt.uid);
        for (const tuid of taskUids) {
            taskUidChange(changes, action, tuid, 'inherited');
        }
    }

    return changes;
}

async function calculateTagPerms() {
    // No-op for now (tags excluded from project cascade)
    return emptyChanges();
}

module.exports = {
    calculateProjectPerms,
    calculateTaskPerms,
    calculateNotePerms,
    calculateAreaPerms,
    calculateGoalPerms,
    calculateTagPerms,
    collectProjectDescendants,
    projectSubtreeChanges,
};
