const { Op } = require('sequelize');
const { sequelize } = require('../models');
const { logError } = require('./logService');

// connect-session-sequelize stores each session's JSON in a `data` column,
// so a user's sessions are the rows whose JSON carries their id. Used to
// sign a user out everywhere after a password reset or account deletion.
async function destroyUserSessions(userId, { exceptSid = null } = {}) {
    const Session = sequelize.models.Session;
    if (!Session) return 0;

    const where = {
        [Op.or]: [
            { data: { [Op.like]: `%"userId":${userId},%` } },
            { data: { [Op.like]: `%"userId":${userId}}%` } },
        ],
    };
    if (exceptSid) {
        where.sid = { [Op.ne]: exceptSid };
    }

    try {
        return await Session.destroy({ where });
    } catch (error) {
        logError('Failed to destroy user sessions:', error);
        return 0;
    }
}

module.exports = { destroyUserSessions };
