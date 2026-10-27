'use strict';

const { getConfig } = require('../../../config/config');

// The payment providers behind hosted-mode billing: Stripe (Checkout +
// Customer Portal), and Lemon Squeezy and Polar (merchants of record that
// handle VAT and invoices). One of them sells new subscriptions; a
// subscription bought through another keeps being managed, synced and
// cancelled there, and its webhooks keep being applied. Each exposes the
// same surface to the billing service:
//
//   name, displayName, signatureHeader
//   isConfigured()                         keys and at least one price present
//   configuredPlans()                      { pro: { month, year }, team_5: … }
//   configuredPrices(plan = 'pro')         { month, year } price or variant ids
//   planForPrice(id)                       plan key for a price id, or null
//   canOpenPortal(account)                 whether "Manage subscription" works
//   createCheckout({ user, account, plan, interval, successUrl, cancelUrl })
//                                          -> { url, id, customerId? }
//   createPortal({ account, returnUrl })   -> { url }
//   sync({ user, account, checkoutRef })   -> account fields, or null
//   parseWebhook(rawBody, headers)         -> normalized event (below)
//   cancelForDeletedUser(account)
//   validateConfig()                       -> [problem strings]
//
// A normalized webhook event is
//   { id, type, rawType, createdAt, ref: { userUid, userId, customerId,
//     subscriptionId }, fields }
// where type is one of checkout.completed, subscription.updated,
// subscription.deleted, payment.failed, payment.succeeded or ignored,
// createdAt is epoch seconds used to drop out-of-order deliveries, ref is
// how the service finds the account, and fields are billing_accounts
// columns to write.

class WebhookSignatureError extends Error {
    constructor(message = 'Invalid webhook signature') {
        super(message);
        this.name = 'WebhookSignatureError';
        this.statusCode = 400;
    }
}

const PROVIDERS = {
    stripe: () => require('./stripe'),
    lemonsqueezy: () => require('./lemonsqueezy'),
    polar: () => require('./polar'),
};

// Statuses of a subscription that still lives at its provider.
const LIVE_STATUSES = new Set([
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'paused',
    'incomplete',
]);

function providerName() {
    return getConfig().hosted?.billing?.provider || 'stripe';
}

// The provider that sells new subscriptions, or a named one.
function getProvider(name = providerName()) {
    return (PROVIDERS[name] || PROVIDERS.stripe)();
}

// The provider that manages this account's subscription: the one it was
// bought through while it is still live there, else the selling provider.
function providerFor(account) {
    const name = account?.provider;
    if (
        name &&
        PROVIDERS[name] &&
        name !== providerName() &&
        LIVE_STATUSES.has(account.status)
    ) {
        const provider = PROVIDERS[name]();
        if (provider.isConfigured()) return provider;
    }
    return getProvider();
}

// The configured provider whose signature header a webhook carries.
function providerForWebhook(headers = {}) {
    const names = [
        providerName(),
        ...Object.keys(PROVIDERS).filter((n) => n !== providerName()),
    ];
    for (const name of names) {
        const provider = getProvider(name);
        if (headers[provider.signatureHeader] && provider.isConfigured()) {
            return provider;
        }
    }
    return null;
}

function isBillingConfigured() {
    const config = getConfig();
    return config.hosted?.enabled === true && getProvider().isConfigured();
}

module.exports = {
    WebhookSignatureError,
    providerName,
    getProvider,
    providerFor,
    providerForWebhook,
    isBillingConfigured,
    configuredPlans: () => getProvider().configuredPlans(),
    configuredPrices: (plan) => getProvider().configuredPrices(plan),
    planForPrice: (id) => getProvider().planForPrice(id),
};
