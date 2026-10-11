'use strict';
const router = require('express').Router();
const service = require('./service');
const { actorFromRequest } = require('../ltd-journal/actor');
const { UnauthorizedError } = require('../../shared/errors');

const handle = (fn) => async (req, res, next) => {
    try {
        if (!req.currentUser)
            throw new UnauthorizedError('Authentication required');
        res.json(await fn(req, req.currentUser));
    } catch (err) {
        next(err);
    }
};

router.get(
    '/planner/capacity',
    handle((req, user) => service.getCapacity(user, req.query.date))
);
router.get(
    '/planner/work-hours',
    handle((_req, user) => service.getWorkHours(user))
);
router.put(
    '/planner/work-hours',
    handle((req, user) => service.saveWorkHours(user, req.body))
);
router.post(
    '/planner/recovery',
    handle((req, user) =>
        service.recover(user, req.body?.date, actorFromRequest(req, user.id))
    )
);
router.get(
    '/planner/overwhelmed',
    handle((_req, user) => service.getOverwhelmed(user))
);
router.put(
    '/planner/overwhelmed',
    handle((req, user) => service.setOverwhelmed(user, req.body?.on))
);
router.get(
    '/planner/contribution',
    handle((req, user) => service.getContribution(user, req.query.date))
);

module.exports = router;
