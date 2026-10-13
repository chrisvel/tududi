'use strict';
const router = require('express').Router();
const service = require('./service');
const { actorFromRequest } = require('../ltd-journal/actor');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

// Life-to-Day (T-1102): /api/lessons. The effect of a task (T-1101) is read
// here too, because it carries the one lesson that belongs on the task.
const handle =
    (fn, status = 200) =>
    async (req, res, next) => {
        try {
            const userId = getAuthenticatedUserId(req);
            if (!userId) throw new UnauthorizedError('Authentication required');
            const result = await fn(req, userId, actorFromRequest(req, userId));
            // A replayed client uid returns the first lesson, not a new one.
            if (result?.existing) {
                delete result.existing;
                return res.status(200).json(result);
            }
            res.status(status).json(result);
        } catch (err) {
            next(err);
        }
    };

router.get(
    '/lessons/effect',
    handle((req, userId) => service.effect(userId, req.query.task_uid))
);
router.get(
    '/lessons/due',
    handle((req, userId) => service.due(userId, req.query.date))
);
router.get(
    '/lessons',
    handle(async (req, userId) => ({
        lessons: await service.list(userId, {
            status: req.query.status,
            goal_uid: req.query.goal_uid,
        }),
    }))
);
router.post(
    '/lessons',
    handle((req, userId, actor) => service.create(userId, req.body, actor), 201)
);
router.patch(
    '/lessons/:uid',
    handle((req, userId, actor) =>
        service.update(userId, req.params.uid, req.body, actor)
    )
);
router.delete(
    '/lessons/:uid',
    handle((req, userId, actor) =>
        service.remove(userId, req.params.uid, actor)
    )
);
router.post(
    '/lessons/:uid/checks',
    handle(
        (req, userId, actor) =>
            service.check(userId, req.params.uid, req.body, actor),
        201
    )
);

module.exports = router;
