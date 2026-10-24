'use strict';

const crypto = require('crypto');
const { Webhook, WebhookDelivery } = require('../../models');
const secretCipher = require('../../shared/crypto/secretCipher');
const { ValidationError, NotFoundError } = require('../../shared/errors');
const { assertSafeCalDavUrl } = require('../caldav/services/safe-request');
const { ALL_EVENTS } = require('./events');
const dispatcher = require('./dispatcher');

const MAX_WEBHOOKS = 10;
const MAX_NAME_LENGTH = 100;
const RECENT_DELIVERIES = 20;

function normalizeUrl(raw) {
    let parsed;
    try {
        parsed = new URL(String(raw || '').trim());
    } catch {
        throw new ValidationError(
            'Enter the full webhook address, for example https://n8n.example.com/webhook/tududi'
        );
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new ValidationError(
            'The webhook address must start with http:// or https://'
        );
    }
    if (parsed.username || parsed.password) {
        throw new ValidationError(
            'Remove the username and password from the webhook address'
        );
    }
    parsed.hash = '';
    return parsed.toString();
}

function normalizeName(raw) {
    const name = String(raw ?? '').trim();
    if (!name) throw new ValidationError('Give the webhook a name');
    if (name.length > MAX_NAME_LENGTH) {
        throw new ValidationError(
            `The name can be at most ${MAX_NAME_LENGTH} characters`
        );
    }
    return name;
}

function normalizeEvents(raw) {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new ValidationError('Pick at least one event');
    }
    const unknown = raw.filter((event) => !ALL_EVENTS.includes(event));
    if (unknown.length > 0) {
        throw new ValidationError(`Unknown events: ${unknown.join(', ')}`);
    }
    return ALL_EVENTS.filter((event) => raw.includes(event));
}

function normalizeHour(raw) {
    if (raw === undefined || raw === null || raw === '') return 8;
    const hour = Number(raw);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        throw new ValidationError('The summary hour must be between 0 and 23');
    }
    return hour;
}

function encrypt(value) {
    if (!secretCipher.hasKeyMaterial()) {
        throw new ValidationError(
            'Cannot save webhooks: set TUDUDI_SESSION_SECRET (or TUDUDI_OIDC_SECRET_ENCRYPTION_KEY) on the server first'
        );
    }
    return secretCipher.encrypt(value);
}

const newSecret = () => `whsec_${crypto.randomBytes(24).toString('hex')}`;

function hostOf(encryptedUrl) {
    try {
        return new URL(secretCipher.decrypt(encryptedUrl)).host;
    } catch {
        return null;
    }
}

// The address and secret never go back to the browser: only the host, so
// the user can tell their webhooks apart. The secret is shown once, when it
// is created or rotated.
function serialize(webhook, { secret } = {}) {
    return {
        uid: webhook.uid,
        name: webhook.name,
        host: hostOf(webhook.url),
        events: webhook.events,
        summary_hour: webhook.summary_hour,
        enabled: webhook.enabled,
        disabled_reason: webhook.disabled_reason,
        failure_count: webhook.failure_count,
        last_delivery_at: webhook.last_delivery_at,
        last_delivery_status: webhook.last_delivery_status,
        created_at: webhook.created_at,
        ...(secret ? { secret } : {}),
    };
}

async function findOwned(userId, webhookUid) {
    const webhook = await Webhook.findOne({
        where: { uid: String(webhookUid || ''), user_id: userId },
    });
    if (!webhook) throw new NotFoundError('Webhook not found');
    return webhook;
}

async function list(userId) {
    const webhooks = await Webhook.findAll({
        where: { user_id: userId },
        order: [['id', 'ASC']],
    });
    return webhooks.map((webhook) => serialize(webhook));
}

async function create(userId, body = {}) {
    const count = await Webhook.count({ where: { user_id: userId } });
    if (count >= MAX_WEBHOOKS) {
        throw new ValidationError(
            `You can have at most ${MAX_WEBHOOKS} webhooks`
        );
    }

    const name = normalizeName(body.name);
    const url = normalizeUrl(body.url);
    const events = normalizeEvents(body.events);
    const summaryHour = normalizeHour(body.summary_hour);

    // Same rule as Apprise and calendar feeds: private addresses only when
    // CALDAV_ALLOW_PRIVATE_HOSTS is set, link-local never.
    await assertSafeCalDavUrl(url);

    const secret = newSecret();
    const webhook = await Webhook.create({
        user_id: userId,
        name,
        url: encrypt(url),
        secret: encrypt(secret),
        events,
        summary_hour: summaryHour,
    });
    dispatcher.invalidate(userId);
    return serialize(webhook, { secret });
}

async function update(userId, webhookUid, body = {}) {
    const webhook = await findOwned(userId, webhookUid);
    const changes = {};

    if (body.name !== undefined) changes.name = normalizeName(body.name);
    if (body.events !== undefined) {
        changes.events = normalizeEvents(body.events);
    }
    if (body.summary_hour !== undefined) {
        changes.summary_hour = normalizeHour(body.summary_hour);
    }
    if (body.url !== undefined && body.url !== '') {
        const url = normalizeUrl(body.url);
        await assertSafeCalDavUrl(url);
        changes.url = encrypt(url);
    }
    if (body.enabled !== undefined) {
        changes.enabled = body.enabled === true;
        if (changes.enabled) {
            changes.failure_count = 0;
            changes.disabled_reason = null;
        }
    }

    await webhook.update(changes);
    dispatcher.invalidate(userId);
    return serialize(webhook);
}

async function remove(userId, webhookUid) {
    const webhook = await findOwned(userId, webhookUid);
    await WebhookDelivery.destroy({ where: { webhook_id: webhook.id } });
    await webhook.destroy();
    dispatcher.invalidate(userId);
    return { deleted: true };
}

async function rotateSecret(userId, webhookUid) {
    const webhook = await findOwned(userId, webhookUid);
    const secret = newSecret();
    await webhook.update({ secret: encrypt(secret) });
    return serialize(webhook, { secret });
}

async function deliveries(userId, webhookUid) {
    const webhook = await findOwned(userId, webhookUid);
    const rows = await WebhookDelivery.findAll({
        where: { webhook_id: webhook.id },
        order: [['id', 'DESC']],
        limit: RECENT_DELIVERIES,
    });
    return rows.map((row) => ({
        uid: row.uid,
        event: row.event,
        status: row.status,
        attempts: row.attempts,
        response_status: row.response_status,
        error: row.error,
        created_at: row.created_at,
        delivered_at: row.delivered_at,
    }));
}

// Sends a test event straight away and reports what the receiver said.
async function sendTest(userId, webhookUid) {
    const webhook = await findOwned(userId, webhookUid);
    if (!webhook.enabled) {
        throw new ValidationError('Turn the webhook on first');
    }
    const [delivery] = await dispatcher.emit(userId, 'test', {
        text: 'Test message from tududi. Webhooks are working.',
        data: { webhook: { uid: webhook.uid, name: webhook.name } },
        webhookIds: [webhook.id],
        anyEvent: true,
        immediate: false,
    });
    if (!delivery) {
        throw new ValidationError('Could not queue the test message');
    }
    const result = await dispatcher.deliver(delivery.id);
    if (result?.status !== 'delivered') {
        throw new ValidationError(
            `The webhook did not accept the message: ${result?.error || 'unknown error'}`
        );
    }
    return { delivered: true, response_status: result.response_status };
}

module.exports = {
    list,
    create,
    update,
    remove,
    rotateSecret,
    deliveries,
    sendTest,
    MAX_WEBHOOKS,
};
