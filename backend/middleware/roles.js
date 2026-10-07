const rolesService = require('../services/rolesService');
const { getAuthenticatedUserId } = require('../utils/request-utils');
const { UnauthorizedError } = require('../shared/errors');

// Route-level guard for what an account's role allows it to create. Reading
// what is shared with the account is never gated here.
const requireCapability = (capability) => async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) throw new UnauthorizedError('Authentication required');

        await rolesService.assertCan(userId, capability);
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { requireCapability };
