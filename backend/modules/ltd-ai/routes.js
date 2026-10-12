'use strict';
const router = require('express').Router();
const service = require('./service');
const { AI_CAPABILITIES } = require('./capabilities');
const {
    UnauthorizedError,
    ForbiddenError,
    ValidationError,
} = require('../../shared/errors');
const handle = (fn) => async (req, res, next) => {
    try {
        if (!req.currentUser)
            throw new UnauthorizedError('Authentication required');
        if (!req.session?.userId || req.headers.authorization)
            throw new ForbiddenError('Use the signed-in app');
        res.json(await fn(req, req.currentUser));
    } catch (error) {
        next(
            error.name === 'ZodError'
                ? new ValidationError('Invalid AI request')
                : error
        );
    }
};
router.post(
    '/ltd-ai/manifest',
    handle((req, user) => service.preview(user, req.body))
);
router.post(
    '/ltd-ai/run',
    handle((req, user) => {
        const capability = AI_CAPABILITIES.find(
            (c) => c.name === `ai_${req.body?.request?.feature}`
        );
        if (!capability) throw new ValidationError('Unknown feature');
        return capability.handler(capability.input.parse(req.body), {
            user,
            userId: user.id,
            human: true,
        });
    })
);
router.get(
    '/ltd-ai/targets',
    handle((_req, user) => service.targets(user.id))
);
router.get(
    '/ltd-ai/runs',
    handle((_req, user) => service.list(user.id))
);
router.get(
    '/ltd-ai/runs/:id',
    handle((req, user) => service.get(user.id, req.params.id))
);
router.post(
    '/ltd-ai/review/save',
    handle((req, user) => service.saveReview(user, req.body))
);
module.exports = router;
