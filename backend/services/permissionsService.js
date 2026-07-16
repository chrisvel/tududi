const { Op } = require('sequelize');
const { Project, Task, Note, Area, Permission } = require('../models');
const { isAdmin } = require('./rolesService');

const ACCESS = { NONE: 'none', RO: 'ro', RW: 'rw', ADMIN: 'admin' };

async function getSharedUidsForUser(resourceType, userId) {
    const rows = await Permission.findAll({
        where: { user_id: userId, resource_type: resourceType },
        attributes: ['resource_uid'],
        raw: true,
    });
    const set = new Set(rows.map((r) => r.resource_uid));
    return Array.from(set);
}

// Numeric ids of areas shared with the user. Projects inside shared areas
// (and their tasks/notes) are derived from these at query time, so area
// membership changes take effect immediately without permission recompute.
async function getSharedAreaIds(userId) {
    const sharedAreaUids = await getSharedUidsForUser('area', userId);
    if (sharedAreaUids.length === 0) return [];
    const areas = await Area.findAll({
        where: { uid: { [Op.in]: sharedAreaUids } },
        attributes: ['id'],
        raw: true,
    });
    return areas.map((a) => a.id);
}

async function getAccess(userId, resourceType, resourceUid) {
    if (await isAdmin(userId)) return ACCESS.ADMIN;

    // ownership via model
    if (resourceType === 'project') {
        const proj = await Project.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'area_id'],
            raw: true,
        });
        if (!proj) return ACCESS.NONE;
        if (proj.user_id === userId) return ACCESS.RW;

        // Check if user has access through the parent area
        if (proj.area_id) {
            const area = await Area.findOne({
                where: { id: proj.area_id },
                attributes: ['uid'],
                raw: true,
            });
            if (area) {
                const areaAccess = await getAccess(userId, 'area', area.uid);
                if (areaAccess !== ACCESS.NONE) {
                    return areaAccess; // Inherit access from area
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
    } else if (resourceType === 'task') {
        const t = await Task.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id', 'project_id'],
            raw: true,
        });
        if (!t) return ACCESS.NONE;
        if (t.user_id === userId) return ACCESS.RW;

        // Check if user has access through the parent project
        if (t.project_id) {
            const project = await Project.findOne({
                where: { id: t.project_id },
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
    }

    // shared
    const perm = await Permission.findOne({
        where: {
            user_id: userId,
            resource_type: resourceType,
            resource_uid: resourceUid,
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

    // For tasks and notes, also include items from shared projects and from
    // projects that live in shared areas
    if (resourceType === 'task' || resourceType === 'note') {
        const sharedProjectUids = await getSharedUidsForUser('project', userId);
        const sharedAreaIds = await getSharedAreaIds(userId);

        // Get the project IDs for shared projects / projects in shared areas
        let sharedProjectIds = [];
        if (sharedProjectUids.length > 0 || sharedAreaIds.length > 0) {
            const projectConditions = [];
            if (sharedProjectUids.length > 0) {
                projectConditions.push({
                    uid: { [Op.in]: sharedProjectUids },
                });
            }
            if (sharedAreaIds.length > 0) {
                projectConditions.push({
                    area_id: { [Op.in]: sharedAreaIds },
                });
            }
            const projects = await Project.findAll({
                where: { [Op.or]: projectConditions },
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

        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For projects, also include projects that live in shared areas
    if (resourceType === 'project') {
        const sharedAreaIds = await getSharedAreaIds(userId);
        const conditions = [{ user_id: userId }];
        if (sharedUids.length > 0) {
            conditions.push({ uid: { [Op.in]: sharedUids } });
        }
        if (sharedAreaIds.length > 0) {
            conditions.push({ area_id: { [Op.in]: sharedAreaIds } });
        }
        const result = { [Op.or]: conditions };
        if (cache) cache.set(cacheKey, result);
        return result;
    }

    // For other resource types, use the original logic
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
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
};
