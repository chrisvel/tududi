const { Role, User } = require('../models');

// Accepts either a user's uid (string) or numeric id. Callers pass both, and
// comparing an integer against the varchar uid column is an error on
// PostgreSQL (SQLite silently evaluated it to "no match").
async function isAdmin(userUidOrId) {
    if (!userUidOrId) return false;

    let userId = null;
    if (typeof userUidOrId === 'number') {
        userId = userUidOrId;
    } else if (/^\d+$/.test(String(userUidOrId))) {
        userId = parseInt(userUidOrId, 10);
    } else {
        // Find user by uid to get numeric id for role lookup
        const user = await User.findOne({
            where: { uid: userUidOrId },
            attributes: ['id'],
        });
        if (!user) return false;
        userId = user.id;
    }

    const role = await Role.findOne({ where: { user_id: userId } });
    return !!(role && role.is_admin);
}

module.exports = { isAdmin };
