'use strict';

const crypto = require('crypto');
const { getConfig } = require('../../../config/config');
const { logError } = require('../../../services/logService');
const { NotFoundError } = require('../../../shared/errors');
const { buildCatalog, lookupPrice } = require('./priceCatalog');

// Polar: a merchant of record, so it collects VAT and issues the invoices.
// Each plan and interval is its own product. Subscriptions start in a
// hosted checkout, are managed (and switched between products) in the
// customer portal, and are reported back through Standard Webhooks.
//
// Reference: https://polar.sh/docs/api-reference

const API_BASES = {
    production: 'https://api.polar.sh',
    sandbox: 'https://sandbox-api.polar.sh',
};

// Polar subscription statuses mapped onto billing_accounts.status. A
// subscription canceled at period end stays "active" with
// cancel_at_period_end set until it is revoked, which makes it "canceled".
const STATUS_MAP = {
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    unpaid: 'unpaid',
    paused: 'paused',
    canceled: 'canceled',
};

// Webhook timestamps older or newer than this are refused (replay guard).
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function settings() {
    return getConfig().hosted?.polar || {};
}

function isConfigured() {
    return !!settings().accessToken;
}

// Product ids by plan: { pro: { month, year }, team_5: { month, year }, … }.
function configuredPlans() {
    const products = settings().products || {};
    return buildCatalog({
        proMonthly: products.pro?.month,
        proAnnual: products.pro?.year,
        team: products,
    });
}

function configuredPrices(plan = 'pro') {
    return configuredPlans()[plan] || { month: null, year: null };
}

function planForPrice(productId) {
    return lookupPrice(configuredPlans(), productId).plan;
}

function apiBase() {
    const s = settings();
    return s.apiBase || API_BASES[s.server] || API_BASES.production;
}

async function api(method, path, body) {
    const response = await fetch(`${apiBase()}${path}`, {
        method,
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${settings().accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 404) {
        throw new NotFoundError(`Polar: ${path} not found`);
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
            `Polar ${method} ${path} failed: ${response.status} ${text.slice(0, 300)}`
        );
    }
    if (response.status === 204) return null;
    return response.json();
}

const toDate = (iso) => (iso ? new Date(iso) : null);

// billing_accounts columns for a Polar subscription object.
function subscriptionToAccountFields(sub) {
    const status = STATUS_MAP[sub.status] || sub.status || 'none';
    const terminal = status === 'canceled';
    const lookup = lookupPrice(configuredPlans(), sub.product_id);
    return {
        provider: 'polar',
        provider_subscription_id: String(sub.id),
        provider_customer_id: sub.customer_id ? String(sub.customer_id) : null,
        status,
        plan: terminal ? 'free' : lookup.plan || 'pro',
        price_id: sub.product_id ? String(sub.product_id) : null,
        billing_interval:
            lookup.interval ||
            (['month', 'year'].includes(sub.recurring_interval)
                ? sub.recurring_interval
                : null),
        current_period_start: toDate(sub.current_period_start),
        current_period_end: toDate(
            terminal
                ? sub.ended_at || sub.ends_at || sub.current_period_end
                : sub.cancel_at_period_end
                  ? sub.ends_at || sub.current_period_end
                  : sub.current_period_end
        ),
        trial_ends_at: toDate(sub.trial_end),
        cancel_at_period_end: !!sub.cancel_at_period_end && !terminal,
        canceled_at: toDate(sub.canceled_at),
    };
}

// The account's user, as Polar knows it: the checkout sets the customer's
// external id to the user uid and copies it into the subscription metadata.
function refFor(sub) {
    return {
        userUid: sub.customer?.external_id || sub.metadata?.user_uid || null,
        userId:
            sub.metadata?.user_id != null ? String(sub.metadata.user_id) : null,
        customerId: sub.customer_id ? String(sub.customer_id) : null,
        subscriptionId: sub.id ? String(sub.id) : null,
    };
}

async function createCheckout({
    user,
    account,
    plan = 'pro',
    interval,
    successUrl,
}) {
    const productId = configuredPrices(plan)[interval];
    // An earlier Polar customer is reused; otherwise the user uid becomes
    // the new customer's external id, which is how webhooks find the user.
    const customer =
        account.provider === 'polar' && account.provider_customer_id
            ? { customer_id: account.provider_customer_id }
            : { external_customer_id: user.uid };
    const checkout = await api('POST', '/v1/checkouts/', {
        products: [productId],
        ...customer,
        customer_email: user.email || undefined,
        customer_name: user.name || undefined,
        metadata: { user_uid: user.uid, user_id: String(user.id) },
        success_url: `${successUrl}&session_id={CHECKOUT_ID}`,
    });
    return {
        url: checkout.url,
        id: checkout.id,
        customerId: checkout.customer_id || null,
    };
}

async function createPortal({ account, returnUrl }) {
    if (!account.provider_customer_id) {
        throw new NotFoundError(
            'No customer portal available for this account'
        );
    }
    const session = await api('POST', '/v1/customer-sessions/', {
        customer_id: account.provider_customer_id,
        return_url: returnUrl,
    });
    return { url: session.customer_portal_url };
}

// Reads the stored subscription, or after a checkout (whose id the
// redirect carries) the user's subscription from that checkout, falling
// back to their newest one.
async function sync({ user, account, checkoutRef }) {
    if (
        account.provider === 'polar' &&
        account.provider_subscription_id &&
        !checkoutRef
    ) {
        return subscriptionToAccountFields(
            await api(
                'GET',
                `/v1/subscriptions/${account.provider_subscription_id}`
            )
        );
    }
    const params = new URLSearchParams({
        external_customer_id: user.uid,
        sorting: '-started_at',
        limit: '10',
    });
    const result = await api('GET', `/v1/subscriptions/?${params}`);
    const subs = result.items || [];
    const sub =
        (checkoutRef && subs.find((s) => s.checkout_id === checkoutRef)) ||
        subs[0];
    return sub ? subscriptionToAccountFields(sub) : null;
}

// Standard Webhooks: base64 HMAC-SHA256 of "id.timestamp.body". Secrets
// made since September 2026 are "whsec_" plus the base64 key; older Polar
// secrets use the whole string as the key. Both are tried.
function signingKeys(secret) {
    const keys = [Buffer.from(secret, 'utf8')];
    if (secret.startsWith('whsec_')) {
        keys.unshift(Buffer.from(secret.slice('whsec_'.length), 'base64'));
    }
    return keys;
}

function verifySignature(rawBody, headers, now = Date.now()) {
    const secret = settings().webhookSecret;
    const id = headers['webhook-id'];
    const timestamp = headers['webhook-timestamp'];
    const header = headers['webhook-signature'];
    if (!secret || !id || !timestamp || !header) return false;
    const seconds = Number(timestamp);
    if (
        !Number.isFinite(seconds) ||
        Math.abs(now / 1000 - seconds) > WEBHOOK_TOLERANCE_SECONDS
    ) {
        return false;
    }
    const content = Buffer.concat([
        Buffer.from(`${id}.${timestamp}.`, 'utf8'),
        Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody)),
    ]);
    const given = String(header)
        .split(' ')
        .map((part) => part.split(','))
        .filter(([version, sig]) => version === 'v1' && sig)
        .map(([, sig]) => Buffer.from(sig, 'utf8'));
    return signingKeys(secret).some((key) => {
        const expected = Buffer.from(
            crypto.createHmac('sha256', key).update(content).digest('base64'),
            'utf8'
        );
        return given.some(
            (sig) =>
                sig.length === expected.length &&
                crypto.timingSafeEqual(sig, expected)
        );
    });
}

