'use strict';

const webpush = require('web-push');
const repository = require('./repository');
const { getVapidKeys } = require('./vapid');
const { ValidationError } = require('../../shared/errors');
const { logError } = require('../../services/logService');

const MAX_SUBSCRIPTIONS_PER_USER = 20;
const MAX_FAILURES = 5;
const PUSH_TTL_SECONDS = 24 * 60 * 60;
const MAX_BODY_LENGTH = 300;

const clip = (value, max) =>
    typeof value === 'string' && value.length > max
        ? `${value.slice(0, max - 1)}…`
        : value;

function parseSubscription(body) {
    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;

    // Push services are always https; anything else would make the server
    // send requests to an address of the caller's choosing.
    if (
        typeof endpoint !== 'string' ||
        endpoint.length > 2048 ||
        !/^https:\/\/[^\s]+$/.test(endpoint)
    ) {
        throw new ValidationError('Invalid push endpoint');
    }
    if (
        typeof p256dh !== 'string' ||
        typeof auth !== 'string' ||
        !p256dh ||
        !auth ||
        p256dh.length > 255 ||
        auth.length > 255
    ) {
        throw new ValidationError('Invalid push subscription keys');
    }
    return { endpoint, p256dh, auth };
}

// Where a tap on the notification should land in the app.
function urlForNotification(data) {
    if (data?.taskUid) return `/task/${encodeURIComponent(data.taskUid)}`;
    if (data?.projectUid) {
        return `/project/${encodeURIComponent(data.projectUid)}`;
    }
    if (data?.habitUid) return `/habit/${encodeURIComponent(data.habitUid)}`;
    return '/';
}

function tagForNotification(type, data) {
    const entity = data?.taskUid || data?.projectUid || data?.habitUid;
    return entity ? `${type}:${entity}` : type;
}

class PushService {
    async getPublicConfig() {
        const { publicKey } = await getVapidKeys();
        return { publicKey, enabled: true };
    }

    async listSubscriptions(userId) {
        const rows = await repository.listForUser(userId);
        return {
            subscriptions: rows.map((row) => ({
                id: row.id,
                user_agent: row.user_agent,
                last_success_at: row.last_success_at,
                created_at: row.created_at,
            })),
        };
    }

    async subscribe(userId, body, userAgent) {
        const { endpoint, p256dh, auth } = parseSubscription(body);
        const agent = userAgent ? String(userAgent).slice(0, 512) : null;
        const existing = await repository.findByEndpoint(endpoint);

        if (existing) {
            // Same device again (resync on app open), or a shared device that
            // now belongs to whoever signed in last.
            await repository.update(existing, {
                user_id: userId,
                p256dh,
                auth,
                user_agent: agent,
                failure_count: 0,
            });
            return { subscribed: true };
        }

        const count = await repository.countForUser(userId);
        if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
            throw new ValidationError(
                'Too many devices are set up for push notifications'
            );
        }

        await repository.create({
            user_id: userId,
            endpoint,
            p256dh,
            auth,
            user_agent: agent,
        });
        return { subscribed: true };
    }

    async unsubscribe(userId, body) {
        const endpoint = body?.endpoint;
        if (typeof endpoint !== 'string' || !endpoint) {
            throw new ValidationError('Invalid push endpoint');
        }
        await repository.deleteForUser(userId, endpoint);
        return { subscribed: false };
    }

    async sendTest(userId) {
        const sent = await this.sendToUser(userId, {
            title: 'tududi',
            body: 'Push notifications are working on this device.',
            url: '/',
            tag: 'test',
        });
        return { sent };
    }

    async sendNotification(notification) {
        return this.sendToUser(notification.user_id, {
            title: notification.title,
            body: notification.message || '',
            url: urlForNotification(notification.data),
            tag: tagForNotification(notification.type, notification.data),
        });
    }

    // Sends to every device the user enabled. Never throws: a failing push
    // must not break the action that produced the notification. Returns the
    // number of devices the push service accepted.
    async sendToUser(userId, { title, body, url, tag }) {
        try {
            const subscriptions = await repository.listForUser(userId);
            if (subscriptions.length === 0) return 0;

            const { publicKey, privateKey, subject } = await getVapidKeys();
            const payload = JSON.stringify({
                title: clip(title, 120),
                body: clip(body, MAX_BODY_LENGTH),
                url,
                tag,
            });
            const options = {
                TTL: PUSH_TTL_SECONDS,
                urgency: 'normal',
                vapidDetails: { subject, publicKey, privateKey },
            };

            const results = await Promise.allSettled(
                subscriptions.map((sub) =>
                    webpush.sendNotification(
                        {
                            endpoint: sub.endpoint,
                            keys: { p256dh: sub.p256dh, auth: sub.auth },
                        },
                        payload,
                        options
                    )
                )
            );

            let delivered = 0;
            await Promise.all(
                results.map((result, index) => {
                    const sub = subscriptions[index];
                    if (result.status === 'fulfilled') {
                        delivered++;
                        return repository.update(sub, {
                            last_success_at: new Date(),
                            failure_count: 0,
                        });
                    }
                    return this.handleFailure(sub, result.reason);
                })
            );
            return delivered;
        } catch (error) {
            logError('Failed to send push notification:', error);
            return 0;
        }
    }

    async handleFailure(subscription, error) {
        const status = error?.statusCode;
        // 404/410: the browser dropped the subscription (uninstalled app,
        // revoked permission). It will never work again.
        if (status === 404 || status === 410) {
            return repository.deleteById(subscription.id);
        }
        const failures = (subscription.failure_count || 0) + 1;
        if (failures >= MAX_FAILURES) {
            return repository.deleteById(subscription.id);
        }
        logError(
            `Push delivery failed (status ${status || 'unknown'}):`,
            error?.body || error?.message
        );
        return repository.update(subscription, { failure_count: failures });
    }
}

module.exports = new PushService();
module.exports.urlForNotification = urlForNotification;
module.exports.tagForNotification = tagForNotification;
