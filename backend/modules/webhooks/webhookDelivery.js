'use strict';

const crypto = require('crypto');
const { assertSafeUrl } = require('../url/ssrfGuard');
const secretCipher = require('../../shared/crypto/secretCipher');
const { logError } = require('../../services/logService');

const DELIVERY_TIMEOUT_MS = 5000;
const MAX_FAILURES_BEFORE_DISABLE = 10;

// Fixed headers every delivery sets itself. An auth header sharing one of
// these names would otherwise silently overwrite it (most importantly the
// HMAC signature, which breaks receiver-side verification with no error
// surfaced) - both endpoint config and delivery guard against it.
const RESERVED_HEADER_NAMES = new Set([
    'content-type',
    'content-length',
    'x-tududi-event',
    'x-tududi-delivery',
    'x-tududi-signature',
]);

function isReservedHeaderName(name) {
    return RESERVED_HEADER_NAMES.has(String(name).toLowerCase());
}

function signPayload(secret, rawBody) {
    return crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function buildPayload(notification) {
    return {
        id: notification.uid,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        level: notification.level,
        data: notification.data,
        created_at: notification.created_at || new Date().toISOString(),
    };
}

async function sendOnce(url, rawBody, headers) {
    let parsed;
    try {
        // Re-validated on every delivery, not just at endpoint creation: the
        // hostname can resolve to a private/internal address by the time a
        // notification actually fires even if it didn't when it was saved.
        parsed = await assertSafeUrl(url);
    } catch (error) {
        return { success: false, error: error.message };
    }

    return new Promise((resolve) => {
        const client =
            parsed.protocol === 'http:' ? require('http') : require('https');
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(rawBody),
                ...headers,
            },
            timeout: DELIVERY_TIMEOUT_MS,
        };

        const req = client.request(parsed, options, (res) => {
            // Drain the response body so the socket is released back to the pool.
            res.on('data', () => {});
            res.on('end', () => {
                const success = res.statusCode >= 200 && res.statusCode < 300;
                resolve({
                    success,
                    statusCode: res.statusCode,
                    error: success ? null : `HTTP ${res.statusCode}`,
                });
            });
        });

        req.on('timeout', () => {
            req.destroy(new Error('Request timed out'));
        });

        req.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        req.write(rawBody);
        req.end();
    });
}

// Builds the extra auth header(s) an endpoint's receiver expects, on top of
// the HMAC signature headers. Mirrors what n8n's Webhook trigger node
// supports: None, Basic Auth, and Header Auth (a JWT/bearer token pasted as
// a Header Auth value is indistinguishable from Header Auth to the sender).
function buildAuthHeaders(endpoint) {
    if (endpoint.auth_type === 'basic') {
        const encoded = Buffer.from(
            `${endpoint.auth_username || ''}:${endpoint.auth_secret || ''}`
        ).toString('base64');
        return { Authorization: `Basic ${encoded}` };
    }

    if (endpoint.auth_type === 'header') {
        const headerName = endpoint.auth_header_name || 'Authorization';
        return { [headerName]: endpoint.auth_secret || '' };
    }

    return {};
}

function isRetryable(result) {
    return !result.success && (!result.statusCode || result.statusCode >= 500);
}

async function recordDeliveryResult(endpoint, result) {
    try {
        if (result.success) {
            await endpoint.update({
                last_delivery_at: new Date(),
                last_delivery_status: 'success',
                last_delivery_error: null,
                failure_count: 0,
            });
            return;
        }

        // Atomic UPDATE ... SET failure_count = failure_count + 1, rather
        // than a JS read-modify-write off the (possibly stale) in-memory
        // value, so concurrent deliveries to the same endpoint can't lose a
        // failure count.
        await endpoint.increment('failure_count');
        await endpoint.reload({ attributes: ['failure_count'] });

        const updates = {
            last_delivery_at: new Date(),
            last_delivery_status: 'failed',
            last_delivery_error: result.error || 'Unknown error',
        };
        if (endpoint.failure_count >= MAX_FAILURES_BEFORE_DISABLE) {
            updates.active = false;
        }
        await endpoint.update(updates);
    } catch (error) {
        logError('Failed to record webhook delivery result:', error);
    }
}

// Signs and sends the payload once (with one retry on a retryable failure).
// Shared by deliver() (real dispatch, result persisted on the endpoint) and
// sendTestDelivery() (manual test send, result never persisted) so a test
// click can't count toward failure_count / auto-disable the endpoint.
async function attemptDelivery(endpoint, payload) {
    const rawBody = JSON.stringify(payload);
    const secret = secretCipher.decrypt(endpoint.secret);
    const signature = signPayload(secret, rawBody);
    const authSecret = endpoint.auth_secret
        ? secretCipher.decrypt(endpoint.auth_secret)
        : endpoint.auth_secret;

    const authHeaders = buildAuthHeaders({
        auth_type: endpoint.auth_type,
        auth_header_name: endpoint.auth_header_name,
        auth_username: endpoint.auth_username,
        auth_secret: authSecret,
    });
    const safeAuthHeaders = Object.fromEntries(
        Object.entries(authHeaders).filter(
            ([name]) => !isReservedHeaderName(name)
        )
    );

    const headers = {
        'X-Tududi-Event': payload.type,
        'X-Tududi-Delivery': crypto.randomUUID(),
        'X-Tududi-Signature': `sha256=${signature}`,
        ...safeAuthHeaders,
    };

    let result = await sendOnce(endpoint.url, rawBody, headers);
    if (isRetryable(result)) {
        result = await sendOnce(endpoint.url, rawBody, headers);
    }
    return result;
}

// Delivers a signed notification payload to a single webhook endpoint.
// Never throws: delivery failures are recorded on the endpoint and swallowed
// so a broken endpoint can't take down notification creation.
async function deliver(endpoint, payload) {
    try {
        const result = await attemptDelivery(endpoint, payload);
        await recordDeliveryResult(endpoint, result);
        return result;
    } catch (error) {
        logError('Unexpected error delivering webhook:', error);
        return { success: false, error: error.message };
    }
}

// Manual "send test" from the webhook settings UI. Exercises the exact same
// signing/auth/send path as deliver(), but never touches last_delivery_*,
// failure_count, or active - a failing test send must not auto-disable an
// endpoint before it has handled a real notification.
async function sendTestDelivery(endpoint, payload) {
    try {
        return await attemptDelivery(endpoint, payload);
    } catch (error) {
        logError('Unexpected error delivering test webhook:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    signPayload,
    buildPayload,
    buildAuthHeaders,
    isReservedHeaderName,
    deliver,
    sendTestDelivery,
};
