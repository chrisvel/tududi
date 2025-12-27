const webPush = require('web-push');
const { PushSubscription } = require('../models');
const { logError } = require('./logService');

// Initialize VAPID keys from environment variables
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@localhost';

let isConfigured = false;

if (vapidPublicKey && vapidPrivateKey) {
    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    isConfigured = true;
}

/**
 * Check if Web Push is configured
 */
function isWebPushConfigured() {
    return isConfigured;
}

/**
 * Get the public VAPID key for client subscription
 */
function getVapidPublicKey() {
    return vapidPublicKey || null;
}

/**
 * Subscribe a user to push notifications
 */
async function subscribe(userId, subscription) {
    try {
        // Upsert: update if endpoint exists, create if not
        const [sub, created] = await PushSubscription.findOrCreate({
            where: { endpoint: subscription.endpoint },
            defaults: {
                user_id: userId,
                keys: subscription.keys,
            },
        });

        if (!created) {
            await sub.update({ user_id: userId, keys: subscription.keys });
        }

        return { success: true, created };
    } catch (error) {
        logError('Error subscribing to push:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Unsubscribe a user from push notifications
 */
async function unsubscribe(userId, endpoint) {
    try {
        const deleted = await PushSubscription.destroy({
            where: { user_id: userId, endpoint },
        });
        return { success: true, deleted: deleted > 0 };
    } catch (error) {
        logError('Error unsubscribing from push:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send push notification to all of a user's subscriptions
 */
async function sendPushNotification(userId, notification) {
    if (!isConfigured) {
        return { success: false, error: 'Web Push not configured' };
    }

    try {
        const subscriptions = await PushSubscription.findAll({
            where: { user_id: userId },
        });

        if (subscriptions.length === 0) {
            return { success: true, sent: 0 };
        }

        const payload = JSON.stringify({
            title: notification.title,
            body: notification.message,
            icon: '/icon-logo.png',
            badge: '/favicon-32.png',
            data: notification.data || {},
            tag: notification.type || 'default',
        });

        const results = await Promise.allSettled(
            subscriptions.map(async (sub) => {
                try {
                    await webPush.sendNotification(
                        { endpoint: sub.endpoint, keys: sub.keys },
                        payload
                    );
                    return { success: true };
                } catch (error) {
                    // Remove invalid subscriptions (expired or unsubscribed)
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        await sub.destroy();
                    }
                    throw error;
                }
            })
        );

        const sent = results.filter((r) => r.status === 'fulfilled').length;
        return { success: true, sent, total: subscriptions.length };
    } catch (error) {
        logError('Error sending push notification:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    isWebPushConfigured,
    getVapidPublicKey,
    subscribe,
    unsubscribe,
    sendPushNotification,
};
