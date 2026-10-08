const { User } = require('../../../models');

async function getUserTimezone(userId) {
    if (!userId) return 'UTC';
    const user = await User.findByPk(userId, { attributes: ['timezone'] });
    return user?.timezone || 'UTC';
}

module.exports = { getUserTimezone };
