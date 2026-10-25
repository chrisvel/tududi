'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { Webhook, WebhookDelivery } = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const { safeRequest } = require('../caldav/services/safe-request');
const { hasFeature } = require('../../services/entitlementsService');
const { logError } = require('../../services/logService');
const { uid } = require('../../utils/uid');

const TIMEOUT_MS = 10000;
const MAX_ATTEMPTS = 5;
// Minutes to wait before attempts 2, 3, 4 and 5.
const RETRY_DELAYS_MIN = [1, 5, 30, 120];
// Deliveries that failed for good, in a row, before the webhook turns off.
const DISABLE_AFTER_FAILURES = 10;
const STUCK_SENDING_MS = 5 * 60 * 1000;
const KEEP_DELIVERIES_DAYS = 7;
const MAX_TEXT_LENGTH = 2000;
const CACHE_TTL_MS = 60 * 1000;

// In tests nothing is sent on its own: the tests call processDue() so they
// can look at the queue first.
const sendImmediately = process.env.NODE_ENV !== 'test';

// Most task writes belong to users without a webhook, so remember who has
// one and skip the query. Saving or deleting a webhook clears the entry; a
// second app process may see a change up to a minute late.
const subscriptions = new Map();

function invalidate(userId) {
    subscriptions.delete(userId);
}

function cachedHooks(userId) {
    const entry = subscriptions.get(userId);
    if (entry && Date.now() - entry.at < CACHE_TTL_MS) return entry.hooks;
    return null;
}

// True when the user is known to have no enabled webhook, without a query.
function knownToHaveNone(userId) {
    const hooks = cachedHooks(userId);
    return hooks !== null && hooks.length === 0;
}

async function enabledHooks(userId) {
    const cached = cachedHooks(userId);
    if (cached) return cached;
    const rows = await Webhook.findAll({
        where: { user_id: userId, enabled: true },
        attributes: ['id', 'events'],
    });
    const hooks = rows.map((row) => ({
        id: row.id,
        events: Array.isArray(row.events) ? row.events : [],
    }));
    subscriptions.set(userId, { at: Date.now(), hooks });
    return hooks;
}

const clip = (value, max) => {
    const text = String(value ?? '');
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
};

function buildPayload(id, event, { text, data }) {
    const message = clip(text, MAX_TEXT_LENGTH);
    return JSON.stringify({
        id,
        event,
        created_at: new Date().toISOString(),
        // Chat apps read one of these as the message, so a Slack or
        // Discord webhook address works without anything in between.
        text: message,
        content: message,
        data: data ?? null,
    });
}

// Queues `event` for every enabled webhook of the user that subscribed to
// it, and starts sending in the background. Never throws: a webhook must
// not break the action that produced the event.
// `webhookIds` limits it to some webhooks, `anyEvent` sends even to a
// webhook that did not pick this event (the test message), and
// `immediate: false` leaves the sending to the caller.
async function emit(
    userId,
    event,
    {
        text,
        data,
        webhookIds = null,
        anyEvent = false,
        immediate = sendImmediately,
    } = {}
) {
    try {
        if (!userId || knownToHaveNone(userId)) return [];
        let hooks = (await enabledHooks(userId)).filter(
            (hook) => anyEvent || hook.events.includes(event)
        );
        if (webhookIds) {
            hooks = hooks.filter((hook) => webhookIds.includes(hook.id));
        }
        if (hooks.length === 0) return [];
        if (!(await hasFeature(userId, 'webhooks'))) return [];

        const deliveries = [];
        for (const hook of hooks) {
            const id = uid();
            deliveries.push(
                await WebhookDelivery.create({
                    uid: id,
                    webhook_id: hook.id,
                    event,
                    payload: buildPayload(id, event, { text, data }),
                    status: 'pending',
                    next_attempt_at: new Date(),
                })
            );
        }

        if (immediate) {
            for (const delivery of deliveries) {
                setImmediate(() => {
                    deliver(delivery.id).catch(() => {});
                });
            }
        }
        return deliveries;
    } catch (error) {
        logError(`Failed to queue webhook event ${event}:`, error);
        return [];
    }
}

function sign(secret, timestamp, body) {
    return crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
}

