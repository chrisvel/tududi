'use strict';
const router = require('express').Router();
const service = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');
const handle = (fn) => async (req, res, next) => {
    try {
        const userId = getAuthenticatedUserId(req);
        if (!userId) throw new UnauthorizedError('Authentication required');
        if (
            req.method === 'POST' &&
            (!req.session?.userId || req.headers.authorization)
        ) {
            throw new ForbiddenError(
                'Only the signed-in human can undo an operation'
            );
        }
        await fn(req, res, userId);
    } catch (err) {
        next(err);
    }
};
router.get(
    '/journal',
    handle(async (_req, res, userId) =>
        res.json({ entries: await service.list(userId) })
    )
);
router.post(
    '/journal/revert',
    handle(async (req, res, userId) =>
        res.json({ entries: await service.revert(userId, req.body?.uids) })
    )
);
router.post(
    '/journal/:uid/revert',
    handle(async (req, res, userId) =>
        res.json({ entries: await service.revert(userId, [req.params.uid]) })
    )
);
module.exports = router;
