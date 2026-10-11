'use strict';
const router = require('express').Router();
const service = require('./service');
const { actorFromRequest } = require('../ltd-journal/actor');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');
const handle = (fn) => async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) throw new UnauthorizedError('Authentication required');
        await fn(req, res, userId);
    } catch (err) {
        next(err);
    }
};
router.get(
    '/goals/:uid/metrics',
    handle(async (req, res, userId) =>
        res.json({ metrics: await service.list(userId, req.params.uid) })
    )
);
router.post(
    '/goals/:uid/metrics',
    handle(async (req, res, userId) =>
        res.status(201).json({
            metric: await service.create(
                userId,
                req.params.uid,
                req.body,
                actorFromRequest(req, userId)
            ),
        })
    )
);
router.patch(
    '/metrics/:uid',
    handle(async (req, res, userId) =>
        res.json({
            metric: await service.update(
                userId,
                req.params.uid,
                req.body,
                actorFromRequest(req, userId)
            ),
        })
    )
);
router.delete(
    '/metrics/:uid',
    handle(async (req, res, userId) => {
        // Human-only: bearer integrations cannot reach a hard-delete path.
        if (!req.session?.userId || req.headers.authorization)
            throw new ForbiddenError(
                'Only the signed-in human can delete a metric'
            );
        await service.remove(
            userId,
            req.params.uid,
            actorFromRequest(req, userId)
        );
        res.status(204).send();
    })
);
router.post(
    '/metrics/:uid/checkins',
    handle(async (req, res, userId) =>
        res
            .status(201)
            .json(
                await service.checkin(
                    userId,
                    req.params.uid,
                    req.body,
                    actorFromRequest(req, userId)
                )
            )
    )
);
module.exports = router;
