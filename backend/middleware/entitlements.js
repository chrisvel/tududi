const entitlements = require('../services/entitlementsService');
const { getAuthenticatedUserId } = require('../utils/request-utils');
const { SubscriptionRequiredError } = require('../shared/errors');

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

// What an account with no subscription may still reach. Everything else
// answers 402 SUBSCRIPTION_REQUIRED when TUDUDI_REQUIRE_SUBSCRIPTION is on.
//
// Buying access has to work, obviously; so does leaving. Reading the
// profile, exporting the data and deleting the account stay open, because
// locking someone out of their own export would make the data theirs in
// name only. Everything that creates or reads app content is closed.
const OPEN_WITHOUT_SUBSCRIPTION = [
    /^\/billing(\/|$)/,
    /^\/profile$/,
    /^\/profile\/change-password$/,
    /^\/backup\/export$/,
    /^\/backup\/list$/,
    /^\/backup\/[^/]+\/download$/,
];

const requireSubscription = async (req, res, next) => {
    try {
        if (!entitlements.isSubscriptionRequired()) return next();
        if (OPEN_WITHOUT_SUBSCRIPTION.some((rule) => rule.test(req.path))) {
            return next();
        }
        const userId = getAuthenticatedUserId(req);
        if (!userId) return next();
        if (await entitlements.hasActiveEntitlement(userId)) return next();
        throw new SubscriptionRequiredError();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    requireFeature,
    requireQuota,
    requireStorage,
    requireSubscription,
};
