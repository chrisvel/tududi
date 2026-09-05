const entitlements = require('../services/entitlementsService');
const { getAuthenticatedUserId } = require('../utils/request-utils');

// Route-level guards for hosted mode. Each one is a no-op when hosted mode
// is off (the service returns before any query), so self-hosted installs
// carry no cost.

const requireFeature = (feature) => async (req, res, next) => {
    try {
        await entitlements.assertFeature(getAuthenticatedUserId(req), feature);
        next();
    } catch (error) {
        next(error);
    }
};

const requireQuota =
    (resource, countFromReq = () => 1) =>
    async (req, res, next) => {
        try {
            const n = Math.max(1, Number(countFromReq(req)) || 1);
            await entitlements.assertCanCreate(
                getAuthenticatedUserId(req),
                resource,
                n
            );
            next();
        } catch (error) {
            next(error);
        }
    };

const requireStorage = (bytesFromReq) => async (req, res, next) => {
    try {
        const bytes = Number(bytesFromReq(req)) || 0;
        await entitlements.assertStorage(getAuthenticatedUserId(req), bytes);
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = { requireFeature, requireQuota, requireStorage };
