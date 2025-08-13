const { Role } = require('../models');

async function isAdmin(userId) {
    if (!userId) return false;
    const role = await Role.findOne({ where: { user_id: userId } });
    return !!(role && role.is_admin);
}

module.exports = { isAdmin };
