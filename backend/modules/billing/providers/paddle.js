'use strict';

const crypto = require('crypto');
const { getConfig } = require('../../../config/config');
const { logError } = require('../../../services/logService');
const { NotFoundError } = require('../../../shared/errors');
const { buildCatalog, lookupPrice } = require('./priceCatalog');

// Paddle Billing: a merchant of record, so it collects VAT and issues the
// invoices. Each plan is a product with a monthly and a yearly price. The
// server opens a transaction for the chosen price and the browser pays it
// in Paddle's overlay checkout (Paddle.js). The customer portal handles
// payment methods, invoices and cancelling; moving between plans goes
// through changePlan, since the portal does not offer it.
//
// Reference: https://developer.paddle.com/api-reference/overview

const API_BASES = {
    production: 'https://api.paddle.com',
    sandbox: 'https://sandbox-api.paddle.com',
};

// Paddle subscription statuses mapped onto billing_accounts.status. A
// cancellation scheduled for the period end keeps "active" with
// cancel_at_period_end set; "canceled" is the terminal state.
const STATUS_MAP = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    paused: 'paused',
    canceled: 'canceled',
};

// Webhook timestamps further than this from now are refused (replay guard).
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function settings() {
    return getConfig().hosted?.paddle || {};
}

function isConfigured() {
    const s = settings();
    return !!(s.apiKey && s.clientToken);
}

function environment() {
    return settings().environment === 'sandbox' ? 'sandbox' : 'production';
}

// Price ids by plan: { pro: { month, year }, team_5: { month, year }, … }.
function configuredPlans() {
    const prices = settings().prices || {};
    return buildCatalog({
        proMonthly: prices.pro?.month,
        proAnnual: prices.pro?.year,
        team: prices,
    });
}

function configuredPrices(plan = 'pro') {
    return configuredPlans()[plan] || { month: null, year: null };
}

function planForPrice(priceId) {
    return lookupPrice(configuredPlans(), priceId).plan;
}

async function api(method, path, body) {
    const s = settings();
    const response = await fetch(
        `${s.apiBase || API_BASES[environment()]}${path}`,
        {
            method,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Paddle-Version': '1',
                Authorization: `Bearer ${s.apiKey}`,
            },
            body: body ? JSON.stringify(body) : undefined,
        }
    );
    if (response.status === 404) {
        throw new NotFoundError(`Paddle: ${path} not found`);
    }
    if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
            `Paddle ${method} ${path} failed: ${response.status} ${text.slice(0, 300)}`
        );
    }
    if (response.status === 204) return null;
    return (await response.json()).data;
}

const toDate = (iso) => (iso ? new Date(iso) : null);

const subscriptionPrice = (sub) => sub.items?.[0]?.price?.id || null;

// billing_accounts columns for a Paddle subscription entity.
function subscriptionToAccountFields(sub) {
    const status = STATUS_MAP[sub.status] || sub.status || 'none';
    const terminal = status === 'canceled';
    const priceId = subscriptionPrice(sub);
    const lookup = lookupPrice(configuredPlans(), priceId);
    const cancelling = sub.scheduled_change?.action === 'cancel';
    const interval = sub.billing_cycle?.interval;
    return {
        provider: 'paddle',
        provider_subscription_id: String(sub.id),
        provider_customer_id: sub.customer_id ? String(sub.customer_id) : null,
        status,
        plan: terminal ? 'free' : lookup.plan || 'pro',
        price_id: priceId,
        billing_interval:
            lookup.interval ||
            (['month', 'year'].includes(interval) ? interval : null),
        current_period_start: toDate(sub.current_billing_period?.starts_at),
        current_period_end: toDate(
            terminal
                ? sub.canceled_at
                : cancelling
                  ? sub.scheduled_change.effective_at
                  : sub.current_billing_period?.ends_at || sub.next_billed_at
        ),
        trial_ends_at:
            status === 'trialing'
                ? toDate(sub.current_billing_period?.ends_at)
                : null,
        cancel_at_period_end: cancelling && !terminal,
        canceled_at: toDate(sub.canceled_at),
    };
}

