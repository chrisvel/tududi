'use strict';

const entitlements = require('./entitlementsService');
const { isAdmin } = require('./rolesService');
const {
    ForbiddenError,
    FeatureNotInPlanError,
    PlanLimitError,
    SubscriptionRequiredError,
} = require('../shared/errors');

// Seats on a hosted instance: an account owner and every member of its
// account (see accountsService), whichever admin added them. Seats are sold
// in fixed buckets as Team plans (config/plans.js), so the plan's
// max_members is the limit and adding a member never changes the
// subscription. The owner moves to a bigger bucket through checkout or the
// provider's portal. Self-hosted instances never get here, since every
// function returns early when hosted mode is off.

// Reasons an owner's own plan lets it add members: a subscription, its grace
// window, a comp (override), or a trial with room for a member.
const ADD_REASONS = ['subscription', 'grace', 'override', 'trial'];

async function countMembers(ownerId) {
    return require('./accountsService').countMembers(ownerId);
}

// Throws unless `ownerId` may add one more member right now.
async function assertCanAddSeat(ownerId) {
    if (!entitlements.isHostedMode()) return;
    if (await isAdmin(ownerId)) return;

    const ent = await entitlements.getEntitlements(ownerId);
    if (ent.reason === 'seat') {
        throw new ForbiddenError(
            'Only the person who pays for this workspace can add members'
        );
    }
    // Said as a missing feature, so the app can offer the subscription page
    // rather than treating the trial as having no access at all.
    if (ent.reason === 'trial' && ent.limits.max_members === 0) {
        throw new FeatureNotInPlanError('members', ent.plan);
    }
    if (!ADD_REASONS.includes(ent.reason)) {
        throw new SubscriptionRequiredError(
            'Subscribe to tududi Cloud to add members'
        );
    }
    const limit = ent.limits.max_members;
    if (limit === null || limit === undefined) return;
    const current = await countMembers(ownerId);
    if (current + 1 > limit) {
        throw new PlanLimitError('member', limit, current, ent.plan);
    }
}

// What the billing tab shows about seats: how many the plan has and how many
// are taken, the owner included.
async function describeSeats(ownerId) {
    if (!entitlements.isHostedMode()) return null;
    const members = await countMembers(ownerId);
    const ent = await entitlements.getEntitlements(ownerId);
    return {
        members,
        used: 1 + members,
        seats: ent.seats ?? 1,
    };
}

module.exports = {
    countMembers,
    assertCanAddSeat,
    describeSeats,
};
