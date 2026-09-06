'use strict';

const crypto = require('crypto');
const { getConfig } = require('../../../config/config');
const { logError } = require('../../../services/logService');
const { NotFoundError } = require('../../../shared/errors');

// Lemon Squeezy: a merchant of record, so it collects VAT and issues the
// invoices. Subscriptions are created through a hosted checkout (one
// variant per billing interval), managed through the customer portal URL
// the API returns, and reported back through signed webhooks.
//
// Reference: https://docs.lemonsqueezy.com/api

const API_BASE = 'https://api.lemonsqueezy.com/v1';

// Lemon Squeezy subscription statuses mapped onto billing_accounts.status.
// "cancelled" keeps access until ends_at, so it is active with
// cancel_at_period_end set; "expired" is the terminal state.
const STATUS_MAP = {
    on_trial: 'trialing',
    active: 'active',
    paused: 'paused',
    past_due: 'past_due',
    unpaid: 'unpaid',
    cancelled: 'active',
    expired: 'canceled',
};

function settings() {
    return getConfig().hosted?.lemonsqueezy || {};
}

function isConfigured() {
    const s = settings();
    return !!(s.apiKey && s.storeId);
}

function configuredPrices() {
    const variants = settings().variants || {};
    return {
        month: variants.proMonthly || null,
        year: variants.proAnnual || null,
    };
}

function planForPrice(variantId) {
    const prices = configuredPrices();
    const id = variantId == null ? null : String(variantId);
    if (id && (id === prices.month || id === prices.year)) return 'pro';
    return null;
}

function intervalForVariant(variantId) {
    const prices = configuredPrices();
    const id = variantId == null ? null : String(variantId);
    if (id && id === prices.month) return 'month';
    if (id && id === prices.year) return 'year';
    return null;
}

