const { Op } = require('sequelize');
const {
    Project,
    Task,
    Note,
    Area,
    Goal,
    Person,
    Permission,
} = require('../models');
const { isAdmin } = require('./rolesService');

const ACCESS = { NONE: 'none', RO: 'ro', RW: 'rw', ADMIN: 'admin' };

async function getSharedUidsForUser(resourceType, userId) {
    const rows = await Permission.findAll({
        where: {
            user_id: userId,
            resource_type: resourceType,
            status: 'accepted',
        },
        attributes: ['resource_uid'],
        raw: true,
    });
    const set = new Set(rows.map((r) => r.resource_uid));
    return Array.from(set);
}

const RESOURCE_MODELS = {
    project: Project,
    task: Task,
    note: Note,
    area: Area,
    goal: Goal,
};

// The uids of every Person record that points at this user's account (normally
// just their self-person). A task assigned to any of these is "assigned to me".
async function getMyPersonUids(userId) {
    const rows = await Person.findAll({
        where: { linked_user_id: userId },
        attributes: ['uid'],
        raw: true,
    });
    return rows.map((r) => r.uid);
}

// Whether the resource row still exists, regardless of who may read it.
// Used to tell "gone" apart from "not yours" when access is denied.
async function resourceExists(resourceType, resourceUid) {
    const model = RESOURCE_MODELS[resourceType];
    if (!model || !resourceUid) return false;

    const row = await model.findOne({
        where: { uid: resourceUid },
        attributes: ['id'],
        raw: true,
    });
    return !!row;
}

async function getAccess(userId, resourceType, resourceUid) {
    // Admins get no blanket access to other users' resources: they are scoped
    // like regular users and use the dedicated admin endpoints instead (same
    // rule as ownershipOrPermissionWhere below).

    // ownership via model
    if (resourceType === 'project') {
        const proj = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!proj) return ACCESS.NONE;
        if (proj.user_id === userId) return ACCESS.RW;
    } else if (resourceType === 'task') {
        const t = await Task.findOne({
            where: { uid: resourceUid },
            attributes: [
                'user_id',
                'project_id',
                'parent_task_id',
                'assigned_to',
            ],
            raw: true,
        });
        if (!t) return ACCESS.NONE;
        if (t.user_id === userId) return ACCESS.RW;

        // A task assigned to the caller is theirs to act on, wherever it lives.
        if (t.assigned_to) {
            const myPersonUids = await getMyPersonUids(userId);
            if (myPersonUids.includes(t.assigned_to)) return ACCESS.RW;
        }

        // Subtasks don't always carry their own project_id, so walk up the
        // parent chain to find the project (or an owning ancestor) they
        // belong to (#1425).
        let projectId = t.project_id;
        let current = t;
        while (!projectId && current.parent_task_id) {
            current = await Task.findOne({
                where: { id: current.parent_task_id },
                attributes: ['user_id', 'project_id', 'parent_task_id'],
                raw: true,
            });
            if (!current) break;
            if (current.user_id === userId) return ACCESS.RW;
            projectId = current.project_id;
        }

        // Check if user has access through the parent project
        if (projectId) {
            const project = await Project.findOne({
                where: { id: projectId },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    userId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess; // Inherit access from project
                }
            }
        }
    } else if (resourceType === 'note') {
        const n = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });
        if (!n) return ACCESS.NONE;
        if (n.user_id === userId) return ACCESS.RW;

        // Check if user has access through the parent project
        if (n.project_id) {
            const project = await Project.findOne({
                where: { id: n.project_id },
                attributes: ['uid'],
                raw: true,
            });
            if (project) {
                const projectAccess = await getAccess(
                    userId,
                    'project',
                    project.uid
                );
                if (projectAccess !== ACCESS.NONE) {
                    return projectAccess; // Inherit access from project
                }
            }
        }
    } else if (resourceType === 'area') {
        const area = await Area.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!area) return ACCESS.NONE;
        if (area.user_id === userId) return ACCESS.RW;
    } else if (resourceType === 'goal') {
        const goal = await Goal.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!goal) return ACCESS.NONE;
        if (goal.user_id === userId) return ACCESS.RW;
    }

    // shared
    const perm = await Permission.findOne({
        where: {
            user_id: userId,
            resource_type: resourceType,
            resource_uid: resourceUid,
            status: 'accepted',
        },
        attributes: ['access_level'],
        raw: true,
    });
    return perm ? perm.access_level : ACCESS.NONE;
}

async function ownershipOrPermissionWhere(resourceType, userId, cache = null) {
    // Check cache first (request-scoped)
    const cacheKey = `permission_${resourceType}_${userId}`;
    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    // Build WHERE clause for resource queries based on ownership and sharing permissions
    // Note: isAdmin expects a UID, but we might receive a numeric ID
    // Get the user's UID if we received a numeric ID
    let userUid = userId;
    if (typeof userId === 'number' || !isNaN(parseInt(userId))) {
        const { User } = require('../models');
        const user = await User.findByPk(userId, {
            attributes: ['uid', 'email'],
        });
        if (user) {
            userUid = user.uid;
        }
    }

    const isUserAdmin = await isAdmin(userUid);

    // Admin users should NOT see all resources automatically
    // They should only see their own resources and shared resources, like regular users
    // If admin-level system-wide visibility is needed, it should be via dedicated admin endpoints

    const sharedUids = await getSharedUidsForUser(resourceType, userId);

    // For tasks and notes, also include items from shared projects
    if (resourceType === 'task' || resourceType === 'note') {
        const sharedProjectUids = await getSharedUidsForUser('project', userId);

        // Get the project IDs for shared projects
        let sharedProjectIds = [];
        if (sharedProjectUids.length > 0) {
            const projects = await Project.findAll({
                where: { uid: { [Op.in]: sharedProjectUids } },
                attributes: ['id'],
                raw: true,
            });
            sharedProjectIds = projects.map((p) => p.id);
        }

        const conditions = [
            { user_id: userId }, // Items owned by user
        ];

        if (sharedUids.length > 0) {
            conditions.push({ uid: { [Op.in]: sharedUids } }); // Items directly shared with user
        }

        if (sharedProjectIds.length > 0) {
            conditions.push({ project_id: { [Op.in]: sharedProjectIds } }); // Items in shared projects
        }

        // Tasks assigned to the caller show up even when they own nothing else
        // in the task's project.
        if (resourceType === 'task') {
            const myPersonUids = await getMyPersonUids(userId);
            if (myPersonUids.length > 0) {
                conditions.push({ assigned_to: { [Op.in]: myPersonUids } });
            }
        }

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For other resource types (projects, etc.), use the original logic
    const result = {
        [Op.or]: [
            { user_id: userId },
            sharedUids.length
                ? { uid: { [Op.in]: sharedUids } }
                : { uid: null },
        ],
    };
    if (cache) cache.set(cacheKey, result);
    return result;
}

module.exports = {
    ACCESS,
    getAccess,
    resourceExists,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
    getMyPersonUids,
};