// The user a subscription or transaction belongs to: the checkout puts the
// user's uid and id in custom_data, which Paddle copies to the
// subscription.
function refFor(entity, subscriptionId) {
    const custom = entity.custom_data || {};
    return {
        userUid: custom.user_uid || null,
        userId: custom.user_id != null ? String(custom.user_id) : null,
        customerId: entity.customer_id ? String(entity.customer_id) : null,
        subscriptionId: subscriptionId ? String(subscriptionId) : null,
    };
}

// The Paddle customer for this user: the one already on the account, the
// one with the user's email, or a new one.
async function customerFor(user, account) {
    if (account.provider === 'paddle' && account.provider_customer_id) {
        return account.provider_customer_id;
    }
    if (user.email) {
        const params = new URLSearchParams({ email: user.email });
        const existing = await api('GET', `/customers?${params}`);
        if (existing?.length) return existing[0].id;
    }
    const created = await api('POST', '/customers', {
        email: user.email,
        name: user.name || undefined,
        custom_data: { user_uid: user.uid },
    });
    return created.id;
}

// The browser opens Paddle's overlay on this transaction; there is no
// hosted page to redirect to.
async function createCheckout({
    user,
    account,
    plan = 'pro',
    interval,
    successUrl,
}) {
    const customerId = await customerFor(user, account);
    const transaction = await api('POST', '/transactions', {
        items: [{ price_id: configuredPrices(plan)[interval], quantity: 1 }],
        customer_id: customerId,
        collection_mode: 'automatic',
        custom_data: { user_uid: user.uid, user_id: String(user.id) },
    });
    return {
        url: null,
        id: transaction.id,
        customerId,
        paddle: {
            transaction_id: transaction.id,
            client_token: settings().clientToken,
            environment: environment(),
            success_url: `${successUrl}&session_id=${transaction.id}`,
        },
    };
}

async function createPortal({ account }) {
    if (!account.provider_customer_id) {
        throw new NotFoundError(
            'No customer portal available for this account'
        );
    }
    const session = await api(
        'POST',
        `/customers/${account.provider_customer_id}/portal-sessions`,
        account.provider_subscription_id
            ? { subscription_ids: [account.provider_subscription_id] }
            : {}
    );
    return { url: session.urls.general.overview };
}

// After checkout the redirect carries the transaction id, whose
// subscription is read; otherwise the stored subscription, or the newest
// one of the customer.
async function sync({ account, checkoutRef }) {
    if (checkoutRef) {
        const transaction = await api(
            'GET',
            `/transactions/${encodeURIComponent(checkoutRef)}`
        );
        if (transaction.subscription_id) {
            return subscriptionToAccountFields(
                await api(
                    'GET',
                    `/subscriptions/${transaction.subscription_id}`
                )
            );
        }
        return null;
    }
    if (account.provider !== 'paddle') return null;
    if (account.provider_subscription_id) {
        return subscriptionToAccountFields(
            await api(
                'GET',
                `/subscriptions/${account.provider_subscription_id}`
            )
        );
    }
    if (!account.provider_customer_id) return null;
    const params = new URLSearchParams({
        customer_id: account.provider_customer_id,
        order_by: 'id[DESC]',
    });
    const subs = await api('GET', `/subscriptions?${params}`);
    return subs?.length ? subscriptionToAccountFields(subs[0]) : null;
}

// Moves a live subscription to another plan's price at the same interval,
// charging or crediting the difference now.
async function changePlan({ account, priceId }) {
    const sub = await api(
        'PATCH',
        `/subscriptions/${account.provider_subscription_id}`,
        {
            items: [{ price_id: priceId, quantity: 1 }],
            proration_billing_mode: 'prorated_immediately',
        }
    );
    return subscriptionToAccountFields(sub);
}

