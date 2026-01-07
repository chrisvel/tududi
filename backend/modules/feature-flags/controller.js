'use strict';

const featureFlagsService = require('./service');

const featureFlagsController = {
    async getAll(req, res, next) {
        try {
            const featureFlags = featureFlagsService.getAll();
            res.json({ featureFlags });
        } catch (error) {
            next(error);
        }
    },
};

module.exports = featureFlagsController;
