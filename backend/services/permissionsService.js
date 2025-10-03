const { Op } = require('sequelize');
const { Project, Task, Note, Permission } = require('../models');
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

async function getAccess(userId, resourceType, resourceUid) {
    if (await isAdmin(userId)) return ACCESS.ADMIN;

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
            attributes: ['user_id'],
            raw: true,
        });
        if (!t) return ACCESS.NONE;
        if (t.user_id === userId) return ACCESS.RW;
    } else if (resourceType === 'note') {
        const n = await Note.findOne({
            where: { uid: resourceUid },
            attributes: ['user_id'],
            raw: true,
        });
        if (!n) return ACCESS.NONE;
        if (n.user_id === userId) return ACCESS.RW;
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

async function ownershipOrPermissionWhere(resourceType, userId) {
    // Admin users can see all resources
    if (await isAdmin(userId)) {
        return {}; // empty where clause = no restriction
    }

    const sharedUids = await getSharedUidsForUser(resourceType, userId);
    return {
        [Op.or]: [
            { user_id: userId },
            sharedUids.length
                ? { uid: { [Op.in]: sharedUids } }
                : { uid: null },
        ],
    };
}

module.exports = {
    ACCESS,
    getAccess,
    ownershipOrPermissionWhere,
    getSharedUidsForUser,
};
