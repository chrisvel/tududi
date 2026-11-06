'use strict';

const roadmapService = require('./service');
const { UnauthorizedError } = require('../../shared/errors');
const { getAuthenticatedUserId } = require('../../utils/request-utils');

const roadmapController = {
    async get(req, res, next) {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) throw new UnauthorizedError('Authentication required');
            const data = await roadmapService.getRoadmap(
                req.currentUser,
                req.currentUser?.timezone,
                {
                    from: req.query.from,
                    days: req.query.days,
                    areaUid: req.query.area_uid,
                }
            );
            res.json(data);
        } catch (err) {
            next(err);
        }
    },
};

module.exports = roadmapController;
