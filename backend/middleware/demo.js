'use strict';

const demoService = require('../modules/demo/service');
const { ForbiddenError } = require('../shared/errors');

// The demo account is shared and public, so it must not be able to lock the
// next visitor out or delete itself: no password change, no email change,
// no account deletion, no API tokens. Everything else in the app it may do
// freely, because the reset clears up after it.
const blockDemoUser = async (req, res, next) => {
    try {
        const userId = req.currentUser?.id || req.session?.userId;
        if (await demoService.isDemoUser(userId)) {
            throw new ForbiddenError(
                'The demo account cannot change this. Create your own account to try it.'
            );
        }
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { blockDemoUser };
