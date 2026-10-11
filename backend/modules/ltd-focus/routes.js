'use strict';
const router = require('express').Router();
const service = require('./service');
const { UnauthorizedError } = require('../../shared/errors');

const handle =
    (fn, status = 200) =>
    async (req, res, next) => {
        try {
            if (!req.currentUser)
                throw new UnauthorizedError('Authentication required');
            res.status(status).json(await fn(req, req.currentUser.id));
        } catch (err) {
            next(err);
        }
    };

router.get(
    '/focus-sessions/current',
    handle(async (_req, userId) => ({
        session: await service.current(userId),
    }))
);
router.post(
    '/focus-sessions',
    handle(
        async (req, userId) => ({
            session: await service.start(userId, req.body),
        }),
        201
    )
);
router.post(
    '/focus-sessions/:uid/end',
    handle(async (req, userId) => ({
        session: await service.end(userId, req.params.uid, req.body),
    }))
);
router.post(
    '/focus-sessions/:uid/resume',
    handle(
        async (req, userId) => ({
            session: await service.resume(userId, req.params.uid),
        }),
        201
    )
);

module.exports = router;
