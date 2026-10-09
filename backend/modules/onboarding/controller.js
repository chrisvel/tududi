'use strict';

const onboardingService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');

const onboardingController = {
    async complete(req, res, next) {
        try {
            if (!req.currentUser) {
                throw new UnauthorizedError('Authentication required');
            }
            res.json(await onboardingService.complete(req.currentUser));
        } catch (err) {
            next(err);
        }
    },
};

module.exports = onboardingController;
