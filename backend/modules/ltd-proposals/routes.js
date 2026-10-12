'use strict';
const router = require('express').Router();
const service = require('./service');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');

const STATUSES = [
    'pending',
    'applied',
    'partially_applied',
    'rejected',
    'expired',
    'reverted',
];

// Reading is open to any credential of the owner; deciding is for the
// signed-in human only, never for a token (blueprint 16.3).
const handle =
    (fn, { human = false } = {}) =>
    async (req, res, next) => {
        try {
            if (!req.currentUser)
                throw new UnauthorizedError('Authentication required');
            if (human && (!req.session?.userId || req.headers.authorization))
                throw new ForbiddenError(
                    'Only the signed-in human can decide a proposal'
                );
            res.json(await fn(req, req.currentUser));
        } catch (err) {
            next(err);
        }
    };

router.get(
    '/proposals',
    handle(async (req, user) => ({
        proposals: await service.list(
            user.id,
            STATUSES.includes(req.query.status) ? req.query.status : undefined
        ),
    }))
);
router.get(
    '/proposals/:uid',
    handle((req, user) => service.get(user.id, req.params.uid))
);
router.post(
    '/proposals/:uid/apply',
    handle(
        (req, user) => service.apply(user, req.params.uid, req.body?.op_ids),
        {
            human: true,
        }
    )
);
router.post(
    '/proposals/:uid/reject',
    handle((req, user) => service.reject(user.id, req.params.uid), {
        human: true,
    })
);
router.post(
    '/proposals/:uid/undo',
    handle((req, user) => service.undo(user.id, req.params.uid), {
        human: true,
    })
);

module.exports = router;
