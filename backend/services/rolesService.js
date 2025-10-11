const { Role, User } = require('../models');

async function isAdmin(userUid) {
    if (!userUid) return false;

    // Find user by uid to get numeric id for role lookup
    const user = await User.findOne({
        where: { uid: userUid },
        attributes: ['id'],
    });

    if (!user) return false;

    const role = await Role.findOne({ where: { user_id: user.id } });
    return !!(role && role.is_admin);
}

module.exports = { isAdmin };
