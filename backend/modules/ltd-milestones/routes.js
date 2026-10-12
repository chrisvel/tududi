'use strict';
const router = require('express').Router();
const service = require('./service');
const { actorFromRequest } = require('../ltd-journal/actor');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

const handle =
    (fn, status = 200) =>
    async (req, res, next) => {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) throw new UnauthorizedError('Authentication required');
            res.status(status).json(
                await fn(req, userId, actorFromRequest(req, userId))
            );
        } catch (err) {
            next(err);
        }
    };

router.get(
    '/milestones',
    handle(async (req, userId) => ({
        milestones: await service.list(userId, {
            from: req.query.from,
            to: req.query.to,
        }),
    }))
);
router.post(
    '/milestones',
    handle(
        async (req, userId, actor) => ({
            milestone: await service.create(userId, req.body, actor),
        }),
        201
    )
);
router.patch(
    '/milestones/:uid',
    handle(async (req, userId, actor) => ({
        milestone: await service.update(
            userId,
            req.params.uid,
            req.body,
            actor
        ),
    }))
);
router.delete(
    '/milestones/:uid',
    handle(async (req, userId, actor) =>
        service.remove(userId, req.params.uid, actor)
    )
);

module.exports = router;
