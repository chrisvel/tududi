'use strict';

const repository = require('./repository');
const { buildPayload, deliver } = require('./webhookDelivery');
const { logError } = require('../../services/logService');

// Fans a notification out to every active webhook endpoint the user has
// subscribed to this type for. Mirrors telegramNotificationService's
// try/catch-and-log contract: this never throws back into
// Notification.createNotification.
async function dispatchForNotification(userId, notification) {
    try {
        const endpoints = await repository.findActiveForUserAndType(
            userId,
            notification.type
        );
        if (endpoints.length === 0) {
            return;
        }

        const payload = buildPayload(notification);
        await Promise.allSettled(
            endpoints.map((endpoint) => deliver(endpoint, payload))
        );
    } catch (error) {
        logError('Failed to dispatch webhook notifications:', error);
    }
}

module.exports = { dispatchForNotification };
