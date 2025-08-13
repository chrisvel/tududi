const permissionsService = require('../services/permissionsService');

// requiredAccess: 'ro' | 'rw' | 'admin'
// resourceType: 'project' | 'task' | 'note'
// getResourceUid: function(req) => string | Promise<string>
function hasAccess(requiredAccess, resourceType, getResourceUid, options = {}) {
    const notFoundMessage = options.notFoundMessage || 'Not found';
    const forbiddenStatus = options.forbiddenStatus || 403; // 403 by default; can be 404 for legacy routes
    const LEVELS = { none: 0, ro: 1, rw: 2, admin: 3 };
    return async function (req, res, next) {
        try {
            const uid = await (typeof getResourceUid === 'function'
                ? getResourceUid(req)
                : getResourceUid);
            if (!uid) return res.status(404).json({ error: notFoundMessage });

            const access = await permissionsService.getAccess(
                req.currentUser?.id || req.session?.userId,
                resourceType,
                uid
            );
            if (LEVELS[access] >= LEVELS[requiredAccess]) return next();
            if (forbiddenStatus === 404) {
                return res.status(404).json({ error: notFoundMessage });
            }
            return res.status(403).json({ error: 'Forbidden' });
        } catch (err) {
            next(err);
        }
    };
}

module.exports = { hasAccess };
