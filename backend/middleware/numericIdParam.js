const permissionsService = require('../services/permissionsService');

// uids are 15 characters, so a value of at most 9 digits can only be a
// numeric primary key.
const NUMERIC_ID = /^\d{1,9}$/;

// Router param handler that lets a route accept the numeric id shown in API
// payloads as well as the uid. The id is swapped for the row's uid only when
// the caller already has access to it, so an id that does not exist and one
// that belongs to someone else stay indistinguishable.
function numericIdParam(resourceType, Model) {
    return async (req, res, next, value, name) => {
        try {
            if (!NUMERIC_ID.test(value)) return next();

            const userId = req.currentUser?.id || req.session?.userId;
            if (!userId) return next();

            const row = await Model.findByPk(Number(value), {
                attributes: ['uid'],
                raw: true,
            });
            if (!row) return next();

            const access = await permissionsService.getAccess(
                userId,
                resourceType,
                row.uid
            );
            if (access !== permissionsService.ACCESS.NONE) {
                req.params[name] = row.uid;
            }
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = { numericIdParam };
