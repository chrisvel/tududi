'use strict';
const router = require('express').Router();
const service = require('./service');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');

const handle =
    (fn, status = 200, write = false) =>
    async (req, res, next) => {
        try {
            if (!req.currentUser)
                throw new UnauthorizedError('Authentication required');
            if (write && (!req.session?.userId || req.headers.authorization))
                throw new ForbiddenError(
                    'Only the signed-in human can write Focus sessions'
                );
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
        201,
        true
    )
);
router.post(
    '/focus-sessions/:uid/end',
    handle(
        async (req, userId) => ({
            session: await service.end(userId, req.params.uid, req.body),
        }),
        200,
        true
    )
);
router.post(
    '/focus-sessions/:uid/resume',
    handle(
        async (req, userId) => ({
            session: await service.resume(userId, req.params.uid),
        }),
        201,
        true
    )
);

router.get(
    '/focus-sessions/summary',
    handle((req, id) => service.summary(id, req.query.task_uids))
);
router.get(
    '/focus-sessions/today',
    handle((_req, id) => service.today(id))
);
router.get(
    '/focus-sessions/settings',
    handle((_req, id) => service.getSettings(id))
);
router.put(
    '/focus-sessions/settings',
    handle((req, id) => service.saveSettings(id, req.body), 200, true)
);
router.post(
    '/focus-sessions/manual',
    handle(
        async (req, id) => ({ session: await service.manual(id, req.body) }),
        201,
        true
    )
);
module.exports = router;
