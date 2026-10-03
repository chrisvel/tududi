'use strict';

const entitlements = require('./entitlementsService');
const { isAdmin } = require('./rolesService');
const { logError } = require('./logService');
const {
    ForbiddenError,
    PlanLimitError,
    SubscriptionRequiredError,
} = require('../shared/errors');

// Seats on a hosted instance: an account owner pays for itself plus every
// member of its account (see accountsService), whichever admin added them, as
// the quantity of its subscription. Self-hosted instances never get
// here, since every function returns early when hosted mode is off.

// Reasons an owner's own plan lets it add members. A comp (override) adds
// members without touching billing; a subscription or its grace window adds
// a paid seat.
const ADD_REASONS = ['subscription', 'grace', 'override'];
const BILLED_STATUSES = new Set(['active', 'trialing', 'past_due']);

function models() {
    return require('../models');
}

function provider() {
    return require('../modules/billing/providers');
}

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

// Sets the subscription's quantity to the owner plus its members (plus
// `extra`, for a member about to be created). Returns the new quantity, or
// null when there is nothing to bill: hosted mode off, billing not set up,
// an admin, a comp, or no live subscription. Provider failures throw.
async function syncSeats(ownerId, { extra = 0 } = {}) {
    if (!entitlements.isHostedMode()) return null;
    if (!provider().isBillingConfigured()) return null;
    if (await isAdmin(ownerId)) return null;

    const account = await models().BillingAccount.findOne({
        where: { user_id: ownerId },
    });
    if (!account || !account.provider_subscription_id) return null;
    if (!BILLED_STATUSES.has(account.status)) return null;
    if (account.override_plan) return null;

    const quantity = 1 + (await countMembers(ownerId)) + extra;
    if (account.seat_quantity === quantity) return quantity;

    const fields = await provider()
        .getProvider()
        .updateSeats({ account, quantity });
    await account.update(fields);
    entitlements.invalidate(ownerId);
    return fields.seat_quantity;
}

// Adds the paid seat for a member that is about to be created. Called before
// the account exists, so a refused payment leaves nothing behind.
async function addSeat(ownerId) {
    await assertCanAddSeat(ownerId);
    return syncSeats(ownerId, { extra: 1 });
}

// Brings the quantity back in line after a member is created or removed.
// Never throws: the member change already happened, and the next sync
// corrects the quantity.
async function reconcile(ownerId) {
    try {
        return await syncSeats(ownerId);
    } catch (error) {
        logError(error, `Could not update seats for user ${ownerId}`);
        return null;
    }
}

// What the billing tab shows about seats.
async function describeSeats(ownerId) {
    if (!entitlements.isHostedMode()) return null;
    const members = await countMembers(ownerId);
    const account = await models().BillingAccount.findOne({
        where: { user_id: ownerId },
        attributes: ['seat_quantity'],
    });
    return {
        members,
        needed: 1 + members,
        billed: account?.seat_quantity ?? null,
    };
}

module.exports = {
    countMembers,
    assertCanAddSeat,
    syncSeats,
    addSeat,
    reconcile,
    describeSeats,
};
