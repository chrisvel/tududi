'use strict';
const router = require('express').Router();
const service = require('./service');
const { UnauthorizedError, ForbiddenError } = require('../../shared/errors');

// Only the signed-in human manages access; a token cannot widen or restore
// its own (or another client's) rights.
const human = (fn) => async (req, res, next) => {
    try {
        if (!req.currentUser)
            throw new UnauthorizedError('Authentication required');
        if (!req.session?.userId || req.headers.authorization)
            throw new ForbiddenError(
                'Only the signed-in human can manage MCP access'
            );
        res.json(await fn(req, req.currentUser.id));
    } catch (err) {
        next(err);
    }
};

router.get(
    '/mcp/clients',
    human((_req, userId) => service.listClients(userId))
);
router.post(
    '/mcp/clients/:key/revoke',
    human((req, userId) => service.revokeClient(userId, req.params.key))
);
router.post(
    '/mcp/clients/:key/enable-writes',
    human((req, userId) => service.enableWrites(userId, req.params.key))
);
router.post(
    '/mcp/kill-switch',
    human((_req, userId) => service.killSwitch(userId))
);
router.put(
    '/mcp/read-only',
    human((req, userId) => service.setReadOnly(userId, req.body?.on))
);

module.exports = router;
