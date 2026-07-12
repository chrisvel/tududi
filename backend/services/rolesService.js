const { Role, User } = require('../models');

async function isAdmin(userIdOrUid) {
    if (
        userIdOrUid === null ||
        userIdOrUid === undefined ||
        userIdOrUid === ''
    ) {
        return false;
    }

    let user = null;
    if (typeof userIdOrUid === 'number') {
        // Numeric primary key (the value returned by getAuthenticatedUserId).
        user = await User.findByPk(userIdOrUid, { attributes: ['id'] });
    } else {
        // String: try uid first (the historical contract), then fall back to a
        // numeric-id lookup for callers that pass a numeric id as a string.
        user = await User.findOne({
            where: { uid: userIdOrUid },
            attributes: ['id'],
        });
        if (!user && /^\d+$/.test(userIdOrUid)) {
            user = await User.findByPk(Number(userIdOrUid), {
                attributes: ['id'],
            });
        }
    }

    if (!user) return false;

    const role = await Role.findOne({ where: { user_id: user.id } });
    return !!(role && role.is_admin);
}

module.exports = { isAdmin };
