'use strict';

const { getConfig } = require('../../../config/config');
const { logError } = require('../../../services/logService');
const { ForbiddenError } = require('../../../shared/errors');
const {
    getStripe,
    configuredPrices,
    planForPrice,
} = require('../stripeClient');
const {
    subscriptionToAccountFields,
    deletedSubscriptionFields,
} = require('../subscriptionMapper');

const idOf = (value) => (typeof value === 'string' ? value : value?.id) || null;

function isConfigured() {
    return !!getConfig().hosted?.stripe?.secretKey;
}

function refFromObject(object) {
    return {
        userUid:
            object.client_reference_id ||
            object.metadata?.user_uid ||
            object.subscription_details?.metadata?.user_uid ||
            null,
        userId:
            object.metadata?.user_id ||
            object.subscription_details?.metadata?.user_id ||
            null,
        customerId: idOf(object.customer),
        subscriptionId:
            object.object === 'subscription'
                ? object.id
                : idOf(object.subscription),
    };
}

async function createCheckout({
    user,
    account,
    interval,
    successUrl,
    cancelUrl,
}) {
    const stripe = getStripe();
    let customerId = account.provider_customer_id;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: user.email,
            name: user.name || undefined,
            metadata: { user_id: String(user.id), user_uid: user.uid },
        });
        customerId = customer.id;
    }
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        client_reference_id: user.uid,
        line_items: [{ price: configuredPrices()[interval], quantity: 1 }],
        allow_promotion_codes: true,
        subscription_data: {
            metadata: { user_id: String(user.id), user_uid: user.uid },
        },
        success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
    });
    return { url: session.url, id: session.id, customerId };
}

async function createPortal({ account, returnUrl }) {
    const session = await getStripe().billingPortal.sessions.create({
        customer: account.provider_customer_id,
        return_url: returnUrl,
    });
    return { url: session.url };
}

// Re-reads the subscription. checkoutRef is the Checkout session id from
// the success redirect, which can arrive before the webhook.
async function sync({ user, account, checkoutRef }) {
    const stripe = getStripe();
    const fields = {};
    let subscriptionId = account.provider_subscription_id;

    if (checkoutRef) {
        const session = await stripe.checkout.sessions.retrieve(checkoutRef);
        if (session.client_reference_id !== user.uid) {
            throw new ForbiddenError('That checkout belongs to someone else');
        }
        if (session.subscription) subscriptionId = idOf(session.subscription);
        if (session.customer && !account.provider_customer_id) {
            fields.provider_customer_id = idOf(session.customer);
        }
    }

    if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        Object.assign(fields, subscriptionToAccountFields(sub));
    }
    return Object.keys(fields).length ? fields : null;
}

async function parseWebhook(rawBody, headers) {
    const { webhookSecret } = getConfig().hosted.stripe;
    const stripe = getStripe();
    let event;
    try {
        event = stripe.webhooks.constructEvent(
            rawBody,
            headers['stripe-signature'],
            webhookSecret
        );
    } catch (error) {
        if (error.type === 'StripeSignatureVerificationError') {
            const { WebhookSignatureError } = require('./index');
            throw new WebhookSignatureError();
        }
        throw error;
    }

    const object = event.data.object;
    const base = {
        id: event.id,
        rawType: event.type,
        createdAt: event.created,
        ref: refFromObject(object),
        fields: {},
    };

    switch (event.type) {
        case 'checkout.session.completed': {
            const fields = {};
            if (object.customer)
                fields.provider_customer_id = idOf(object.customer);
            if (object.subscription) {
                const sub = await stripe.subscriptions.retrieve(
                    idOf(object.subscription)
                );
                Object.assign(fields, subscriptionToAccountFields(sub));
            }
            return { ...base, type: 'checkout.completed', fields };
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            return {
                ...base,
                type: 'subscription.updated',
                fields: subscriptionToAccountFields(object),
            };
        case 'customer.subscription.deleted':
            return {
                ...base,
                type: 'subscription.deleted',
                fields: deletedSubscriptionFields(object),
            };
        case 'invoice.payment_failed':
            return { ...base, type: 'payment.failed' };
        case 'invoice.paid':
        case 'invoice.payment_succeeded': {
            const fields = {};
            const subId = idOf(object.subscription);
            if (subId) {
                try {
                    const sub = await stripe.subscriptions.retrieve(subId);
                    Object.assign(fields, subscriptionToAccountFields(sub));
                } catch (error) {
                    logError(
                        'Could not refresh subscription after payment:',
                        error
                    );
                }
            }
            return { ...base, type: 'payment.succeeded', fields };
        }
        default:
            return { ...base, type: 'ignored' };
    }
}

async function cancelForDeletedUser(account) {
    const stripe = getStripe();
    if (account.provider_subscription_id) {
        await stripe.subscriptions.cancel(account.provider_subscription_id);
    }
    if (account.provider_customer_id) {
        await stripe.customers.del(account.provider_customer_id);
    }
}

function validateConfig() {
    const problems = [];
    const { secretKey, webhookSecret } = getConfig().hosted.stripe || {};
    const prices = configuredPrices();
    if (!secretKey)
        problems.push('STRIPE_SECRET_KEY is not set: checkout is unavailable');
    if (secretKey && !webhookSecret)
        problems.push(
            'STRIPE_WEBHOOK_SECRET is not set: subscription changes will not be applied'
        );
    if (secretKey && !prices.month && !prices.year)
        problems.push(
            'No STRIPE_PRICE_PRO_MONTHLY or STRIPE_PRICE_PRO_ANNUAL configured: nothing to sell'
        );
    return problems;
}

module.exports = {
    name: 'stripe',
    displayName: 'Stripe',
    signatureHeader: 'stripe-signature',
    isConfigured,
    configuredPrices,
    planForPrice,
    canOpenPortal: (account) => !!account?.provider_customer_id,
    createCheckout,
    createPortal,
    sync,
    parseWebhook,
    cancelForDeletedUser,
    validateConfig,
};
