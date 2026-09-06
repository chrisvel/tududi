'use strict';

const { getConfig } = require('../../../config/config');

// The payment provider behind hosted-mode billing. Two exist: Stripe
// (Checkout + Customer Portal) and Lemon Squeezy (a merchant of record that
// handles VAT and invoices). Both expose the same surface to the billing
// service:
//
//   name, displayName, signatureHeader
//   isConfigured()                         keys and at least one price present
//   configuredPrices()                     { month, year } price or variant ids
//   planForPrice(id)                       plan key for a price id, or null
//   canOpenPortal(account)                 whether "Manage subscription" works
//   createCheckout({ user, account, interval, successUrl, cancelUrl })
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

function providerName() {
    return getConfig().hosted?.billing?.provider || 'stripe';
}

function getProvider() {
    if (providerName() === 'lemonsqueezy') return require('./lemonsqueezy');
    return require('./stripe');
}

function isBillingConfigured() {
    const config = getConfig();
    return config.hosted?.enabled === true && getProvider().isConfigured();
}

module.exports = {
    WebhookSignatureError,
    providerName,
    getProvider,
    isBillingConfigured,
    configuredPrices: () => getProvider().configuredPrices(),
    planForPrice: (id) => getProvider().planForPrice(id),
};
