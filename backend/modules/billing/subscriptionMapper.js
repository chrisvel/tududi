'use strict';

const { planForPrice } = require('./stripeClient');

const toDate = (epochSeconds) =>
    epochSeconds ? new Date(epochSeconds * 1000) : null;

// Older Stripe API versions put the period on the subscription; newer ones
// put it on each item. Read whichever is present.
function periodOf(sub) {
    const item = sub.items?.data?.[0];
    return {
        start: toDate(item?.current_period_start ?? sub.current_period_start),
        end: toDate(item?.current_period_end ?? sub.current_period_end),
    };
}

// Fields to write on billing_accounts for a Stripe subscription object.
function subscriptionToAccountFields(sub) {
    const item = sub.items?.data?.[0];
    const priceId = item?.price?.id || null;
    const interval = item?.price?.recurring?.interval || null;
    const period = periodOf(sub);
    const plan = planForPrice(priceId);

    return {
        provider: 'stripe',
        provider_subscription_id: sub.id,
        provider_customer_id:
            typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        status: sub.status,
        plan: plan || 'pro',
        price_id: priceId,
        billing_interval: interval,
        current_period_start: period.start,
        current_period_end: period.end,
        trial_ends_at: toDate(sub.trial_end),
        cancel_at_period_end: !!sub.cancel_at_period_end,
        canceled_at: toDate(sub.canceled_at),
    };
}

function deletedSubscriptionFields(sub) {
    return {
        status: 'canceled',
        plan: 'free',
        cancel_at_period_end: false,
        canceled_at: toDate(sub.canceled_at) || new Date(),
        current_period_end: periodOf(sub).end || undefined,
    };
}

module.exports = {
    subscriptionToAccountFields,
    deletedSubscriptionFields,
    periodOf,
};