async function parseWebhook(rawBody, headers) {
    if (!verifySignature(rawBody, headers)) {
        const { WebhookSignatureError } = require('./index');
        throw new WebhookSignatureError();
    }
    const payload = JSON.parse(rawBody.toString());
    const type = payload.type || 'unknown';
    const data = payload.data || {};
    const isSubscription = type.startsWith('subscription.');
    const stampedAt = isSubscription
        ? data.modified_at || data.created_at
        : payload.timestamp;
    const base = {
        id: `polar:${headers['webhook-id']}`.slice(0, 64),
        rawType: type,
        createdAt: stampedAt
            ? Math.floor(Date.parse(stampedAt) / 1000)
            : Math.floor(Date.now() / 1000),
        ref: isSubscription
            ? refFor(data)
            : {
                  userUid: data.customer?.external_id || null,
                  userId: null,
                  customerId: data.customer_id
                      ? String(data.customer_id)
                      : null,
                  subscriptionId: data.subscription_id
                      ? String(data.subscription_id)
                      : null,
              },
        fields: {},
    };

    switch (type) {
        case 'subscription.created':
            return {
                ...base,
                type: 'checkout.completed',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription.updated':
        case 'subscription.active':
        case 'subscription.canceled':
        case 'subscription.uncanceled':
        case 'subscription.paused':
        case 'subscription.resumed':
            return {
                ...base,
                type: 'subscription.updated',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription.revoked':
            return {
                ...base,
                type: 'subscription.deleted',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription.past_due':
            return {
                ...base,
                type: 'payment.failed',
                fields: subscriptionToAccountFields(data),
            };
        case 'order.paid': {
            if (!base.ref.subscriptionId) return { ...base, type: 'ignored' };
            const fields = {};
            try {
                Object.assign(
                    fields,
                    subscriptionToAccountFields(
                        await api(
                            'GET',
                            `/v1/subscriptions/${base.ref.subscriptionId}`
                        )
                    )
                );
            } catch (error) {
                logError(
                    'Could not refresh subscription after payment:',
                    error
                );
            }
            return { ...base, type: 'payment.succeeded', fields };
        }
        default:
            return { ...base, type: 'ignored' };
    }
}

// Revokes at once: a deleted account must not be charged again.
async function cancelForDeletedUser(account) {
    if (account.provider_subscription_id) {
        await api(
            'DELETE',
            `/v1/subscriptions/${account.provider_subscription_id}`
        );
    }
}

function validateConfig() {
    const problems = [];
    const s = settings();
    const prices = configuredPrices();
    const team = Object.keys(s.products || {}).filter((k) => k !== 'pro');
    if (!s.accessToken)
        problems.push('POLAR_ACCESS_TOKEN is not set: checkout is unavailable');
    if (s.accessToken && !s.webhookSecret)
        problems.push(
            'POLAR_WEBHOOK_SECRET is not set: subscription changes will not be applied'
        );
    if (s.accessToken && !prices.month && !prices.year)
        problems.push(
            'POLAR_PRODUCTS_JSON has no "pro" product ids: nothing to sell'
        );
    const unknown = team.filter((key) => !configuredPlans()[key]);
    if (unknown.length > 0)
        problems.push(
            `POLAR_PRODUCTS_JSON has entries that are not plans or have no product ids: ${unknown.join(', ')}`
        );
    return problems;
}

module.exports = {
    name: 'polar',
    displayName: 'Polar',
    signatureHeader: 'webhook-signature',
    isConfigured,
    configuredPlans,
    configuredPrices,
    planForPrice,
    canOpenPortal: (account) =>
        account?.provider === 'polar' && !!account?.provider_customer_id,
    createCheckout,
    createPortal,
    sync,
    parseWebhook,
    cancelForDeletedUser,
    validateConfig,
    subscriptionToAccountFields,
    verifySignature,
};