// Paddle-Signature: "ts=<seconds>;h1=<hex HMAC-SHA256 of "ts:body">".
function verifySignature(rawBody, header, now = Date.now()) {
    const secret = settings().webhookSecret;
    if (!secret || !header) return false;
    const parts = Object.fromEntries(
        String(header)
            .split(';')
            .map((part) => part.split('='))
            .filter((kv) => kv.length === 2)
    );
    const ts = Number(parts.ts);
    if (
        !parts.h1 ||
        !Number.isFinite(ts) ||
        Math.abs(now / 1000 - ts) > WEBHOOK_TOLERANCE_SECONDS
    ) {
        return false;
    }
    const digest = crypto
        .createHmac('sha256', secret)
        .update(`${parts.ts}:`)
        .update(rawBody)
        .digest('hex');
    const given = Buffer.from(parts.h1, 'utf8');
    const expected = Buffer.from(digest, 'utf8');
    return (
        given.length === expected.length &&
        crypto.timingSafeEqual(given, expected)
    );
}

async function parseWebhook(rawBody, headers) {
    if (!verifySignature(rawBody, headers['paddle-signature'])) {
        const { WebhookSignatureError } = require('./index');
        throw new WebhookSignatureError();
    }
    const payload = JSON.parse(rawBody.toString());
    const type = payload.event_type || 'unknown';
    const data = payload.data || {};
    const isSubscription = type.startsWith('subscription.');
    const stampedAt = isSubscription
        ? data.updated_at || payload.occurred_at
        : payload.occurred_at;
    const base = {
        id: `paddle:${payload.event_id || payload.notification_id}`.slice(
            0,
            64
        ),
        rawType: type,
        createdAt: stampedAt
            ? Math.floor(Date.parse(stampedAt) / 1000)
            : Math.floor(Date.now() / 1000),
        ref: refFor(data, isSubscription ? data.id : data.subscription_id),
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
        case 'subscription.activated':
        case 'subscription.trialing':
        case 'subscription.paused':
        case 'subscription.resumed':
            return {
                ...base,
                type: 'subscription.updated',
                fields: subscriptionToAccountFields(data),
            };
        case 'subscription.canceled':
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
        case 'transaction.completed': {
            if (!base.ref.subscriptionId) return { ...base, type: 'ignored' };
            const fields = {};
            try {
                Object.assign(
                    fields,
                    subscriptionToAccountFields(
                        await api(
                            'GET',
                            `/subscriptions/${base.ref.subscriptionId}`
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

// Cancels at once: a deleted account must not be charged again.
async function cancelForDeletedUser(account) {
    if (account.provider_subscription_id) {
        await api(
            'POST',
            `/subscriptions/${account.provider_subscription_id}/cancel`,
            { effective_from: 'immediately' }
        );
    }
}

function validateConfig() {
    const problems = [];
    const s = settings();
    const prices = configuredPrices();
    const extra = Object.keys(s.prices || {}).filter((k) => k !== 'pro');
    if (!s.apiKey)
        problems.push('PADDLE_API_KEY is not set: checkout is unavailable');
    if (s.apiKey && !s.clientToken)
        problems.push(
            'PADDLE_CLIENT_TOKEN is not set: the checkout cannot open'
        );
    if (s.apiKey && !s.webhookSecret)
        problems.push(
            'PADDLE_WEBHOOK_SECRET is not set: subscription changes will not be applied'
        );
    if (s.apiKey && !prices.month && !prices.year)
        problems.push(
            'PADDLE_PRICES_JSON has no "pro" price ids: nothing to sell'
        );
    const unknown = extra.filter((key) => !configuredPlans()[key]);
    if (unknown.length > 0)
        problems.push(
            `PADDLE_PRICES_JSON has entries that are not plans or have no price ids: ${unknown.join(', ')}`
        );
    return problems;
}

module.exports = {
    name: 'paddle',
    displayName: 'Paddle',
    signatureHeader: 'paddle-signature',
    isConfigured,
    configuredPlans,
    configuredPrices,
    planForPrice,
    canOpenPortal: (account) =>
        account?.provider === 'paddle' && !!account?.provider_customer_id,
    canChangePlan: (account) =>
        account?.provider === 'paddle' &&
        !!account?.provider_subscription_id &&
        ['active', 'trialing'].includes(account?.status) &&
        !account?.cancel_at_period_end,
    createCheckout,
    createPortal,
    sync,
    changePlan,
    parseWebhook,
    cancelForDeletedUser,
    validateConfig,
    subscriptionToAccountFields,
    verifySignature,
};