async function api(method, path, body) {
    const { apiKey, apiBase } = settings();
    const response = await fetch(`${apiBase || API_BASE}${path}`, {
        method,
        headers: {
            Accept: 'application/vnd.api+json',
            'Content-Type': 'application/vnd.api+json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404) {
        throw new NotFoundError(`Lemon Squeezy: ${path} not found`);
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
            `Lemon Squeezy ${method} ${path} failed: ${response.status} ${text.slice(0, 300)}`
        );
    }
    if (response.status === 204) return null;
    return response.json();
}

const toDate = (iso) => (iso ? new Date(iso) : null);

// billing_accounts columns for a Lemon Squeezy subscription resource.
function subscriptionToAccountFields(resource) {
    const a = resource.attributes || {};
    const status = STATUS_MAP[a.status] || a.status || 'none';
    const terminal = a.status === 'expired';
    const ending = a.cancelled || terminal;
    return {
        provider: 'lemonsqueezy',
        provider_subscription_id: String(resource.id),
        provider_customer_id:
            a.customer_id != null ? String(a.customer_id) : null,
        status,
        plan: terminal ? 'free' : planForPrice(a.variant_id) || 'pro',
        price_id: a.variant_id != null ? String(a.variant_id) : null,
        billing_interval: intervalForVariant(a.variant_id),
        current_period_start: null,
        current_period_end: toDate(
            ending ? a.ends_at || a.renews_at : a.renews_at
        ),
        trial_ends_at: toDate(a.trial_ends_at),
        cancel_at_period_end: !!a.cancelled && !terminal,
        canceled_at: ending ? toDate(a.updated_at) || new Date() : null,
    };
}

async function createCheckout({ user, account, interval, successUrl }) {
    const s = settings();
    const variantId = configuredPrices()[interval];
    const result = await api('POST', '/checkouts', {
        data: {
            type: 'checkouts',
            attributes: {
                checkout_data: {
                    email: user.email,
                    name: user.name || undefined,
                    custom: { user_uid: user.uid, user_id: String(user.id) },
                },
                product_options: { redirect_url: successUrl },
                checkout_options: { embed: false },
            },
            relationships: {
                store: { data: { type: 'stores', id: String(s.storeId) } },
                variant: { data: { type: 'variants', id: String(variantId) } },
            },
        },
    });
    return {
        url: result.data.attributes.url,
        id: result.data.id,
        customerId: account.provider_customer_id || null,
    };
}

async function createPortal({ account }) {
    if (account.provider_subscription_id) {
        const result = await api(
            'GET',
            `/subscriptions/${account.provider_subscription_id}`
        );
        const url = result.data.attributes.urls?.customer_portal;
        if (url) return { url };
    }
    if (account.provider_customer_id) {
        const result = await api(
            'GET',
            `/customers/${account.provider_customer_id}`
        );
        const url = result.data.attributes.urls?.customer_portal;
        if (url) return { url };
    }
    throw new NotFoundError('No customer portal available for this account');
}

// The success redirect carries no reference, so a sync without a known
// subscription id looks the customer up by email in the store.
async function sync({ user, account }) {
    if (account.provider_subscription_id) {
        const result = await api(
            'GET',
            `/subscriptions/${account.provider_subscription_id}`
        );
        return subscriptionToAccountFields(result.data);
    }
    const params = new URLSearchParams({
        'filter[store_id]': String(settings().storeId),
        'filter[user_email]': user.email,
    });
    const result = await api('GET', `/subscriptions?${params}`);
    const subs = (result.data || [])
        .slice()
        .sort((x, y) =>
            String(y.attributes?.created_at || '').localeCompare(
                String(x.attributes?.created_at || '')
            )
        );
    if (!subs.length) return null;
    return subscriptionToAccountFields(subs[0]);
}

function verifySignature(rawBody, header) {
    const secret = settings().webhookSecret;
    if (!secret || !header) return false;
    const digest = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
    const given = Buffer.from(String(header), 'utf8');
    const expected = Buffer.from(digest, 'utf8');
    return (
        given.length === expected.length &&
        crypto.timingSafeEqual(given, expected)
    );
}

async function parseWebhook(rawBody, headers) {
    if (!verifySignature(rawBody, headers['x-signature'])) {
        const { WebhookSignatureError } = require('./index');
        throw new WebhookSignatureError();
    }
    const payload = JSON.parse(rawBody.toString());
    const eventName = payload.meta?.event_name || 'unknown';
    const custom = payload.meta?.custom_data || {};
    const data = payload.data || {};
    const a = data.attributes || {};
    const isSubscription = data.type === 'subscriptions';

    // Lemon Squeezy sends no event id; the resource id plus its updated_at
    // is unique per change, and a redelivery of the same change repeats it.
    const id = `ls:${eventName}:${data.id}:${a.updated_at || ''}`.slice(0, 64);
    const createdAt = a.updated_at
        ? Math.floor(Date.parse(a.updated_at) / 1000)
        : Math.floor(Date.now() / 1000);
    const base = {
        id,
        rawType: eventName,
        createdAt,
        ref: {
            userUid: custom.user_uid || null,
            userId: custom.user_id || null,
            customerId: a.customer_id != null ? String(a.customer_id) : null,
            subscriptionId: isSubscription
                ? String(data.id)
                : a.subscription_id != null
                  ? String(a.subscription_id)
                  : null,
        },
        fields: {},
    };

    switch (eventName) {
        case 'subscription_created':
            return {
                ...base,
                type: 'checkout.completed',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription_updated':
        case 'subscription_resumed':
        case 'subscription_paused':
        case 'subscription_unpaused':
        case 'subscription_cancelled':
        case 'subscription_plan_changed':
            return {
                ...base,
                type: 'subscription.updated',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription_expired':
            return {
                ...base,
                type: 'subscription.deleted',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription_payment_failed':
            return { ...base, type: 'payment.failed' };
        case 'subscription_payment_success':
        case 'subscription_payment_recovered': {
            const fields = {};
            if (base.ref.subscriptionId) {
                try {
                    const result = await api(
                        'GET',
                        `/subscriptions/${base.ref.subscriptionId}`
                    );
                    Object.assign(
                        fields,
                        subscriptionToAccountFields(result.data)
                    );
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
    if (account.provider_subscription_id) {
        await api(
            'DELETE',
            `/subscriptions/${account.provider_subscription_id}`
        );
    }
}

function validateConfig() {
    const problems = [];
    const s = settings();
    const prices = configuredPrices();
    if (!s.apiKey)
        problems.push(
            'LEMONSQUEEZY_API_KEY is not set: checkout is unavailable'
        );
    if (s.apiKey && !s.storeId)
        problems.push(
            'LEMONSQUEEZY_STORE_ID is not set: checkouts cannot be created'
        );
    if (s.apiKey && !s.webhookSecret)
        problems.push(
            'LEMONSQUEEZY_WEBHOOK_SECRET is not set: subscription changes will not be applied'
        );
    if (s.apiKey && !prices.month && !prices.year)
        problems.push(
            'No LEMONSQUEEZY_VARIANT_PRO_MONTHLY or LEMONSQUEEZY_VARIANT_PRO_ANNUAL configured: nothing to sell'
        );
    return problems;
}

module.exports = {
    name: 'lemonsqueezy',
    displayName: 'Lemon Squeezy',
    signatureHeader: 'x-signature',
    isConfigured,
    configuredPrices,
    planForPrice,
    canOpenPortal: (account) =>
        !!(account?.provider_subscription_id || account?.provider_customer_id),
    createCheckout,
    createPortal,
    sync,
    parseWebhook,
    cancelForDeletedUser,
    validateConfig,
    subscriptionToAccountFields,
    verifySignature,
};