// Throws on failure. Only the status code or error code is kept, never the
// error message of a request, since the address can carry a token.
async function post(webhook, { uid: deliveryUid, event, payload }) {
    const url = secretCipher.decrypt(webhook.url);
    const secret = secretCipher.decrypt(webhook.secret);
    const timestamp = Math.floor(Date.now() / 1000);

    return safeRequest({
        method: 'POST',
        url,
        data: payload,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'tududi-webhooks',
            'X-Tududi-Event': event,
            'X-Tududi-Delivery': deliveryUid,
            'X-Tududi-Timestamp': String(timestamp),
            'X-Tududi-Signature': `sha256=${sign(secret, timestamp, payload)}`,
        },
        transformRequest: [(body) => body],
        timeout: TIMEOUT_MS,
        maxContentLength: 64 * 1024,
    });
}

function describeError(error) {
    const status = error?.response?.status;
    if (status) return { status, text: `HTTP ${status}` };
    return { status: null, text: clip(error?.code || 'Request failed', 200) };
}

// A 4xx other than timeout and rate limit means the receiver refused this
// message, and sending the same bytes again will not change that.
function isFinal(status) {
    return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

async function recordOutcome(webhook, delivered) {
    const now = new Date();
    if (delivered) {
        await webhook.update({
            failure_count: 0,
            last_delivery_at: now,
            last_delivery_status: 'delivered',
        });
        return;
    }
    const failures = webhook.failure_count + 1;
    const turnOff = failures >= DISABLE_AFTER_FAILURES;
    await webhook.update({
        failure_count: failures,
        last_delivery_at: now,
        last_delivery_status: 'failed',
        ...(turnOff ? { enabled: false, disabled_reason: 'failures' } : {}),
    });
    if (turnOff) invalidate(webhook.user_id);
}

async function deliver(deliveryId) {
    // Claim the row first, so the scheduler and the immediate send never
    // both post the same delivery.
    const [claimed] = await WebhookDelivery.update(
        { status: 'sending' },
        { where: { id: deliveryId, status: 'pending' } }
    );
    if (claimed === 0) return null;

    const delivery = await WebhookDelivery.findByPk(deliveryId);
    const webhook = await Webhook.findByPk(delivery.webhook_id);
    if (!webhook || !webhook.enabled) {
        await delivery.update({
            status: 'failed',
            error: 'The webhook is turned off',
            next_attempt_at: null,
        });
        return delivery;
    }

    const attempts = delivery.attempts + 1;
    try {
        const response = await post(webhook, delivery);
        await delivery.update({
            status: 'delivered',
            attempts,
            response_status: response?.status ?? null,
            error: null,
            delivered_at: new Date(),
            next_attempt_at: null,
        });
        await recordOutcome(webhook, true);
    } catch (error) {
        const { status, text } = describeError(error);
        const giveUp = attempts >= MAX_ATTEMPTS || isFinal(status);
        await delivery.update({
            status: giveUp ? 'failed' : 'pending',
            attempts,
            response_status: status,
            error: text,
            next_attempt_at: giveUp
                ? null
                : new Date(Date.now() + RETRY_DELAYS_MIN[attempts - 1] * 60000),
        });
        if (giveUp) await recordOutcome(webhook, false);
    }
    return delivery;
}

// Runs every minute from the task scheduler: sends what is due, frees
// deliveries a crashed process left in 'sending', and drops old rows.
async function processDue({ now = new Date(), limit = 100 } = {}) {
    await WebhookDelivery.update(
        { status: 'pending' },
        {
            where: {
                status: 'sending',
                updated_at: {
                    [Op.lt]: new Date(now.getTime() - STUCK_SENDING_MS),
                },
            },
        }
    );

    const due = await WebhookDelivery.findAll({
        where: {
            status: 'pending',
            next_attempt_at: { [Op.lte]: now },
        },
        attributes: ['id'],
        order: [['id', 'ASC']],
        limit,
    });

    let sent = 0;
    for (let i = 0; i < due.length; i += 5) {
        const batch = due.slice(i, i + 5);
        const results = await Promise.allSettled(
            batch.map((row) => deliver(row.id))
        );
        sent += results.filter(
            (r) => r.status === 'fulfilled' && r.value?.status === 'delivered'
        ).length;
    }

    await WebhookDelivery.destroy({
        where: {
            status: { [Op.in]: ['delivered', 'failed'] },
            created_at: {
                [Op.lt]: new Date(
                    now.getTime() - KEEP_DELIVERIES_DAYS * 24 * 60 * 60 * 1000
                ),
            },
        },
    });

    return { processed: due.length, delivered: sent };
}

module.exports = {
    emit,
    deliver,
    processDue,
    invalidate,
    knownToHaveNone,
    sign,
    MAX_ATTEMPTS,
    DISABLE_AFTER_FAILURES,
};
