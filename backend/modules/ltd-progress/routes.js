'use strict';
const router = require('express').Router();
const service = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');
const read = (fn) => async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) throw new UnauthorizedError();
        res.json(await fn(userId, req));
    } catch (error) {
        next(error);
    }
};
router.get(
    '/goals/tree',
    read(async (userId) => ({ goals: await service.tree(userId) }))
);
router.get(
    '/goals/:uid/progress',
    read((userId, req) => service.progress(userId, req.params.uid))
);
router.get(
    '/tasks/:uid/why-chain',
    read(async (userId, req) => ({
        whyChain: await service.whyChain(userId, req.params.uid),
    }))
);
module.exports = router;
