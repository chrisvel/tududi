'use strict';
const router = require('express').Router();
const service = require('./service');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');

const RETURN_TO = '/profile?section=calendars';

// Only the signed-in human connects or disconnects Google; an API token
// cannot reach a calendar secret.
function assertHuman(req) {
    if (!req.currentUser)
        throw new UnauthorizedError('Authentication required');
    if (!req.session?.userId || req.headers.authorization) {
        throw new ForbiddenError(
            'Only the signed-in human can manage Google Calendar'
        );
    }
}

const human = (fn) => async (req, res, next) => {
    try {
        assertHuman(req);
        res.json(await fn(req, req.currentUser));
    } catch (err) {
        next(err);
    }
};

router.get(
    '/ltd/gcal',
    human((_req, user) => service.status(user.id))
);
router.post(
    '/ltd/gcal/connect',
    human((req, user) => service.startConnect(req.session, user.id))
);
router.post(
    '/ltd/gcal/export',
    human((req, user) => service.setExport(user, req.body?.on))
);
router.post(
    '/ltd/gcal/disconnect',
    human((_req, user) => service.disconnect(user.id))
);

// Google sends the browser back here; the result goes to a fixed page.
router.get('/ltd/gcal/callback', async (req, res) => {
    try {
        assertHuman(req);
        await service.finishConnect(req.session, req.currentUser.id, req.query);
        service.syncUser(req.currentUser.id).catch(() => {});
        res.redirect(`${RETURN_TO}&gcal=connected`);
    } catch {
        res.redirect(`${RETURN_TO}&gcal=error`);
    }
});

module.exports = router;
