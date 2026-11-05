'use strict';

const service = require('./service');
const { getAuthenticatedUserId } = require('../../utils/request-utils');
const { UnauthorizedError } = require('../../shared/errors');

function requireUserId(req) {
    const userId = getAuthenticatedUserId(req);
    if (!userId) throw new UnauthorizedError('Authentication required');
    return userId;
}

const handle = (fn) => async (req, res, next) => {
    try {
        res.json(await fn(requireUserId(req), req));
    } catch (error) {
        next(error);
    }
};

const controller = {
    list: handle((userId) => service.list(userId)),
    create: handle((userId, req) => service.create(userId, req.body)),
    update: handle((userId, req) =>
        service.update(userId, req.params.uid, req.body)
    ),
    remove: handle((userId, req) => service.remove(userId, req.params.uid)),
    rotateSecret: handle((userId, req) =>
        service.rotateSecret(userId, req.params.uid)
    ),
    deliveries: handle((userId, req) =>
        service.deliveries(userId, req.params.uid)
    ),
    test: handle((userId, req) => service.sendTest(userId, req.params.uid)),
};

module.exports = controller;
