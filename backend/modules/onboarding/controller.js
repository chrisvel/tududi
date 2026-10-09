'use strict';

const onboardingService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');

function requireUser(req) {
    if (!req.currentUser) {
        throw new UnauthorizedError('Authentication required');
    }
    return req.currentUser;
}

const onboardingController = {
    async complete(req, res, next) {
        try {
            res.json(await onboardingService.complete(requireUser(req)));
        } catch (err) {
            next(err);
        }
    },

    async applyStarter(req, res, next) {
        try {
            res.json(
                await onboardingService.applyStarter(requireUser(req), req.body)
            );
        } catch (err) {
            next(err);
        }
    },

    async countExamples(req, res, next) {
        try {
            res.json(await onboardingService.countExamples(requireUser(req)));
        } catch (err) {
            next(err);
        }
    },

    async removeExamples(req, res, next) {
        try {
            res.json(await onboardingService.removeExamples(requireUser(req)));
        } catch (err) {
            next(err);
        }
    },
};

module.exports = onboardingController;
