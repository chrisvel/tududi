const { Permission, GroupPermission } = require('../models');

// Access reaches a user from two places: a direct share (permissions) and a
// group grant (group_permissions). The tables share the columns used to ask
// "who can see what" (user_id, granted_by_user_id, resource_type,
// resource_uid, propagation, access_level, status), so reads that want every
// source go through here instead of querying Permission alone.

const SOURCES = [Permission, GroupPermission];
const LEVEL_RANK = { ro: 1, rw: 2 };

async function findAccepted(where, attributes) {
    const perSource = await Promise.all(
        SOURCES.map((model) =>
            model.findAll({
                where: { ...where, status: 'accepted' },
                attributes,
                raw: true,
            })
        )
    );
    return perSource.flat();
}

async function countAccepted(where) {
    const perSource = await Promise.all(
        SOURCES.map((model) =>
            model.count({ where: { ...where, status: 'accepted' } })
        )
    );
    return perSource.reduce((sum, n) => sum + n, 0);
}

// The highest accepted level the user holds on the resource across every
// source, or null. Skips the group lookup once a direct share is already rw.
async function findAcceptedAccessLevel(userId, resourceType, resourceUid) {
    const where = {
        user_id: userId,
        resource_type: resourceType,
        resource_uid: resourceUid,
        status: 'accepted',
    };
    const direct = await Permission.findOne({
        where,
        attributes: ['access_level'],
        raw: true,
    });
    if (direct && direct.access_level === 'rw') return 'rw';

    const groupRows = await GroupPermission.findAll({
        where,
        attributes: ['access_level'],
        raw: true,
    });

    const levels = groupRows.map((r) => r.access_level);
    if (direct) levels.push(direct.access_level);

    return levels.reduce(
        (best, level) =>
            (LEVEL_RANK[level] || 0) > (LEVEL_RANK[best] || 0) ? level : best,
        null
    );
}

// { resource_uid: number of distinct users with accepted access }.
async function countDistinctUsersByResource(resourceType, resourceUids) {
    if (resourceUids.length === 0) return {};
    const rows = await findAccepted(
        { resource_type: resourceType, resource_uid: resourceUids },
        ['resource_uid', 'user_id']
    );

    const usersByUid = {};
    rows.forEach((r) => {
        (usersByUid[r.resource_uid] ||= new Set()).add(r.user_id);
    });
    return Object.fromEntries(
        Object.entries(usersByUid).map(([uid, users]) => [uid, users.size])
    );
}

module.exports = {
    findAccepted,
    countAccepted,
    findAcceptedAccessLevel,
    countDistinctUsersByResource,
};
